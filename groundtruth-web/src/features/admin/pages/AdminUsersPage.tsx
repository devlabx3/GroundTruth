import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PlusIcon, PencilSimpleIcon, CaretUpIcon, CaretDownIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { fetchUsuarios, crearUsuario, desactivarUsuario, editarUsuario, reactivarUsuario, enviarResetPassword, fijarPassword } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { UsuarioAdmin } from '@/types/api';

const schema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  email: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

const passwordSchema = z.object({
  password: z.string().min(8, 'errors:field_required'),
});

type PasswordFormulario = z.infer<typeof passwordSchema>;

/**
 * Soporte de usuarios y membresías (A3). Desactivar queda auditado y respeta el
 * guardarraíl "nunca sin timón": el backend rechaza (409 LAST_TEAM_ADMIN)
 * desactivar al único miembro que puede gestionar el equipo de una unidad.
 */
export default function AdminUsersPage() {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'nombre' | 'email' | 'membresia' | 'rol'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroEmail, setFiltroEmail] = useState('');
  const [filtroMembresia, setFiltroMembresia] = useState('');
  const [filtroRol, setFiltroRol] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UsuarioAdmin | null>(null);
  const [deactivating, setDeactivating] = useState<UsuarioAdmin | null>(null);
  const [resetting, setResetting] = useState<UsuarioAdmin | null>(null);
  const [settingPassword, setSettingPassword] = useState<UsuarioAdmin | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);

  const pageSize = 20;

  const { data: result = { items: [], total: 0, page: 1, pageSize: 20 }, isLoading } = useQuery({
    queryKey: ['admin', 'usuarios', page, pageSize, sortBy, sortDir, filtroNombre, filtroEmail, filtroMembresia, filtroRol],
    queryFn: () =>
      fetchUsuarios({
        page,
        pageSize,
        sortBy,
        sortDir,
        ...(filtroNombre && { nombre: filtroNombre }),
        ...(filtroEmail && { email: filtroEmail }),
        ...(filtroMembresia && { membresia: filtroMembresia }),
        ...(filtroRol && { rol: filtroRol }),
      }),
  });

  const rows = result.items;
  const total = result.total;
  const totalPages = Math.ceil(total / pageSize);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', email: '' },
  });

  const {
    register: registerPassword,
    handleSubmit: handleSubmitPassword,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });

  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: ['admin', 'usuarios', page, pageSize, sortBy, sortDir, filtroNombre, filtroEmail, filtroMembresia, filtroRol],
    });

  const toggleSort = (col: 'nombre' | 'email' | 'membresia' | 'rol') => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  async function onCreateOrEdit(values: Formulario) {
    setBusy(true);
    setErrorKey(null);
    setSuccessKey(null);
    try {
      if (editing) {
        await editarUsuario(editing.id, values);
        setEditing(null);
      } else {
        await crearUsuario(values);
        setCreateOpen(false);
      }
      reset();
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeactivate() {
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

  async function onReactivate(usuario: UsuarioAdmin) {
    setBusy(true);
    setErrorKey(null);
    try {
      await reactivarUsuario(usuario.id);
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onResetPassword() {
    const target = resetting;
    if (!target) return;
    setBusy(true);
    setErrorKey(null);
    setSuccessKey(null);
    setResetting(null);
    try {
      await enviarResetPassword(target.id);
      setSuccessKey('admin:users.reset_password_sent');
      setTimeout(() => setSuccessKey(null), 5000);
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSetPassword(values: PasswordFormulario) {
    const target = settingPassword;
    if (!target) return;
    setBusy(true);
    setErrorKey(null);
    setSuccessKey(null);
    try {
      await fijarPassword(target.id, values.password);
      setSettingPassword(null);
      resetPasswordForm();
      setSuccessKey('admin:users.set_password_done');
      setTimeout(() => setSuccessKey(null), 5000);
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  const SortableHeader = ({ col, label }: { col: 'nombre' | 'email' | 'membresia' | 'rol'; label: string }) => (
    <button
      onClick={() => toggleSort(col)}
      className="flex items-center gap-2 hover:text-emerald transition-colors"
    >
      {label}
      {sortBy === col && (sortDir === 'asc' ? <CaretUpIcon size={12} /> : <CaretDownIcon size={12} />)}
    </button>
  );

  const columns: Column<UsuarioAdmin>[] = [
    {
      key: 'nombre',
      header: <SortableHeader col="nombre" label={t('common:fields.name')} />,
    },
    {
      key: 'email',
      header: <SortableHeader col="email" label={t('common:fields.email')} />,
    },
    {
      key: 'membresias',
      header: <SortableHeader col="membresia" label={t('users.memberships')} />,
      render: (r) =>
        r.membresias || <span className="text-graphite">{t('users.no_membership')}</span>,
    },
    {
      key: 'rol',
      header: <SortableHeader col="rol" label={t('users.role')} />,
      render: (r) => r.rol || <span className="text-graphite">—</span>,
    },
    { key: 'estado', header: t('common:fields.state'), render: (r) => (
      <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${
        r.estado === 'activa' ? 'bg-emerald-100 text-emerald' : 'bg-sealwax-100 text-sealwax'
      }`}>
        {t(`users.state.${r.estado}`)}
      </span>
    ) },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <div className="flex gap-2">
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setErrorKey(null); setSuccessKey(null); setEditing(r); reset({ nombre: r.nombre, email: r.email }); setCreateOpen(true); }}>
          <PencilSimpleIcon size={14} />
        </Button>
        {r.estado === 'activa' ? (
          <>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setDeactivating(r)}>
              {t('users.deactivate')}
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setResetting(r)}>
              {t('users.reset_password')}
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setErrorKey(null); setSuccessKey(null); resetPasswordForm(); setSettingPassword(r); }}>
              {t('users.set_password')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => onReactivate(r)}>
              {t('users.reactivate')}
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setResetting(r)}>
              {t('users.reset_password')}
            </Button>
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => { setErrorKey(null); setSuccessKey(null); resetPasswordForm(); setSettingPassword(r); }}>
              {t('users.set_password')}
            </Button>
          </>
        )}
      </div>
    ) },
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

      {errorKey && <AlertBanner messageKey={errorKey} />}
      {successKey && <AlertBanner messageKey={successKey} tone="info" />}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Input
          label={t('common:fields.name')}
          placeholder={t('common:fields.name')}
          value={filtroNombre}
          onChange={(e) => {
            setFiltroNombre(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label={t('common:fields.email')}
          placeholder={t('common:fields.email')}
          value={filtroEmail}
          onChange={(e) => {
            setFiltroEmail(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label={t('users.memberships')}
          placeholder={t('users.memberships')}
          value={filtroMembresia}
          onChange={(e) => {
            setFiltroMembresia(e.target.value);
            setPage(1);
          }}
        />
        <Input
          label={t('users.role')}
          placeholder={t('users.role')}
          value={filtroRol}
          onChange={(e) => {
            setFiltroRol(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Table columns={columns} rows={rows} emptyTitle={t('users.empty')} />
      )}

      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-graphite">
          <div>
            {t('users.showing_page', {
              current: page,
              total: totalPages,
              start: (page - 1) * pageSize + 1,
              end: Math.min(page * pageSize, total),
              count: total,
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-2 text-xs"
            >
              {t('users.prev_page')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-2 text-xs"
            >
              {t('users.next_page')}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onClose={() => { setCreateOpen(false); setEditing(null); }} title={editing ? t('users.edit') : t('users.create')}>
        <form onSubmit={handleSubmit(onCreateOrEdit)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input label={t('common:fields.email')} type="email" errorKey={errors.email?.message} {...register('email')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => { setCreateOpen(false); setEditing(null); }}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('common:loading') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!resetting}
        onClose={() => setResetting(null)}
        onConfirm={onResetPassword}
        title={t('users.reset_password')}
        body={t('users.reset_password_confirm', { name: resetting?.nombre ?? '' })}
        confirmLabel={t('users.reset_password')}
      />

      <Dialog open={!!settingPassword} onClose={() => setSettingPassword(null)} title={t('users.set_password')}>
        <form onSubmit={handleSubmitPassword(onSetPassword)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <p className="text-sm text-graphite">
            {t('users.set_password_body', { name: settingPassword?.nombre ?? '' })}
          </p>
          <Input
            label={t('users.new_password')}
            type="text"
            errorKey={passwordErrors.password?.message}
            {...registerPassword('password')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setSettingPassword(null)}>
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
