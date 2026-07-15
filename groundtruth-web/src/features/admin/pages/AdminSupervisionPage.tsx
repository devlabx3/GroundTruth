import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@phosphor-icons/react';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { fetchParcelasGlobales } from '../queries';
import type { ParcelaGlobal } from '@/types/api';

const CROP_OPTIONS = ['cafe', 'cacao', 'aguacate'];
const STATE_OPTIONS = ['conforme', 'alerta', 'pendiente'];

/** Supervisión global (A6): tabla transversal con filtros por unidad/cultivo/estado. */
export default function AdminSupervisionPage() {
  const { t } = useTranslation(['admin', 'common']);
  const [unit, setUnit] = useState('');
  const [crop, setCrop] = useState('');
  const [state, setState] = useState('');
  const [query, setQuery] = useState('');

  const { data: parcels = [], isLoading } = useQuery({
    queryKey: ['admin', 'parcelas'],
    queryFn: fetchParcelasGlobales,
  });

  // Las unidades del filtro salen de los propios datos: nunca de una lista aparte
  // que pueda quedar desincronizada.
  const units = useMemo(
    () => [...new Set(parcels.map((p) => p.unidad))].sort(),
    [parcels],
  );

  const q = query.trim().toLowerCase();
  const filtered = parcels.filter(
    (p) =>
      (!unit || p.unidad === unit) &&
      (!crop || p.cultivo === crop) &&
      (!state || p.estado === state) &&
      (!q || `${p.nombre} ${p.unidad}`.toLowerCase().includes(q)),
  );

  const columns: Column<ParcelaGlobal>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'unidad', header: t('units.unit') },
    { key: 'cultivo', header: t('common:fields.crop'), render: (r) => t(`common:crops.${r.cultivo}`) },
    {
      key: 'certificada',
      header: t('supervision.certified'),
      render: (r) => (r.certificada ? <StatusBadge status="vigente" /> : null),
    },
    { key: 'estado', header: t('common:fields.state'), render: (r) => <StatusBadge status={r.estado} /> },
  ];

  const selectCls =
    'rounded-card border border-porcelain-border bg-white px-3 py-2 text-sm outline-none focus:border-emerald';

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('supervision.title')}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={selectCls}>
          <option value="">{t('supervision.all_units')}</option>
          {units.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
        <select value={crop} onChange={(e) => setCrop(e.target.value)} className={selectCls}>
          <option value="">{t('supervision.all_crops')}</option>
          {CROP_OPTIONS.map((c) => (
            <option key={c} value={c}>{t(`common:crops.${c}`)}</option>
          ))}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className={selectCls}>
          <option value="">{t('supervision.all_states')}</option>
          {STATE_OPTIONS.map((s) => (
            <option key={s} value={s}>{t(`common:status.${s}`)}</option>
          ))}
        </select>
        <label className="relative block flex-1 basis-52">
          <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.search_placeholder')}
            className="w-full rounded-card border border-porcelain-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald"
          />
        </label>
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Table columns={columns} rows={filtered} emptyTitle={t('home.search_empty')} />
      )}
    </div>
  );
}
