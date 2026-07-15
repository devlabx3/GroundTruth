import { Injectable } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { SolanaService } from '@/solana/solana.service';

const MICRO = 1_000_000;
const LAMPORTS = 1_000_000_000;
// Umbral de alerta del fondo de gas: por debajo conviene recargar SOL al backend, o el
// certify se quedará sin poder firmar. ~0.1 SOL da margen holgado (cada despacho gasta ~0.001).
const GAS_BAJO_SOL = 0.1;

/**
 * Finanzas de plataforma (solo lectura) — la superficie que le faltaba al Admin: no lo
 * que tiene cada operador (eso ya está en Unidades), sino el dinero de LA PLATAFORMA.
 *
 *  - Ingresos: el saldo on-chain real de la cuenta de ingresos (`plataforma_ata`, donde
 *    caen todas las tarifas) + el histórico cobrado según la BD.
 *  - Gas: el saldo SOL del firmante del backend, con alerta si baja — es un punto ciego
 *    operativo: si se agota, la certificación deja de firmar sin previo aviso.
 *  - Agregados: fondos totales de los operadores, certificados y manifiestos emitidos.
 */
@Injectable()
export class AdminFinanzasService {
  constructor(
    private readonly db: DbService,
    private readonly solana: SolanaService,
  ) {}

  async finanzas() {
    const [agg, ingresosMicro, solLamports] = await Promise.all([
      this.db.queryOne<{
        cobrado_total: string;
        cobrado_cert: string;
        cobrado_man: string;
        tesorerias_total: string;
        certs_emitidos: string;
        manifiestos: string;
      }>(`
        select
          coalesce((select sum(-monto) from movimientos_tesoreria
                    where tipo in ('DEBITO_CERTIFICACION','DEBITO_MANIFIESTO')), 0) as cobrado_total,
          coalesce((select sum(-monto) from movimientos_tesoreria
                    where tipo = 'DEBITO_CERTIFICACION'), 0) as cobrado_cert,
          coalesce((select sum(-monto) from movimientos_tesoreria
                    where tipo = 'DEBITO_MANIFIESTO'), 0) as cobrado_man,
          coalesce((select sum(saldo_cache) from tesorerias), 0) as tesorerias_total,
          (select count(*) from certificados where estado <> 'DRAFT') as certs_emitidos,
          (select count(*) from movimientos_tesoreria where tipo = 'DEBITO_MANIFIESTO') as manifiestos
      `),
      // En micro-USDC / lamports; null si Solana no está configurada.
      this.solana.saldoIngresosMicro(),
      this.solana.saldoSolLamports(),
    ]);

    const m = agg!;
    const solBackend = solLamports === null ? null : solLamports / LAMPORTS;

    return {
      solanaActiva: this.solana.isEnabled(),
      ingresos: {
        // Real acumulado on-chain en la cuenta de ingresos (si Solana está activa).
        plataformaUsdc: ingresosMicro === null ? null : ingresosMicro / MICRO,
        // Histórico cobrado según la BD (existe con o sin cadena).
        cobradoTotalUsdc: Number(m.cobrado_total) / MICRO,
        porCertificacionUsdc: Number(m.cobrado_cert) / MICRO,
        porManifiestoUsdc: Number(m.cobrado_man) / MICRO,
      },
      gas: {
        solBackend,
        bajo: solBackend !== null && solBackend < GAS_BAJO_SOL,
      },
      agregados: {
        tesoreriasUsdc: Number(m.tesorerias_total) / MICRO,
        certificadosEmitidos: Number(m.certs_emitidos),
        manifiestosEmitidos: Number(m.manifiestos),
      },
    };
  }
}
