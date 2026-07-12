import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';

export default function DashboardHome() {
  const { t } = useTranslation('dashboard');
  const metrics = [
    { key: 'active_parcels', value: 128 },
    { key: 'certificates_issued', value: 342 },
    { key: 'open_alerts', value: 3, alert: true },
  ];
  const recent = [
    { id: 1, nombre: 'La Esperanza · 03', estado: 'conforme', filled: 4 },
    { id: 2, nombre: 'El Mirador · 07', estado: 'pendiente', filled: 2 },
    { id: 3, nombre: 'Alto Verde · 01', estado: 'alerta', filled: 4 },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.key}>
            <div className="text-xs text-graphite">{t(`metrics.${m.key}`)}</div>
            <div className={`mt-1 text-3xl ${m.alert ? 'text-sealwax' : 'text-ink'}`}>{m.value}</div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-2 text-xs text-graphite">{t('map.title')}</div>
          <div className="grid h-48 place-items-center rounded-card border border-dashed border-porcelain-border text-sm text-graphite">
            Mapa Leaflet (parcelas verde/rojo)
          </div>
        </Card>
        <Card>
          <div className="mb-3 text-xs text-graphite">{t('map.recent')}</div>
          <div className="flex flex-col gap-3">
            {recent.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <SoilCoreIndicator filled={p.filled} certified={p.filled === 4 && p.estado === 'conforme'} size="sm" />
                <span className="flex-1 text-sm text-ink">{p.nombre}</span>
                <StatusBadge status={p.estado} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
