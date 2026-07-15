import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { fetchParametros, actualizarParametros, fetchParametrosAuditoria } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { EntradaAuditoria, Parametros, UmbralesCultivo } from '@/types/api';

/**
 * Parámetros del sistema (A4): tarifas, sensores, vigencia y umbrales POR cultivo.
 *
 * No es un formulario decorativo: la certificación lee estos mismos valores al
 * cobrar y al fijar la vigencia del certificado. Los umbrales son provisionales
 * por diseño (a calibrar en terreno) y nunca viven on-chain. Todo cambio queda
 * versionado en la bitácora, que la escribe el servidor.
 */
export default function AdminParamsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'parametros'],
    queryFn: fetchParametros,
  });

  if (isLoading || !data) return <SkeletonRows rows={5} />;

  // El formulario se monta CON los datos ya cargados. Antes se sincronizaba el
  // estado dentro de un useEffect, lo que dispara un render en cascada por cada
  // carga; aquí no hace falta efecto ninguno.
  return <ParamsForm inicial={data} />;
}

function ParamsForm({ inicial }: { inicial: Parametros }) {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => structuredClone(inicial));
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: audit = [] } = useQuery({
    queryKey: ['admin', 'parametros', 'auditoria'],
    queryFn: fetchParametrosAuditoria,
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  /**
   * Escritura por ruta ('cultivos.cafe.phMin'). El recorrido es dinámico por
   * naturaleza, así que aquí SÍ hay un cast: está acotado a esta función y el
   * formulario entero sigue tipado como `Parametros` hacia fuera.
   */
  function update(path: string, value: string) {
    setForm((prev) => {
      const next = structuredClone(prev);
      const keys = path.split('.');
      let obj = next as unknown as Record<string, unknown>;
      while (keys.length > 1) obj = obj[keys.shift()!] as Record<string, unknown>;
      obj[keys[0]] = value;
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setErrorKey(null);
    setSaved(false);
    try {
      await actualizarParametros(form);
      queryClient.invalidateQueries({ queryKey: ['admin', 'parametros'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e) {
      // El backend valida los rangos (min < max, pH 0–14…) y devuelve
      // PARAM_OUT_OF_RANGE: mostramos su clave, sin revalidar aquí.
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  const auditColumns: Column<EntradaAuditoria>[] = [
    {
      key: 'fecha',
      header: t('common:fields.date'),
      mono: true,
      render: (r) => dateFmt.format(new Date(r.fecha)),
    },
    {
      key: 'cambios',
      header: t('params.changes'),
      render: (r) => (
        <ul className="flex flex-col gap-0.5">
          {r.cambios.map((c) => (
            <li key={c.campo} className="font-mono text-xs">
              <span className="text-graphite">{c.campo}:</span> {String(c.antes)} → {String(c.despues)}
            </li>
          ))}
        </ul>
      ),
    },
    { key: 'quien', header: t('params.who') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('params.title')}</h1>
      {saved && <AlertBanner tone="info" messageKey="admin:params.saved" />}
      {errorKey && <AlertBanner messageKey={errorKey} />}

      <Card className="flex flex-col gap-4">
        <div className="text-xs text-graphite">{t('params.section_pricing')}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('params.cert_fee')}
            type="number" step="0.5" min="0" mono
            value={form.tarifas.certificacionUsdc}
            onChange={(e) => update('tarifas.certificacionUsdc', e.target.value)}
          />
          <Input
            label={t('params.manifest_fee')}
            type="number" step="0.5" min="0" mono
            value={form.tarifas.manifiestoUsdc}
            onChange={(e) => update('tarifas.manifiestoUsdc', e.target.value)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <div className="text-xs text-graphite">{t('params.section_sensors')}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('params.ha_per_sensor')}
            type="number" step="0.5" min="0.5" mono
            value={form.haPorSensor}
            onChange={(e) => update('haPorSensor', e.target.value)}
          />
        </div>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="text-xs text-graphite">{t('params.section_thresholds')}</div>
        {(Object.entries(form.cultivos) as [string, UmbralesCultivo][]).map(([crop, u]) => (
          <div key={crop} className="rounded-card border border-porcelain-border p-3">
            <div className="mb-2 text-sm font-medium text-ink">{t(`common:crops.${crop}`)}</div>
            <div className="grid gap-3 sm:grid-cols-5">
              <Input
                label={t('params.validity_days')}
                type="number" min="1" mono
                value={u.vigenciaDias}
                onChange={(e) => update(`cultivos.${crop}.vigenciaDias`, e.target.value)}
              />
              <Input label={t('params.ph_min')} type="number" step="0.1" mono value={u.phMin} onChange={(e) => update(`cultivos.${crop}.phMin`, e.target.value)} />
              <Input label={t('params.ph_max')} type="number" step="0.1" mono value={u.phMax} onChange={(e) => update(`cultivos.${crop}.phMax`, e.target.value)} />
              <Input label={t('params.humidity_min')} type="number" mono value={u.humedadMin} onChange={(e) => update(`cultivos.${crop}.humedadMin`, e.target.value)} />
              <Input label={t('params.humidity_max')} type="number" mono value={u.humedadMax} onChange={(e) => update(`cultivos.${crop}.humedadMax`, e.target.value)} />
            </div>
          </div>
        ))}
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={busy}>
          {busy ? t('common:loading') : t('common:actions.save')}
        </Button>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink">{t('params.audit')}</h2>
        <Table columns={auditColumns} rows={audit} emptyTitle={t('params.audit_empty')} />
      </section>
    </div>
  );
}
