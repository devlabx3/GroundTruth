import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { fetchOverview, fetchParcelasGlobales } from '../queries';
import AlertBanner from '@/components/shared/AlertBanner';
import type { ParcelaGlobal } from '@/types/api';

/** Panel global del Admin (A6): métricas multi-unidad + búsqueda transversal. */
export default function AdminHomePage() {
  const { t } = useTranslation(['admin', 'common']);
  const [query, setQuery] = useState('');
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: fetchOverview,
  });
  const { data: parcels = [], isLoading: loadingParcels } = useQuery({
    queryKey: ['admin', 'parcelas'],
    queryFn: fetchParcelasGlobales,
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  // Consulta fallida: `data` es undefined con isLoading=false. Sin este corte la
  // vista revienta al leerlo — mejor decir que algo falló que romperse en blanco.
  if (!metrics) return <AlertBanner messageKey="errors:server" />;

  const tiles = [
    { key: 'units', value: metrics.unidades },
    { key: 'certs_30d', value: metrics.certificados30d },
    { key: 'pending_sagas', value: metrics.sagasPendientes, alert: metrics.sagasPendientes > 0 },
    { key: 'open_alerts', value: metrics.alertasAbiertas, alert: metrics.alertasAbiertas > 0 },
  ];

  const q = query.trim().toLowerCase();
  const filtered = q
    ? parcels.filter((p) => `${p.nombre} ${p.unidad} ${p.cultivo}`.toLowerCase().includes(q))
    : parcels;

  const columns: Column<ParcelaGlobal>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'unidad', header: t('units.unit') },
    { key: 'cultivo', header: t('common:fields.crop'), render: (r) => t(`common:crops.${r.cultivo}`) },
    { key: 'estado', header: t('common:fields.state'), render: (r) => <StatusBadge status={r.estado} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t('home.title')}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((m) => (
          <Card key={m.key}>
            <div className="text-xs text-graphite">{t(`home.metrics.${m.key}`)}</div>
            <div className={`mt-1 text-3xl ${m.alert ? 'text-sealwax' : 'text-ink'}`}>{m.value}</div>
          </Card>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <label className="relative block max-w-md">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.search_placeholder')}
            className="w-full rounded-card border border-porcelain-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald"
          />
        </label>
        {loadingParcels ? (
          <SkeletonRows rows={3} />
        ) : (
          <Table columns={columns} rows={filtered} emptyTitle={t('home.search_empty')} />
        )}
      </section>
    </div>
  );
}
