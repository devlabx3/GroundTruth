import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PlusIcon, WarningIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Input from '@/components/ui/Input';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { fetchPrivilegios, crearPrivilegio, deprecarPrivilegio } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { PrivilegioCatalogo } from '@/types/api';

const schema = z.object({
  clave: z.string().regex(/^[a-z]+\.[a-z]+$/, 'errors:privilege_key_invalid'),
  nombre: z.string().min(1, 'errors:field_required'),
  sensible: z.boolean().optional(),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/**
 * Catálogo de privilegios de la plataforma (A2). Deprecar muestra el impacto
 * (sub-roles que lo usan) antes de confirmar: no se borra ni se revoca en
 * caliente — deja de poder asignarse, y quien ya lo tiene lo conserva.
 */
export default function AdminPrivilegesPage() {
  const { t } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [deprecating, setDeprecating] = useState<PrivilegioCatalogo | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'privilegios'],
    queryFn: fetchPrivilegios,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { clave: '', nombre: '', sensible: false },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'privilegios'] });

  async function onCreate(values: Formulario) {
    setBusy(true);
    setErrorKey(null);
    try {
      await crearPrivilegio(values);
      setAddOpen(false);
      reset();
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDeprecate() {
    // Sin fila seleccionada no hay nada que hacer — y sobre todo, no se activa
    // `busy`: si se activara y saliéramos, el botón quedaría bloqueado para siempre.
    const target = deprecating;
    if (!target) return;
    setDeprecating(null);
    try {
      await deprecarPrivilegio(target.id);
      refresh();
    } catch (e) {
      setErrorKey(claveDeError(e));
    }
  }

  const columns: Column<PrivilegioCatalogo>[] = [
    { key: 'clave', header: t('privileges_page.key'), mono: true },
    {
      key: 'nombre',
      header: t('common:fields.name'),
      render: (r) => t(`common:privileges.${r.clave}`, { defaultValue: r.nombre }),
    },
    {
      key: 'sensible',
      header: t('privileges_page.sensitive'),
      render: (r) => (r.sensible ? <WarningIcon size={16} weight="fill" color="#6E1423" /> : null),
    },
    {
      key: 'enSubroles',
      header: t('privileges_page.in_subroles'),
      align: 'right',
      mono: true,
    },
    { key: 'estado', header: t('common:fields.state'), render: (r) => (
      <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${
        r.estado === 'activo'
          ? 'bg-emerald-100 text-emerald'
          : 'bg-porcelain text-graphite border border-porcelain-border'
      }`}>
        {t(`privileges_page.state.${r.estado}`)}
      </span>
    ) },
    { key: 'actions', header: '', align: 'right', render: (r) =>
      r.estado === 'activo' ? (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setDeprecating(r)}>
          {t('privileges_page.deprecate')}
        </Button>
      ) : null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('privileges_page.title')}</h1>
        <Button onClick={() => { setErrorKey(null); setAddOpen(true); }}>
          <PlusIcon size={16} />
          {t('privileges_page.add')}
        </Button>
      </div>

      {errorKey && !addOpen && <AlertBanner messageKey={errorKey} />}

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <Table columns={columns} rows={rows} emptyTitle={t('privileges_page.empty')} />
      )}

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title={t('privileges_page.add')}>
        <form onSubmit={handleSubmit(onCreate)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input
            label={t('privileges_page.key')}
            mono
            placeholder="dominio.accion"
            errorKey={errors.clave?.message}
            {...register('clave')}
          />
          <Input
            label={t('common:fields.name')}
            errorKey={errors.nombre?.message}
            {...register('nombre')}
          />
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-porcelain-border accent-emerald"
              {...register('sensible')}
            />
            {t('privileges_page.sensitive')}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setAddOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? t('common:loading') : t('common:actions.save')}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Consecuencias explícitas antes de deprecar (ImpactWarningDialog). */}
      <ConfirmDialog
        open={!!deprecating}
        onClose={() => setDeprecating(null)}
        onConfirm={onDeprecate}
        title={t('privileges_page.deprecate')}
        body={t('privileges_page.deprecate_impact', { n: deprecating?.enSubroles ?? 0 })}
        confirmLabel={t('privileges_page.deprecate')}
        danger
      />
    </div>
  );
}
