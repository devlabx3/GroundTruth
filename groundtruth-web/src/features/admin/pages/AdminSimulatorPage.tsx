import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LightningIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Dialog from '@/components/ui/Dialog';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { fetchNodos, activarNodo, generarLecturas } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { NodoSimulado, PerfilSimulacion } from '@/types/api';

/**
 * Simulador IoT (A5). Los nodos SIMULADO producen la misma telemetría que
 * producirá el hardware LoRaWAN: el backend la evalúa contra los umbrales del
 * cultivo y, si sale ROJO, levanta la alerta que verá el agricultor en su dApp.
 * No es un juguete de demo — es el generador de la evidencia de la que cuelga
 * la certificación.
 */
export default function AdminSimulatorPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const queryClient = useQueryClient();
  const [genOpen, setGenOpen] = useState(false);
  const [parcelaId, setParcelaId] = useState('');
  const [perfil, setPerfil] = useState<PerfilSimulacion>('sano');
  const [horas, setHoras] = useState<number | string>(24);
  const [busy, setBusy] = useState(false);
  const [resultKey, setResultKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['admin', 'nodos'],
    queryFn: fetchNodos,
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  // Parcelas que tienen nodos: son las únicas sobre las que se puede generar.
  const parcelas = useMemo(() => {
    const map = new Map();
    for (const n of nodes) if (!map.has(n.parcelaId)) map.set(n.parcelaId, `${n.unidad} · ${n.parcela}`);
    return [...map.entries()].map(([value, label]) => ({ value, label }));
  }, [nodes]);

  async function toggle(node: NodoSimulado) {
    await activarNodo(node.id, !node.activo);
    queryClient.invalidateQueries({ queryKey: ['admin', 'nodos'] });
  }

  async function generar() {
    setBusy(true);
    setErrorKey(null);
    setResultKey(null);
    try {
      const r = await generarLecturas(parcelaId, perfil, Number(horas));
      setGenOpen(false);
      setResultKey(r.estado === 'alerta' ? 'admin:simulator.generated_alert' : 'admin:simulator.generated_ok');
      setTimeout(() => setResultKey(null), 6000);
      queryClient.invalidateQueries({ queryKey: ['admin', 'nodos'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'parcelas'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<NodoSimulado>[] = [
    { key: 'externalId', header: t('simulator.node'), mono: true },
    { key: 'parcela', header: t('common:nav.parcels') },
    { key: 'unidad', header: t('units.unit') },
    {
      key: 'ultimaLectura',
      header: t('simulator.last_reading'),
      mono: true,
      render: (r) => (r.ultimaLectura ? dateFmt.format(new Date(r.ultimaLectura)) : '—'),
    },
    {
      key: 'activo',
      header: t('common:fields.state'),
      render: (r) => (
        <button
          onClick={() => toggle(r)}
          className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${
            r.activo
              ? 'bg-emerald-100 text-emerald'
              : 'bg-porcelain text-graphite border border-porcelain-border'
          }`}
        >
          {r.activo ? t('simulator.on') : t('simulator.off')}
        </button>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('simulator.title')}</h1>
        <Button
          variant="secondary"
          disabled={parcelas.length === 0}
          onClick={() => {
            setErrorKey(null);
            setParcelaId(parcelas[0]?.value ?? '');
            setGenOpen(true);
          }}
        >
          <LightningIcon size={16} />
          {t('simulator.generate')}
        </Button>
      </div>

      {resultKey && <AlertBanner tone="info" messageKey={resultKey} />}
      {errorKey && !genOpen && <AlertBanner messageKey={errorKey} />}

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <Table columns={columns} rows={nodes} emptyTitle={t('simulator.empty')} />
      )}

      <Dialog open={genOpen} onClose={() => setGenOpen(false)} title={t('simulator.generate')}>
        <div className="flex flex-col gap-4">
          {errorKey && <AlertBanner messageKey={errorKey} />}
          <Select
            label={t('common:nav.parcels')}
            options={parcelas}
            value={parcelaId}
            onChange={(e) => setParcelaId(e.target.value)}
          />
          <Select
            label={t('simulator.profile')}
            options={[
              { value: 'sano', label: t('simulator.profile_healthy') },
              { value: 'degradado', label: t('simulator.profile_degraded') },
            ]}
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as PerfilSimulacion)}
          />
          <Input
            label={t('simulator.hours')}
            type="number"
            min="1"
            max="72"
            mono
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setGenOpen(false)}>
              {t('common:actions.cancel')}
            </Button>
            <Button onClick={generar} disabled={busy || !parcelaId}>
              {busy ? t('common:loading') : t('simulator.generate')}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
