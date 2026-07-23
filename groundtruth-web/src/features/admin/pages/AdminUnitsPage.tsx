import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon, CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import TableFilters, { type FilterConfig } from '@/components/ui/TableFilters';
import TablePagination from '@/components/ui/TablePagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { fetchUnidades } from '../queries';
import type { UnidadResumen } from '@/types/api';

/** Estado de la unidad: activa / suspendida / pendiente de tesorería on-chain. */
const ESTADO_CLS = {
  activa: 'bg-emerald-100 text-emerald',
  suspendida: 'bg-sealwax-100 text-sealwax',
  pendiente: 'bg-porcelain text-graphite border border-porcelain-border',
};

type SortColumn = 'nombre' | 'pais' | 'parcelas' | 'saldoUsdc' | 'estado';

/** Unidades de negocio (A1). */
export default function AdminUnitsPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<SortColumn>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: result, isLoading } = useQuery({
    queryKey: ['admin', 'unidades', filters, page, pageSize, sortBy, sortDir],
    queryFn: () =>
      fetchUnidades({
        page,
        pageSize,
        sortBy,
        sortDir,
        ...(filters.nombre && { nombre: filters.nombre }),
        ...(filters.pais && { pais: filters.pais }),
        ...(filters.estado && { estado: filters.estado as UnidadResumen['estado'] }),
      }),
  });

  const total = result?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

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
    { key: 'pais', label: t('units.country'), placeholder: 'Buscar por país...' },
    {
      key: 'estado',
      label: t('common:fields.state'),
      placeholder: t('common:fields.state'),
      type: 'select',
      options: [
        { value: 'activa', label: t('units.state.activa') },
        { value: 'suspendida', label: t('units.state.suspendida') },
        { value: 'pendiente', label: t('units.state.pendiente') },
      ],
    },
  ];

  const numFmt = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2 });
  const columns: Column<UnidadResumen>[] = [
    { key: 'nombre', header: sortableHeader('nombre', t('common:fields.name')) },
    { key: 'pais', header: sortableHeader('pais', t('units.country')) },
    { key: 'parcelas', header: sortableHeader('parcelas', t('common:nav.parcels')), align: 'right', mono: true },
    { key: 'saldoUsdc', header: sortableHeader('saldoUsdc', t('units.balance')), align: 'right', render: (r) => (
      <span className="font-mono text-xs">{numFmt.format(r.saldoUsdc)} USDC</span>
    ) },
    { key: 'estado', header: sortableHeader('estado', t('common:fields.state')), render: (r) => (
      <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${ESTADO_CLS[r.estado]}`}>
        {t(`units.state.${r.estado}`)}
      </span>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('units.title')}</h1>
        <Button onClick={() => navigate(`/${locale}/admin/unidades/nueva`)}>
          <PlusIcon size={16} />
          {t('units.new')}
        </Button>
      </div>

      <TableFilters filters={filterConfig} onFiltersChange={handleFiltersChange} activeFilters={filters} />

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <Table
            columns={columns}
            rows={result?.items ?? []}
            onRowClick={(r) => navigate(`/${locale}/admin/unidades/${r.id}`)}
            emptyTitle={t('units.empty')}
          />
          {totalPages > 1 && (
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              pageSize={pageSize}
              total={total}
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
