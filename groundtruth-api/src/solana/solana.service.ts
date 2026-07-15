import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  getAccount,
} from '@solana/spl-token';
import { IDL, type Groundtruth } from './groundtruth-idl';
import * as pdas from './pdas';

const MICRO = 1_000_000;

/** Programas de ZK Compression sobre los que se apoya Bubblegum. */
const BUBBLEGUM_ID = new PublicKey('BGUMAp9Gq7iTEuizy4pqaxsTyUCBK68MDfK752saRPUY');
const COMPRESSION_ID = new PublicKey('cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK');
const NOOP_ID = new PublicKey('noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV');

/** Un certificado a mintear dentro del despacho. */
export interface CertificadoOnchain {
  parcelaId: string; // uuid
  cicloId: string; // uuid
  fincaId: string; // uuid
  numeroPublico: string; // GT-AAAA-NNNNN → nombre del cNFT
  geojsonUri: string;
  hashPdf: string; // hex de 64
  hashImagen: string;
}

export interface ResultadoCertify {
  signature: string;
  /** asset ID del cNFT por parcela. */
  assets: Record<string, string>;
  /** Saldo leído de la cadena DESPUÉS del cobro, en micro-USDC. */
  saldoMicro: number;
}

/**
 * Puente con el programa Anchor (Arquitectura §7).
 *
 * Está **desactivado si falta configuración** (`isEnabled() === false`): sin las
 * variables de Solana, el backend sigue con su certificación pre-Solana en la BD.
 * Eso mantiene el sistema usable en local/demo sin cadena, y hace que activar
 * on-chain sea una decisión de entorno, no un fork del código.
 */
@Injectable()
export class SolanaService implements OnModuleInit {
  private readonly log = new Logger(SolanaService.name);
  private program?: Program<Groundtruth>;
  private backend?: Keypair;
  private usdcMint?: PublicKey;
  private merkleTree?: PublicKey;
  private plataformaAta?: PublicKey;
  private clusterActivo = 'devnet';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    // Switch de cluster: `SOLANA_CLUSTER` (devnet|localnet) elige de qué bloque de
    // variables leer (SOLANA_DEVNET_* o SOLANA_LOCALNET_*). Cambiarlo y reiniciar
    // alterna la cadena sin tocar código ni el resto del .env.
    const cluster = (this.config.get<string>('SOLANA_CLUSTER') ?? 'devnet').toLowerCase();
    this.clusterActivo = cluster; // refleja el switch aunque falte config (para las sondas)
    const P = cluster.toUpperCase(); // DEVNET | LOCALNET
    const rpc = this.config.get<string>(`SOLANA_${P}_RPC_URL`);
    const secret = this.config.get<string>('SOLANA_BACKEND_SECRET_KEY');
    const usdc = this.config.get<string>(`SOLANA_${P}_USDC_MINT`);
    const tree = this.config.get<string>(`SOLANA_${P}_MERKLE_TREE`);
    const ingresos = this.config.get<string>(`SOLANA_${P}_PLATAFORMA_ATA`);

    if (!rpc || !secret || !usdc || !tree || !ingresos) {
      this.log.warn(
        `Solana [${cluster}] no configurada: la certificación usará la ruta pre-Solana (transacción en BD).`,
      );
      return;
    }

    this.backend = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secret)));
    this.usdcMint = new PublicKey(usdc);
    this.merkleTree = new PublicKey(tree);
    this.plataformaAta = new PublicKey(ingresos);

    const connection = new Connection(rpc, 'confirmed');
    const provider = new AnchorProvider(connection, new Wallet(this.backend), {
      commitment: 'confirmed',
    });
    this.program = new Program<Groundtruth>(IDL, provider);
    this.log.log(`Solana activa [${cluster}] — programa ${this.program.programId.toBase58()}`);
  }

  isEnabled(): boolean {
    return this.program !== undefined;
  }

  /** Cluster activo (devnet|localnet). Localnet se reporta como red 'devnet' (la imita). */
  get cluster(): string {
    return this.clusterActivo;
  }

  /** RPC del cluster activo, resuelto por el switch — para sondas de salud (RPC, Arweave). */
  get rpcUrl(): string | undefined {
    return this.config.get<string>(`SOLANA_${this.clusterActivo.toUpperCase()}_RPC_URL`);
  }

  // ---------- PDAs ----------
  // Las seeds viven en `pdas.ts` (módulo puro, con tests): son un contrato con la
  // cadena, y si una cambia, el dinero de un operador deja de estar donde lo buscamos.

  private uuidBytes = pdas.uuidBytes;

  configPda = () => pdas.configPda(this.program!.programId);
  operatorPda = (operadorId: string) => pdas.operatorPda(this.program!.programId, operadorId);
  treasuryPda = (operadorId: string) => pdas.treasuryPda(this.program!.programId, operadorId);
  farmPda = (fincaId: string) => pdas.farmPda(this.program!.programId, fincaId);
  parcelPda = (parcelaId: string) => pdas.parcelPda(this.program!.programId, parcelaId);
  certPda = (parcelaId: string, cicloId: string) =>
    pdas.certPda(this.program!.programId, parcelaId, cicloId);

  treasuryAta = (operadorId: string) =>
    getAssociatedTokenAddressSync(this.usdcMint!, this.treasuryPda(operadorId), true);

  /**
   * Crea la tesorería on-chain de una unidad (Operator + Treasury + ATA).
   * La dirección del ATA es la que el operador usa para depositar USDC.
   */
  async initOperatorTreasury(operadorId: string) {
    const treasury = this.treasuryPda(operadorId);
    const ata = this.treasuryAta(operadorId);

    // `accountsPartial` y no `accounts`: varias PDAs del programa derivan de un
    // campo de su propia cuenta (`operator.operador_id`), que el resolutor de
    // Anchor no puede calcular. Las direcciones las derivamos aquí, con las
    // mismas seeds que el programa.
    await this.program!.methods.initOperatorTreasury(
      [...this.uuidBytes(operadorId)],
      this.backend!.publicKey,
    )
      .accountsPartial({
        payer: this.backend!.publicKey,
        config: this.configPda(),
        operator: this.operatorPda(operadorId),
        treasury,
        usdcMint: this.usdcMint!,
        treasuryAta: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { treasuryPda: treasury.toBase58(), ataUsdc: ata.toBase58() };
  }

  /** Registra finca/parcela on-chain si aún no existen (idempotente por PDA). */
  async asegurarIdentidades(
    operadorId: string,
    parcelas: { parcelaId: string; fincaId: string }[],
  ) {
    const fincas = [...new Set(parcelas.map((p) => p.fincaId))];

    for (const fincaId of fincas) {
      if (await this.existe(this.farmPda(fincaId))) continue;
      await this.program!.methods.registerFarm([...this.uuidBytes(fincaId)])
        .accountsPartial({
          payer: this.backend!.publicKey,
          config: this.configPda(),
          backendAuthority: this.backend!.publicKey,
          operator: this.operatorPda(operadorId),
          farm: this.farmPda(fincaId),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }

    for (const { parcelaId, fincaId } of parcelas) {
      if (await this.existe(this.parcelPda(parcelaId))) continue;
      await this.program!.methods.registerParcel([...this.uuidBytes(parcelaId)])
        .accountsPartial({
          payer: this.backend!.publicKey,
          config: this.configPda(),
          backendAuthority: this.backend!.publicKey,
          farm: this.farmPda(fincaId),
          parcel: this.parcelPda(parcelaId),
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    }
  }

  /**
   * **El despacho: UNA transacción con N `certify` + 1 `emit_manifest`.**
   *
   * La atomicidad la da la transacción de Solana: si un solo certificado falla,
   * revierte todo — no hay cobro parcial ni mint parcial.
   *
   * Los certificados que YA existen on-chain se omiten de la transacción y su
   * asset ID se lee de la cadena: así un reintento tras una caída a mitad de
   * camino reconcilia en vez de duplicar (el `CertificateRecord` es la llave).
   */
  async certificarEmbarque(
    operadorId: string,
    embarqueId: string,
    certificados: CertificadoOnchain[],
    tarifaCertMicro: number,
    tarifaManifiestoMicro: number,
  ): Promise<ResultadoCertify> {
    const assets: Record<string, string> = {};
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units: 1_200_000 })];

    const treeConfig = PublicKey.findProgramAddressSync(
      [this.merkleTree!.toBuffer()],
      BUBBLEGUM_ID,
    )[0];

    for (const c of certificados) {
      const certPda = this.certPda(c.parcelaId, c.cicloId);
      if (await this.existe(certPda)) {
        // Ya minteado en un intento anterior: se recupera, no se re-emite.
        const rec = await this.program!.account.certificateRecord.fetch(certPda);
        assets[c.parcelaId] = new PublicKey(rec.assetId).toBase58();
        continue;
      }

      ixs.push(
        await this.program!.methods.certify({
          parcelaId: [...this.uuidBytes(c.parcelaId)],
          cicloId: [...this.uuidBytes(c.cicloId)],
          nombre: c.numeroPublico,
          geojsonUri: c.geojsonUri,
          hashPdf: [...Buffer.from(c.hashPdf, 'hex')],
          hashImagen: [...Buffer.from(c.hashImagen, 'hex')],
          fee: new BN(tarifaCertMicro),
        })
          .accountsPartial({
            payer: this.backend!.publicKey,
            config: this.configPda(),
            backendAuthority: this.backend!.publicKey,
            operator: this.operatorPda(operadorId),
            certificateRecord: certPda,
            treasury: this.treasuryPda(operadorId),
            farm: this.farmPda(c.fincaId),
            parcel: this.parcelPda(c.parcelaId),
            usdcMint: this.usdcMint!,
            treasuryAta: this.treasuryAta(operadorId),
            plataformaAta: this.plataformaAta!,
            treeConfig,
            merkleTree: this.merkleTree!,
            logWrapper: NOOP_ID,
            compressionProgram: COMPRESSION_ID,
            bubblegumProgram: BUBBLEGUM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
      );
    }

    // El manifiesto se cobra SIEMPRE, aunque el despacho reutilice el 100 % de
    // los certificados vigentes: un embarque "gratis" no existe (§ tarifas).
    ixs.push(
      await this.program!.methods.emitManifest(
        [...this.uuidBytes(embarqueId)],
        `gt://embarque/${embarqueId}`,
        new BN(tarifaManifiestoMicro),
      )
        .accountsPartial({
          config: this.configPda(),
          backendAuthority: this.backend!.publicKey,
          operator: this.operatorPda(operadorId),
          treasury: this.treasuryPda(operadorId),
          usdcMint: this.usdcMint!,
          treasuryAta: this.treasuryAta(operadorId),
          plataformaAta: this.plataformaAta!,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction(),
    );

    const tx = new Transaction().add(...ixs);
    const signature = await this.program!.provider.sendAndConfirm!(tx, [this.backend!]);

    // Los asset ID de lo recién minteado se leen de la cadena: es la fuente de
    // verdad, no un cálculo optimista del backend.
    for (const c of certificados) {
      if (assets[c.parcelaId]) continue;
      const rec = await this.program!.account.certificateRecord.fetch(
        this.certPda(c.parcelaId, c.cicloId),
      );
      assets[c.parcelaId] = new PublicKey(rec.assetId).toBase58();
    }

    return { signature, assets, saldoMicro: await this.saldoMicro(operadorId) };
  }

  /**
   * Depósitos entrantes al ATA de la unidad, leídos **de la cadena**.
   *
   * Es la fuente de verdad de la tesorería. El webhook de Helius solo avisa antes;
   * si un aviso se pierde (y se pierden), esto lo recupera igual. La atribución la
   * da la cuenta destino, sin memo: cada unidad tiene su ATA determinista (§7.4).
   */
  /**
   * Firmas que han tocado el ATA de la unidad, **desde la última ya conocida**.
   *
   * Pagina hacia atrás hasta encontrarla: si el backend estuvo caído mientras
   * entraban depósitos, un `limit` fijo se los habría comido en silencio. Es la
   * clase de fallo que solo se nota cuando falta el dinero de alguien.
   */
  async firmasDelAta(operadorId: string, conocidas: Set<string>): Promise<string[]> {
    const conn = this.program!.provider.connection;
    const ata = this.treasuryAta(operadorId);

    const nuevas: string[] = [];
    let before: string | undefined;

    for (let pagina = 0; pagina < 20; pagina++) {
      const lote = await conn.getSignaturesForAddress(ata, { limit: 1000, before });
      if (lote.length === 0) break;

      for (const f of lote) {
        if (conocidas.has(f.signature)) return nuevas; // alcanzamos lo ya ingerido
        if (!f.err) nuevas.push(f.signature);
      }
      if (lote.length < 1000) break;
      before = lote[lote.length - 1].signature;
    }
    return nuevas;
  }

  async depositosEntrantes(
    operadorId: string,
    firmas: string[],
  ): Promise<{ signature: string; montoMicro: number; origen: string | null; ts: number | null }[]> {
    const ata = this.treasuryAta(operadorId);
    const conn = this.program!.provider.connection;

    const salida: { signature: string; montoMicro: number; origen: string | null; ts: number | null }[] = [];
    for (const signature of firmas) {
      const tx = await conn.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx?.meta) continue;

      const clave = ata.toBase58();
      const indice = tx.transaction.message.accountKeys.findIndex(
        (k) => k.pubkey.toBase58() === clave,
      );
      if (indice < 0) continue;

      const antes = tx.meta.preTokenBalances?.find((b) => b.accountIndex === indice);
      const despues = tx.meta.postTokenBalances?.find((b) => b.accountIndex === indice);
      const delta =
        Number(despues?.uiTokenAmount.amount ?? 0) - Number(antes?.uiTokenAmount.amount ?? 0);
      if (delta <= 0) continue; // salidas (nuestros cobros) no son depósitos

      // El origen es quien perdió saldo en la misma transacción.
      const fuente = tx.meta.preTokenBalances?.find((b) => {
        const post = tx.meta!.postTokenBalances?.find((p) => p.accountIndex === b.accountIndex);
        return (
          b.accountIndex !== indice &&
          Number(post?.uiTokenAmount.amount ?? 0) < Number(b.uiTokenAmount.amount)
        );
      });

      salida.push({
        signature,
        montoMicro: delta,
        origen: fuente?.owner ?? null,
        ts: tx.blockTime ?? null,
      });
    }
    return salida;
  }

  /** Saldo real del ATA de la unidad (la BD solo guarda un espejo). */
  async saldoMicro(operadorId: string): Promise<number> {
    try {
      const cuenta = await getAccount(
        this.program!.provider.connection,
        this.treasuryAta(operadorId),
      );
      return Number(cuenta.amount);
    } catch {
      return 0; // el ATA aún no existe
    }
  }

  async saldoUsdc(operadorId: string): Promise<number> {
    return (await this.saldoMicro(operadorId)) / MICRO;
  }

  /**
   * Saldo on-chain (micro-USDC) de la cuenta de INGRESOS de la plataforma: ahí caen
   * todas las tarifas cobradas (`plataforma_ata`). `null` si Solana no está activa.
   */
  async saldoIngresosMicro(): Promise<number | null> {
    if (!this.isEnabled()) return null;
    try {
      const cuenta = await getAccount(this.program!.provider.connection, this.plataformaAta!);
      return Number(cuenta.amount);
    } catch {
      return 0; // el ATA aún no existe / sin ingresos todavía
    }
  }

  /**
   * Saldo en lamports del firmante del backend: el FONDO DE GAS del certify. Si se
   * agota, la certificación deja de firmar. `null` si Solana no está activa.
   */
  async saldoSolLamports(): Promise<number | null> {
    if (!this.isEnabled()) return null;
    return this.program!.provider.connection.getBalance(this.backend!.publicKey);
  }

  private async existe(cuenta: PublicKey): Promise<boolean> {
    return (await this.program!.provider.connection.getAccountInfo(cuenta)) !== null;
  }
}
