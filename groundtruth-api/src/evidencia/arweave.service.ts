import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// bs58 vía Anchor: pnpm es estricto y no resuelve dependencias no declaradas.
import { utils } from '@coral-xyz/anchor';

/**
 * Arweave vía Irys — "storage permanente" (Arquitectura §11).
 *
 * Solo sube el **GeoJSON**: liviano y jurídicamente vinculante. Los archivos
 * pesados (PDF, imagen) van a Supabase Storage y de ellos on-chain solo viajan
 * sus hashes, que van embebidos en este GeoJSON.
 *
 * Red por defecto: **devnet** (efímera, ~60 días). La geolocalización de las
 * fincas es un dato sensible: publicarla en Arweave mainnet es permanente e
 * irreversible, y por eso es una decisión explícita (`IRYS_NETWORK=mainnet`).
 */
@Injectable()
export class ArweaveService implements OnModuleInit {
  private readonly log = new Logger(ArweaveService.name);
  private irys?: any;
  private mainnet = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const secret = this.config.get<string>('SOLANA_BACKEND_SECRET_KEY');
    // RPC del cluster activo (switch SOLANA_CLUSTER); Irys firma con SOL de ese cluster.
    const cluster = (this.config.get<string>('SOLANA_CLUSTER') ?? 'devnet').toUpperCase();
    const rpc = this.config.get<string>(`SOLANA_${cluster}_RPC_URL`);
    if (!secret || !rpc) {
      this.log.warn('Arweave desactivado: falta la keypair de Solana (paga la subida).');
      return;
    }
    this.mainnet = this.config.get<string>('IRYS_NETWORK') === 'mainnet';

    try {
      const { Uploader } = await import('@irys/upload');
      const { Solana } = await import('@irys/upload-solana');
      // Irys firma con la misma keypair del backend: la subida se paga en SOL.
      const clave = utils.bytes.bs58.encode(Buffer.from(JSON.parse(secret)));
      let b = Uploader(Solana).withWallet(clave).withRpc(rpc);
      if (!this.mainnet) b = b.devnet();
      this.irys = await b;
      this.log.log(`Arweave activo vía Irys (${this.mainnet ? 'MAINNET' : 'devnet'}).`);
    } catch (e) {
      this.log.warn(`Arweave desactivado: ${(e as Error).message}`);
    }
  }

  isEnabled(): boolean {
    return this.irys !== undefined;
  }

  /** Sube el GeoJSON y devuelve su URI `ar://<id>`. */
  async subirGeoJson(geojson: unknown): Promise<string> {
    const datos = Buffer.from(JSON.stringify(geojson));
    const receipt = await this.irys.upload(datos, {
      tags: [
        { name: 'Content-Type', value: 'application/geo+json' },
        { name: 'App-Name', value: 'GroundTruth' },
        { name: 'Schema', value: 'eudr-parcel-v1' },
      ],
    });
    return `ar://${receipt.id}`;
  }
}
