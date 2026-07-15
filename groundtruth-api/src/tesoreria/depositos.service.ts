import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { SolanaService } from '@/solana/solana.service';

const MICRO = 1_000_000;

/**
 * Ingesta de depósitos USDC a la tesorería (F3).
 *
 * **La cadena es la fuente de verdad, no el webhook.** Helius avisa cuando entra
 * un depósito, pero un webhook es best-effort: se pierde, se duplica, llega tarde.
 * Por eso la ingesta real es este reconciliador, que LEE la cadena; el webhook solo
 * dispara la reconciliación antes de que el operador refresque. Si Helius no está
 * configurado (o falla), el sistema sigue cuadrando igual.
 *
 * Idempotencia: `movimientos_tesoreria.tx_signature` es único, así que ingerir dos
 * veces la misma transacción no puede duplicar un depósito.
 */
@Injectable()
export class DepositosService {
  private readonly log = new Logger(DepositosService.name);

  constructor(
    private readonly db: DbService,
    private readonly solana: SolanaService,
  ) {}

  /**
   * Reconcilia la tesorería de una unidad contra la cadena: inserta los depósitos
   * que falten y deja `saldo_cache` con el saldo REAL del ATA.
   */
  async sincronizar(operadorId: string): Promise<{ nuevos: number; saldoUsdc: number }> {
    if (!this.solana.isEnabled()) return { nuevos: 0, saldoUsdc: 0 };

    const tes = await this.db.queryOne<{ id: string }>(
      'select id from tesorerias where operador_id = $1',
      [operadorId],
    );
    if (!tes) return { nuevos: 0, saldoUsdc: 0 };

    // Se recorre la cadena hacia atrás hasta la última firma ya ingerida, y solo
    // se piden los detalles de lo nuevo: en régimen normal, UNA llamada RPC.
    const filas = await this.db.query<{ tx_signature: string }>(
      'select tx_signature from movimientos_tesoreria where tesoreria_id = $1',
      [tes.id],
    );
    // Los débitos llevan sufijo (`#cert`): la firma de cadena es lo previo al '#'.
    const conocidas = new Set(filas.map((f) => f.tx_signature.split('#')[0]));

    const firmas = await this.solana.firmasDelAta(operadorId, conocidas);
    const entrantes = await this.solana.depositosEntrantes(operadorId, firmas);
    let nuevos = 0;

    for (const d of entrantes) {
      const res = await this.db.query(
        `insert into movimientos_tesoreria
           (tesoreria_id, tipo, monto, tx_signature, origen, confirmado_en)
         values ($1, 'DEPOSITO', $2, $3, $4, $5)
         on conflict (tx_signature) do nothing
         returning id`,
        [
          tes.id,
          d.montoMicro,
          d.signature,
          d.origen,
          d.ts ? new Date(d.ts * 1000) : new Date(),
        ],
      );
      if (res.length > 0) nuevos++;
    }

    // El saldo NO se acumula sumando movimientos: se toma el del ATA. Así el
    // espejo no puede derivar de la cuenta on-chain, pase lo que pase.
    const saldoMicro = await this.solana.saldoMicro(operadorId);
    await this.db.query(
      'update tesorerias set saldo_cache = $2, actualizado_en = now() where id = $1',
      [tes.id, saldoMicro],
    );

    if (nuevos > 0) {
      this.log.log(`Unidad ${operadorId}: ${nuevos} depósito(s) nuevo(s).`);
    }
    return { nuevos, saldoUsdc: saldoMicro / MICRO };
  }

  /** Reconcilia la unidad dueña de un ATA (lo que llega en el aviso de Helius). */
  async sincronizarPorAta(ata: string): Promise<boolean> {
    const t = await this.db.queryOne<{ operador_id: string }>(
      'select operador_id from tesorerias where ata_usdc = $1',
      [ata],
    );
    if (!t) return false;
    await this.sincronizar(t.operador_id);
    return true;
  }
}
