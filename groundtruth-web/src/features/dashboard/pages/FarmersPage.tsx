import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PlusIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import TableFilters, { type FilterConfig } from '@/components/ui/TableFilters';
import TablePagination from '@/components/ui/TablePagination';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { useSession } from '@/stores/session';
import { fetchAgricultores, crearAgricultor } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { Agricultor } from '@/types/api';

const schema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  email: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/**
 * Agricultores de la unidad (O5). Alta = crea el usuario y su finca en la
 * unidad (auditado). El agricultor podrá iniciar sesión cuando exista el flujo
 * de invitación (Supabase Auth); mientras, el operador ya gestiona su finca.
 */
export default function FarmersPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: result, isLoading } = useQuery({
    queryKey: ['dashboard', 'agricultores', filters, page, pageSize],
    queryFn: () => fetchAgricultores(
      { nombre: filters.nombre, email: filters.email, finca: filters.finca },
      page,
      pageSize,
    ),
  });

  const activeMembership = useSession((s) => s.activeMembership());
  const isDireccion = activeMembership?.subRolNombre === 'Dirección';

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', email: '' },
  });

  const filterConfig: FilterConfig[] = [
    { key: 'nombre', label: t('common:fields.name'), placeholder: 'Buscar por nombre...' },
    { key: 'email', label: t('common:fields.email'), placeholder: 'Buscar por email...', type: 'email' },
    { key: 'finca', label: t('topology.farm'), placeholder: 'Buscar por finca...' },
  ];

  const columns: Column<Agricultor>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'email', header: t('common:fields.email') },
    { key: 'finca', header: t('topology.farm') },
    { key: 'parcelas', header: t('common:nav.parcels'), align: 'right', mono: true },
  ];

  async function onSubmit(values: Formulario) {
    setBusy(true);
    setErrorKey(null);
    try {
      await crearAgricultor(values);
      setDialogOpen(false);
      reset();
      setPage(1);
      setFilters({});
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'agricultores'] });
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('farmers.title')}</h1>
        {!isDireccion && (
          <Button onClick={() => { setErrorKey(null); setDialogOpen(true); }}>
            <PlusIcon size={16} />
            {t('farmers.create')}
          </Button>
        )}
      </div>

      <TableFilters filters={filterConfig} onFiltersChange={handleFiltersChange} activeFilters={filters} />

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <>
          <Table columns={columns} rows={result?.items ?? []} emptyTitle={t('farmers.empty')} />
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

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t('farmers.create')}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input label={t('common:fields.email')} type="email" errorKey={errors.email?.message} {...register('email')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>
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
