import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { COUNTRIES } from '@/lib/countries';
import { fetchFincas, editarFinca } from '../queries';
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

  const { data: fincas = [], isLoading: loadingFincas } = useQuery({
    queryKey: ['dashboard', 'fincas'],
    queryFn: fetchFincas,
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

  const columns: Column<Finca>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'agricultor', header: t('topology.farmer'), render: (r) => r.agricultor ? (
      <div className="flex flex-col">
        <span>{r.agricultor}</span>
        {r.agricultorEmail && <span className="text-xs text-graphite">{r.agricultorEmail}</span>}
      </div>
    ) : <span className="text-graphite">{t('topology.unassigned')}</span> },
    { key: 'areaHa', header: t('topology.area'), align: 'right', mono: true, render: (r) => `${r.areaHa ? Number(r.areaHa).toFixed(2) : '—'} ha` },
    { key: 'pais', header: t('common:fields.country') },
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

      {loadingFincas ? (
        <SkeletonRows rows={4} />
      ) : (
        <Table columns={columns} rows={fincas} emptyTitle={t('topology.no_farms')} />
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
