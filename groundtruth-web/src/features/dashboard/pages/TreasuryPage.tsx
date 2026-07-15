import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowsClockwiseIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import TreasuryBalanceCard from '@/components/shared/TreasuryBalanceCard';
import ExplorerLink from '@/components/shared/ExplorerLink';
import RealtimeIndicator from '@/components/shared/RealtimeIndicator';
import { useRealtimeInvalidation } from '@/lib/useRealtime';
import { fetchTesoreria, sincronizarTesoreria } from '../queries';
import type { Movimiento } from '@/types/api';

/**
 * Tesorería (O3): saldo, dirección para depositar USDC (red Solana) e historial.
 *
 * La dirección que se muestra es la **cuenta de tokens (ATA)** de la unidad: es
 * donde viven los USDC y la que vigila el backend. El saldo se reconcilia contra
 * la cadena al abrir la vista, así que no depende de que el webhook haya llegado.
 */
export default function TreasuryPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const queryClient = useQueryClient();
  const [sincronizando, setSincronizando] = useState(false);
  const {
    data: treasury,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['dashboard', 'treasury'],
    queryFn: fetchTesoreria,
  });
  // El depósito lo confirma la cadena y lo concilia el backend al escribir
  // `saldo_cache`. Ese UPDATE es la campana: sin esto el operador ve el saldo viejo
  // hasta que recarga — y el botón de sincronizar sigue estando para forzarlo.
  const enVivo = useRealtimeInvalidation({
    tabla: 'tesorerias',
    queryKey: ['dashboard', 'treasury'],
  });

  async function sincronizar() {
    setSincronizando(true);
    try {
      await sincronizarTesoreria();
      await queryClient.invalidateQueries({ queryKey: ['dashboard', 'treasury'] });
    } finally {
      setSincronizando(false);
    }
  }

  if (isLoading) return <SkeletonRows rows={4} />;
  // Si la consulta falla, `treasury` es undefined con isLoading=false: sin este
  // corte, la vista reventaría al leer el saldo en vez de explicar el error.
  if (isError || !treasury) return <AlertBanner messageKey="errors:server" />;

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
  const numFmt = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, signDisplay: 'always' });
  const typeKey: Record<string, string> = {
    deposit: 'type_deposit',
    debit_cert: 'type_debit_cert',
    debit_manifest: 'type_debit_manifest',
  };

  const columns: Column<Movimiento>[] = [
    { key: 'fecha', header: t('common:fields.date'), render: (r) => dateFmt.format(new Date(r.fecha)), mono: true },
    { key: 'tipo', header: t('common:fields.type'), render: (r) => t(`treasury.${typeKey[r.tipo] ?? r.tipo}`) },
    {
      key: 'monto',
      header: t('common:fields.amount'),
      align: 'right',
      render: (r) => (
        <span className={`font-mono text-xs ${r.monto < 0 ? 'text-sealwax' : 'text-emerald'}`}>
          {numFmt.format(r.monto)} USDC
        </span>
      ),
    },
    { key: 'tx', header: 'Tx', render: (r) => <ExplorerLink type="tx" value={r.tx} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl">{t('treasury.title')}</h1>
          <RealtimeIndicator estado={enVivo} />
        </div>
        <Button variant="secondary" disabled={sincronizando} onClick={sincronizar}>
          <ArrowsClockwiseIcon size={16} />
          {sincronizando ? t('common:loading') : t('treasury.sync')}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TreasuryBalanceCard saldoUsdc={treasury.saldoUsdc} />
        <Card>
          <div className="text-xs text-graphite">{t('treasury.copy_address')}</div>
          <div className="mt-2 break-all font-mono text-xs text-ink">{treasury.address}</div>
          <div className="mt-3 flex items-center gap-3">
            <CopyButton value={treasury.address} />
            <ExplorerLink type="address" value={treasury.address} />
          </div>
        </Card>
      </div>

      <AlertBanner tone="info" messageKey="dashboard:treasury.deposit_hint" />
      <AlertBanner tone="info" messageKey="dashboard:treasury.deposit_delayed" />

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink">{t('treasury.history')}</h2>
        <Table
          columns={columns}
          rows={treasury.movimientos}
          emptyTitle={t('treasury.empty')}
        />
      </section>
    </div>
  );
}
