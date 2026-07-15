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
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { fetchAgricultores, crearAgricultor } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { Agricultor } from '@/types/api';

const schema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  email: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
  fincaNombre: z.string().min(1, 'errors:field_required'),
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
  const { data: rows, isLoading } = useQuery({ queryKey: ['dashboard', 'agricultores'], queryFn: fetchAgricultores });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', email: '', fincaNombre: '' },
  });

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
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'agricultores'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('farmers.title')}</h1>
        <Button onClick={() => { setErrorKey(null); setDialogOpen(true); }}>
          <PlusIcon size={16} />
          {t('farmers.create')}
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <Table columns={columns} rows={rows} emptyTitle={t('farmers.empty')} />
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={t('farmers.create')}>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input label={t('common:fields.email')} type="email" errorKey={errors.email?.message} {...register('email')} />
          <Input label={t('topology.farm')} errorKey={errors.fincaNombre?.message} {...register('fincaNombre')} />
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
