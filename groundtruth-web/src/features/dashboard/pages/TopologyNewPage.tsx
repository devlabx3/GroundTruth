import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { PlusIcon, XIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import ErrorInline from '@/components/shared/ErrorInline';
import AlertBanner from '@/components/shared/AlertBanner';
import ParcelMap, { CENTRO_DEFECTO, areaHaFromPoints } from '@/components/shared/ParcelMap';
import { zodResolver } from '@/lib/zodResolver';
import { CROPS, HA_POR_SENSOR } from '../fixtures';
import { fetchFincas, crearParcela } from '../queries';
import { errorKey as claveDeError, errorValues as valoresDeError } from '@/lib/api';
import type { LatLng } from '@/types/api';

const schema = z.object({
  fincaId: z.string().min(1, 'errors:field_required'),
  nombre: z.string().min(1, 'errors:field_required'),
  cultivo: z.string().min(1, 'errors:crop_required'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/**
 * Nueva parcela (O4): el polígono se dibuja en el mapa (clic = vértice) y el área
 * sale del polígono — de ahí los sensores mínimos (área/haPorSensor).
 *
 * El área que se ve aquí es una **estimación** para guiar el dibujo: la buena la
 * calcula PostGIS, y es el servidor quien impone el gate de cobertura y rechaza un
 * polígono inválido. Este gate del cliente solo evita un viaje inútil.
 *
 * Los nodos se declaran (no se "asignan" de una lista libre): en el modelo un nodo
 * pertenece a una parcela, así que nacen con ella.
 */
export default function TopologyNewPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [points, setPoints] = useState<LatLng[]>([]);
  const [nodos, setNodos] = useState<string[]>([]);
  const [nodoNuevo, setNodoNuevo] = useState('');
  const [polygonError, setPolygonError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorValues, setErrorValues] = useState<Record<string, unknown>>({});

  const { data: fincas = [] } = useQuery({
    queryKey: ['dashboard', 'fincas'],
    queryFn: fetchFincas,
  });

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { fincaId: '', nombre: '', cultivo: '' },
  });

  const areaHa = areaHaFromPoints(points);
  const required = areaHa > 0 ? Math.ceil(areaHa / HA_POR_SENSOR) : 0;
  const coverageOk = required > 0 && nodos.length >= required;
  const areaFmt = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });

  function updatePoints(next: LatLng[]) {
    setPolygonError(false);
    setPoints(next);
  }

  function addNodo() {
    const id = nodoNuevo.trim();
    if (!id || nodos.includes(id)) return;
    setNodos((prev) => [...prev, id]);
    setNodoNuevo('');
  }

  async function onSubmit(values: Formulario) {
    if (points.length < 3) {
      setPolygonError(true); // inline en el mapa (Errores §5.3)
      return;
    }
    setBusy(true);
    setErrorKey(null);
    try {
      await crearParcela({ ...values, poligono: points, nodos });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'parcelas'] });
      navigate(`/${locale}/dashboard/topologia`, { state: { created: true } });
    } catch (e) {
      // El servidor manda: si su PostGIS dice que no hay cobertura o que el
      // polígono es inválido, se muestra su error aunque el gate local pasara.
      // Y con SU número de sensores: el área real casi nunca es la estimada aquí.
      setErrorKey(claveDeError(e));
      setErrorValues(valoresDeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('topology.new_parcel')}</h1>

      {errorKey && <AlertBanner messageKey={errorKey} values={errorValues} />}

      <Card>
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-xs text-graphite">{t('topology.draw_hint')}</span>
          {points.length > 0 && (
            <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => updatePoints([])}>
              {t('topology.clear_polygon')}
            </Button>
          )}
        </div>
        <ParcelMap
          center={CENTRO_DEFECTO}
          zoom={14}
          height={300}
          drawPoints={points}
          onDrawChange={updatePoints}
        />
        {polygonError && <ErrorInline messageKey="dashboard:topology.invalid_polygon" />}
        <div className="mt-2 font-mono text-xs text-graphite">
          {t('topology.area')}: {areaFmt.format(areaHa)} {t('common:units.ha')}
        </div>
      </Card>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card className="grid gap-4 md:grid-cols-2">
          <Select
            label={t('topology.farm')}
            placeholder={t('topology.select_farm')}
            options={fincas.map((f) => ({ value: f.id, label: f.nombre }))}
            errorKey={errors.fincaId?.message}
            {...register('fincaId')}
          />
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Select
            label={t('common:fields.crop')}
            placeholder={t('topology.select_crop')}
            options={CROPS.map((c) => ({ value: c, label: t(`common:crops.${c}`) }))}
            errorKey={errors.cultivo?.message}
            {...register('cultivo')}
          />
        </Card>

        <Card>
          <div className="text-xs text-graphite">{t('topology.declare_nodes')}</div>

          <div className="mt-3 flex gap-2">
            <Input
              mono
              placeholder="nodo-D1"
              value={nodoNuevo}
              onChange={(e) => setNodoNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addNodo();
                }
              }}
              className="flex-1"
            />
            <Button type="button" variant="secondary" onClick={addNodo} disabled={!nodoNuevo.trim()}>
              <PlusIcon size={16} />
              {t('common:actions.add')}
            </Button>
          </div>

          {nodos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nodos.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-porcelain-border bg-porcelain px-3 py-1 font-mono text-xs text-ink"
                >
                  {id}
                  <button
                    type="button"
                    onClick={() => setNodos((prev) => prev.filter((n) => n !== id))}
                    aria-label={t('common:actions.delete')}
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {required > 0 && !coverageOk && (
            <div className="mt-3">
              <AlertBanner messageKey="dashboard:topology.sensor_gate" values={{ n: required }} />
            </div>
          )}
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={() => navigate(`/${locale}/dashboard/topologia`)}>
            {t('common:actions.cancel')}
          </Button>
          <Button type="submit" disabled={busy || (points.length >= 3 && !coverageOk)}>
            {busy ? t('common:loading') : t('common:actions.save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
