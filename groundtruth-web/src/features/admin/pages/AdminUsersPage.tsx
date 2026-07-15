import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { MagnifyingGlassIcon, PlusIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { fetchUsuarios, crearUsuario, desactivarUsuario } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { UsuarioAdmin } from '@/types/api';

const schema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  email: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/**
 * Soporte de usuarios y membresías (A3). Desactivar queda auditado y respeta el
 * guardarraíl "nunca sin timón": el backend rechaza (409 LAST_TEAM_ADMIN)
 * desactivar al único miembro que puede gestionar el equipo de una unidad.
 */
export default function AdminUsersPage() {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [deactivating, setDeactivating] = useState<UsuarioAdmin | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'usuarios'],
    queryFn: fetchUsuarios,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', email: '' },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] });

  async function onCreate(values: Formulario) {
    setBusy(true);
    setErrorKey(null);
    try {
      await crearUsuario(values);
      setCreateOpen(false);
      reset();
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
    // Sin fila seleccionada no hay nada que hacer — y sobre todo, no se activa
    // `busy`: si se activara y saliéramos, el botón quedaría bloqueado para siempre.
    const target = deactivating;
    if (!target) return;
    setBusy(true);
    setErrorKey(null);
    setDeactivating(null);
    try {
      await desactivarUsuario(target.id);
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter((u) => `${u.nombre} ${u.email}`.toLowerCase().includes(q))
    : rows;

  const columns: Column<UsuarioAdmin>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'email', header: t('common:fields.email') },
    {
      key: 'membresias',
      header: t('users.memberships'),
      render: (r) =>
        r.membresias || <span className="text-graphite">{t('users.no_membership')}</span>,
    },
    { key: 'estado', header: t('common:fields.state'), render: (r) => (
      <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${
        r.estado === 'activa' ? 'bg-emerald-100 text-emerald' : 'bg-sealwax-100 text-sealwax'
      }`}>
        {t(`users.state.${r.estado}`)}
      </span>
    ) },
    { key: 'actions', header: '', align: 'right', render: (r) =>
      r.estado === 'activa' ? (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setDeactivating(r)}>
          {t('users.deactivate')}
        </Button>
      ) : null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('users.title')}</h1>
        <Button onClick={() => { setErrorKey(null); setCreateOpen(true); }}>
          <PlusIcon size={16} />
          {t('users.create')}
        </Button>
      </div>

      {errorKey && !createOpen && <AlertBanner messageKey={errorKey} />}

      <label className="relative block max-w-md">
        <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-graphite" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('users.search_placeholder')}
          className="w-full rounded-card border border-porcelain-border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald"
        />
      </label>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Table columns={columns} rows={filtered} emptyTitle={t('users.empty')} />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={t('users.create')}>
        <form onSubmit={handleSubmit(onCreate)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input label={t('common:fields.email')} type="email" errorKey={errors.email?.message} {...register('email')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setCreateOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('common:loading') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={onDeactivate}
        title={t('users.deactivate')}
        body={t('users.deactivate_confirm', { name: deactivating?.nombre ?? '' })}
        confirmLabel={t('users.deactivate')}
        danger
      />
    </div>
  );
}
