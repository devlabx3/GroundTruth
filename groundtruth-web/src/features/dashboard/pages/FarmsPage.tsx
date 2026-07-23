import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PlusIcon, PencilSimpleIcon, CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import TableFilters, { type FilterConfig } from '@/components/ui/TableFilters';
import TablePagination from '@/components/ui/TablePagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { COUNTRIES } from '@/lib/countries';
import { buscarFincas, editarFinca } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { Finca } from '@/types/api';

const editarSchema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  pais: z.string().min(2, 'errors:field_required').max(2),
  areaHa: z.number().positive('errors:field_required'),
});

type EditarFormulario = z.infer<typeof editarSchema>;

/**
 * Fincas de la unidad (O4). Crear finca + asignar agricultor.
 */
export default function FarmsPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Finca | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sortBy, setSortBy] = useState<'nombre' | 'agricultor' | 'pais' | 'areaHa'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const { data: result, isLoading: loadingFincas } = useQuery({
    queryKey: ['dashboard', 'fincas', filters, page, pageSize, sortBy, sortDir],
    queryFn: () => buscarFincas(
      { nombre: filters.nombre, agricultor: filters.agricultor, pais: filters.pais },
      page,
      pageSize,
      sortBy,
      sortDir,
    ),
  });

  const {
    register: registerEditar,
    handleSubmit: handleSubmitEditar,
    reset: resetEditar,
    formState: { errors: errorsEditar },
  } = useForm({
    resolver: zodResolver(editarSchema),
    defaultValues: { nombre: '', pais: '', areaHa: 0 },
  });

  async function onEditarFinca(values: EditarFormulario) {
    if (!editing) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await editarFinca(editing.id, values);
      setEditing(null);
      resetEditar();
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'fincas'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  const handleFiltersChange = (newFilters: Record<string, string>) => {
    setFilters(newFilters);
    setPage(1);
  };

  function handleSort(column: 'nombre' | 'agricultor' | 'pais' | 'areaHa') {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  }

  function sortableHeader(column: 'nombre' | 'agricultor' | 'pais' | 'areaHa', label: string) {
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
    { key: 'agricultor', label: t('topology.farmer'), placeholder: 'Buscar por agricultor...' },
    { key: 'pais', label: t('common:fields.country'), placeholder: 'Buscar por país...' },
  ];

  const columns: Column<Finca>[] = [
    { key: 'nombre', header: sortableHeader('nombre', t('common:fields.name')) },
    { key: 'agricultor', header: sortableHeader('agricultor', t('topology.farmer')), render: (r) => r.agricultor ? (
      <div className="flex flex-col">
        <span>{r.agricultor}</span>
        {r.agricultorEmail && <span className="text-xs text-graphite">{r.agricultorEmail}</span>}
      </div>
    ) : <span className="text-graphite">{t('topology.unassigned')}</span> },
    { key: 'areaHa', header: sortableHeader('areaHa', t('topology.area')), align: 'right', mono: true, render: (r) => `${r.areaHa ? Number(r.areaHa).toFixed(2) : '—'} ha` },
    { key: 'pais', header: sortableHeader('pais', t('common:fields.country')) },
    { key: 'parcelas', header: t('common:nav.parcels'), align: 'right', mono: true },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <Button
        variant="ghost"
        className="px-2 py-1 text-xs"
        title="Editar finca"
        onClick={() => {
          setErrorKey(null);
          setEditing(r);
          resetEditar({ nombre: r.nombre, pais: r.pais, areaHa: r.areaHa ?? 0 });
        }}>
        <PencilSimpleIcon size={14} />
      </Button>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('topology.farms')}</h1>
        <Button onClick={() => navigate(`/${locale}/dashboard/fincas/nueva`)}>
          <PlusIcon size={16} />
          {t('topology.new_farm')}
        </Button>
      </div>

      {errorKey && <AlertBanner messageKey={errorKey} />}

      <TableFilters filters={filterConfig} onFiltersChange={handleFiltersChange} activeFilters={filters} />

      {loadingFincas ? (
        <SkeletonRows rows={4} />
      ) : (
        <>
          <Table columns={columns} rows={result?.items ?? []} emptyTitle={t('topology.no_farms')} />
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

      {/* Diálogo editar finca */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Editar finca: ${editing?.nombre}`}>
        <form onSubmit={handleSubmitEditar(onEditarFinca)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errorsEditar.nombre?.message} {...registerEditar('nombre')} />
          <Select
            label={t('common:fields.country')}
            options={COUNTRIES}
            placeholder={t('common:fields.select_country')}
            errorKey={errorsEditar.pais?.message}
            {...registerEditar('pais')}
          />
          <Input
            label={t('topology.area')}
            type="number"
            step="0.01"
            min="0"
            placeholder="10.5"
            errorKey={errorsEditar.areaHa?.message}
            {...registerEditar('areaHa', { valueAsNumber: true })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setEditing(null)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('common:loading') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
