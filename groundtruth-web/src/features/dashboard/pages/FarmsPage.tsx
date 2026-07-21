import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PlusIcon, PencilSimpleIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { fetchFincas, fetchAgricultores, crearFinca, asignarAgricultorFinca, editarFinca } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { Finca, Agricultor } from '@/types/api';

const crearSchema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  pais: z.string().min(2, 'errors:field_required').max(2),
  areaHa: z.number().positive('errors:field_required'),
  agricultorId: z.string().uuid().optional().or(z.literal('')).transform(v => v || undefined),
});

type Formulario = z.infer<typeof crearSchema>;

const editarSchema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  pais: z.string().min(2, 'errors:field_required').max(2),
  areaHa: z.number().positive('errors:field_required'),
});

type EditarFormulario = z.infer<typeof editarSchema>;

const asignarSchema = z.object({
  agricultorId: z.string().uuid('errors:field_required'),
});

type AsignarFormulario = z.infer<typeof asignarSchema>;

/**
 * Fincas de la unidad (O4). Crear finca + asignar agricultor.
 */
export default function FarmsPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Finca | null>(null);
  const [assignOpen, setAssignOpen] = useState<Finca | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: fincas = [], isLoading: loadingFincas } = useQuery({
    queryKey: ['dashboard', 'fincas'],
    queryFn: fetchFincas,
  });

  const { data: agricultores = [], isLoading: loadingAgricultores } = useQuery({
    queryKey: ['dashboard', 'agricultores'],
    queryFn: fetchAgricultores,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(crearSchema),
    defaultValues: { nombre: '', pais: '', areaHa: 0, agricultorId: '' },
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

  const {
    register: registerAsignar,
    handleSubmit: handleSubmitAsignar,
    reset: resetAsignar,
    formState: { errors: errorsAsignar },
  } = useForm({
    resolver: zodResolver(asignarSchema),
    defaultValues: { agricultorId: '' },
  });

  const isLoading = loadingFincas || loadingAgricultores;

  async function onCreateFinca(values: Formulario) {
    setBusy(true);
    setErrorKey(null);
    try {
      await crearFinca(values);
      setCreateOpen(false);
      reset();
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'fincas'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

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

  async function onAssignAgricultor(values: AsignarFormulario) {
    if (!assignOpen) return;
    setBusy(true);
    setErrorKey(null);
    try {
      await asignarAgricultorFinca(assignOpen.id, values.agricultorId);
      setAssignOpen(null);
      resetAsignar();
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'fincas'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<Finca>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'agricultor', header: t('topology.farmer'), render: (r) => r.agricultor || <span className="text-graphite">{t('topology.unassigned')}</span> },
    { key: 'areaHa', header: t('topology.area'), align: 'right', mono: true, render: (r) => `${r.areaHa ? Number(r.areaHa).toFixed(2) : '—'} ha` },
    { key: 'pais', header: t('common:fields.country') },
    { key: 'parcelas', header: t('common:nav.parcels'), align: 'right', mono: true },
    { key: 'actions', header: '', align: 'right', render: (r) => (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          title="Editar finca"
          onClick={() => {
            setErrorKey(null);
            setEditing(r);
            resetEditar({ nombre: r.nombre, pais: '', areaHa: r.areaHa ?? 0 });
          }}>
          <PencilSimpleIcon size={14} />
        </Button>
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs"
          title="Asignar agricultor"
          onClick={() => {
            setErrorKey(null);
            setAssignOpen(r);
            resetAsignar({ agricultorId: '' });
          }}>
          {t('topology.farmer')}
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('topology.farms')}</h1>
        <Button onClick={() => { setErrorKey(null); setCreateOpen(true); }}>
          <PlusIcon size={16} />
          {t('topology.new_farm')}
        </Button>
      </div>

      {errorKey && <AlertBanner messageKey={errorKey} />}

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Table columns={columns} rows={fincas} emptyTitle={t('topology.no_farms')} />
      )}

      {/* Diálogo crear finca */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title={t('topology.new_farm')}>
        <form onSubmit={handleSubmit(onCreateFinca)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input label={t('common:fields.country')} placeholder="CR" errorKey={errors.pais?.message} {...register('pais')} />
          <Input
            label={t('topology.area')}
            type="number"
            step="0.01"
            min="0"
            placeholder="10.5"
            errorKey={errors.areaHa?.message}
            {...register('areaHa', { valueAsNumber: true })}
          />
          <Select
            label={t('topology.farmer')}
            placeholder={t('topology.optional')}
            options={agricultores.map((a) => ({ value: a.id, label: a.nombre }))}
            errorKey={errors.agricultorId?.message}
            {...register('agricultorId')}
          />
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

      {/* Diálogo editar finca */}
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={`Editar finca: ${editing?.nombre}`}>
        <form onSubmit={handleSubmitEditar(onEditarFinca)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Input label={t('common:fields.name')} errorKey={errorsEditar.nombre?.message} {...registerEditar('nombre')} />
          <Input label={t('common:fields.country')} placeholder="CR" errorKey={errorsEditar.pais?.message} {...registerEditar('pais')} />
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

      {/* Diálogo asignar agricultor */}
      <Dialog open={!!assignOpen} onClose={() => setAssignOpen(null)} title={t('topology.assign_farmer')}>
        <form onSubmit={handleSubmitAsignar(onAssignAgricultor)} className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <p className="text-sm text-graphite">
            Asignar un agricultor a la finca <strong>{assignOpen?.nombre}</strong>
          </p>
          <Select
            label={t('topology.farmer')}
            placeholder={t('topology.select_farmer')}
            options={agricultores.map((a) => ({ value: a.id, label: a.nombre }))}
            errorKey={errorsAsignar.agricultorId?.message}
            {...registerAsignar('agricultorId')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setAssignOpen(null)}>
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
