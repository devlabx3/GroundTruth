import { Injectable } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';
import { DepositosService } from './depositos.service';

/**
 * Tesorería (O3). Los montos viven en micro-USDC (BIGINT, u64 on-chain); se
 * exponen ya divididos a USDC decimal para la UI. `saldo_cache` es espejo del
 * saldo on-chain (fuente de verdad: la ATA en Solana, vía webhook Helius).
 */
const MICRO = 1_000_000;
const TIPO_UI: Record<string, string> = {
  DEPOSITO: 'deposit',
  DEBITO_CERTIFICACION: 'debit_cert',
  DEBITO_MANIFIESTO: 'debit_manifest',
};

@Injectable()
export class TesoreriaService {
  constructor(
    private readonly db: DbService,
    private readonly depositos: DepositosService,
  ) {}

  async getTesoreria(operadorId: string) {
    // Reconcilia contra la cadena antes de responder: el saldo y el historial que
    // ve el operador no dependen de que un webhook haya llegado.
    await this.depositos.sincronizar(operadorId).catch(() => undefined);

    const tes = await this.db.queryOne<{
      id: string;
      treasury_pda: string;
      ata_usdc: string;
      red: string;
      saldo_cache: string;
    }>(
      'select id, treasury_pda, ata_usdc, red, saldo_cache from tesorerias where operador_id = $1',
      [operadorId],
    );
    if (!tes) throw DomainErrors.notFound();

    const movimientos = await this.db.query<{
      id: string;
      confirmado_en: Date | null;
      created_at: Date;
      tipo: string;
      monto: string;
      tx_signature: string;
    }>(
      `
      select id, tipo, monto, tx_signature, confirmado_en, created_at
      from movimientos_tesoreria
      where tesoreria_id = $1
      order by coalesce(confirmado_en, created_at) desc
      `,
      [tes.id],
    );

    return {
      // La dirección de depósito es el **ATA**, no la Treasury PDA: ahí es donde
      // viven los USDC y es la cuenta que vigila el reconciliador. La PDA está
      // fuera de la curva y varias wallets se niegan a enviarle tokens — mostrarla
      // como destino sería invitar a que un depósito se pierda.
      address: tes.ata_usdc,
      treasuryPda: tes.treasury_pda,
      red: tes.red,
      saldoUsdc: Number(tes.saldo_cache) / MICRO,
      movimientos: movimientos.map((m) => ({
        id: m.id,
        fecha: m.confirmado_en ?? m.created_at,
        tipo: TIPO_UI[m.tipo] ?? m.tipo,
        monto: Number(m.monto) / MICRO,
        // Los dos débitos de un despacho comparten transacción y se distinguen en
        // la BD con un sufijo (`#cert`, `#manifiesto`) por la unicidad de la
        // columna. Hacia fuera se expone la firma real, o el enlace al explorer
        // apuntaría a una transacción que no existe.
        tx: m.tx_signature.split('#')[0],
      })),
    };
  }

  /** Solo el saldo — para el panel del operador sin traer todo el historial. */
  async getSaldo(operadorId: string) {
    const tes = await this.db.queryOne<{ saldo_cache: string }>(
      'select saldo_cache from tesorerias where operador_id = $1',
      [operadorId],
    );
    return { saldoUsdc: tes ? Number(tes.saldo_cache) / MICRO : 0 };
  }
}
