import { useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import TableFilters, { type FilterConfig } from '@/components/ui/TableFilters';
import TablePagination from '@/components/ui/TablePagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import { buscarParcelas } from '../queries';
import type { Parcela } from '@/types/api';
import RealtimeIndicator from '@/components/shared/RealtimeIndicator';
import { useRealtimeInvalidation } from '@/lib/useRealtime';

type SortColumn = 'nombre' | 'finca' | 'cultivo' | 'areaHa' | 'estado';

/** Fincas y parcelas (O4). */
export default function TopologyPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<SortColumn>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Misma señal que el panel: el semáforo de la parcela cambió (migración 0011).
  const enVivo = useRealtimeInvalidation({
    tabla: 'parcelas',
    queryKey: ['dashboard', 'parcels'],
  });
  const { data: result, isLoading } = useQuery({
    queryKey: ['dashboard', 'parcels', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => buscarParcelas(
      {
        nombre: filters.nombre,
        finca: filters.finca,
        cultivo: filters.cultivo,
        estado: filters.estado as Parcela['estado'] | undefined,
      },
      page,
      pageSize,
      sortBy,
      sortDir,
    ),
  });

  const handleFiltersChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPage(1);
  };

  function handleSort(column: SortColumn) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  }

  function sortableHeader(column: SortColumn, label: string) {
    const isActive = sortBy === column;
    return (
      <button
        type="button"
        onClick={() => handleSort(column)}
        className="flex items-center gap-1 font-medium hover:text-graphite-dark">
        {label}
        {isActive ? (
          sortDir === 'asc' ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />
        ) : (
          <CaretUpIcon size={12} className="opacity-20" />
        )}
      </button>
    );
  }

  const filterConfig: FilterConfig[] = [
    { key: 'nombre', label: t('common:fields.name'), placeholder: 'Buscar por nombre...' },
    { key: 'finca', label: t('topology.farm'), placeholder: 'Buscar por finca...' },
    { key: 'cultivo', label: t('common:fields.crop'), placeholder: 'Buscar por cultivo...' },
    {
      key: 'estado',
      label: t('common:fields.state'),
      placeholder: t('common:fields.state'),
      type: 'select',
      options: [
        { value: 'conforme', label: t('common:status.conforme') },
        { value: 'alerta', label: t('common:status.alerta') },
        { value: 'pendiente', label: t('common:status.pendiente') },
      ],
    },
  ];

  const columns: Column<Parcela>[] = [
    { key: 'core', header: '', render: (r) => <SoilCoreIndicator filled={r.filled} certified={r.certificada} size="sm" /> },
    { key: 'nombre', header: sortableHeader('nombre', t('common:fields.name')) },
    { key: 'finca', header: sortableHeader('finca', t('topology.farm')) },
    { key: 'cultivo', header: sortableHeader('cultivo', t('common:fields.crop')), render: (r) => t(`common:crops.${r.cultivo}`) },
    { key: 'areaHa', header: sortableHeader('areaHa', t('topology.area')), align: 'right', mono: true, render: (r) => `${r.areaHa} ${t('common:units.ha')}` },
    { key: 'sensores', header: t('topology.sensors'), align: 'right', mono: true, render: (r) => `${r.sensores}/${r.sensoresRequeridos}` },
    { key: 'estado', header: sortableHeader('estado', t('common:fields.state')), render: (r) => <StatusBadge status={r.estado} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl">{t('topology.title')}</h1>
          <RealtimeIndicator estado={enVivo} />
        </div>
        <Button onClick={() => navigate(`/${locale}/dashboard/topologia/nueva`)}>
          <PlusIcon size={16} />
          {t('topology.new_parcel')}
        </Button>
      </div>

      {location.state?.created && <AlertBanner tone="info" messageKey="dashboard:topology.created" />}

      <TableFilters filters={filterConfig} onFiltersChange={handleFiltersChange} activeFilters={filters} />

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={result?.items ?? []}
            onRowClick={(r) => navigate(`/${locale}/dashboard/topologia/${r.id}`)}
            emptyTitle={t('topology.empty')}
          />
          {result && result.totalPages > 1 && (
            <TablePagination
              currentPage={page}
              totalPages={result.totalPages}
              pageSize={pageSize}
              total={result.total}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
