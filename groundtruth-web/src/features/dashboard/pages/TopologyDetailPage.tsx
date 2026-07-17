import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import CycleHistoryList from '@/components/shared/CycleHistoryList';
import ParcelMap from '@/components/shared/ParcelMap';
import TelemetryChart from '../components/TelemetryChart';
import { fetchParcela } from '../queries';

/** Detalle / telemetría de parcela (O4, O6). Con backend: Realtime de lecturas. */
export default function TopologyDetailPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale, id } = useParams();
  const { data: parcel, isLoading } = useQuery({
    queryKey: ['dashboard', 'parcel', id],
    queryFn: () => fetchParcela(id!),
  });

  if (isLoading) return <SkeletonRows rows={5} />;
  if (!parcel) {
    return (
      <EmptyState
        title={t('errors:not_found', { ns: 'errors' })}
        action={
          <Link to={`/${locale}/dashboard/topologia`}>
            <Button variant="secondary">{t('common:actions.back')}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center gap-4">
        <SoilCoreIndicator filled={parcel.filled} certified={parcel.certificada} size="lg" />
        <div className="flex-1">
          <h1 className="text-2xl">{parcel.nombre}</h1>
          <div className="mt-1 font-mono text-xs text-graphite">
            {parcel.finca} · {t(`common:crops.${parcel.cultivo}`)} · {parcel.areaHa} {t('common:units.ha')} ·{' '}
            {parcel.sensores}/{parcel.sensoresRequeridos} {t('topology.sensors').toLowerCase()}
          </div>
        </div>
        <StatusBadge status={parcel.estado} />
      </Card>

      <Card>
        <div className="mb-2 text-xs text-graphite">{t('map.title')}</div>
        <ParcelMap center={parcel.centro} zoom={15} height={280} polygon={parcel.poligono} />
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs text-graphite">{t('telemetry.title')}</span>
          {parcel.fuenteSimulada && (
            <span className="text-xs text-graphite italic">{t('telemetry.simulated_source')}</span>
          )}
        </div>
        {parcel.telemetria ? (
          <TelemetryChart telemetria={parcel.telemetria} />
        ) : (
          <p className="text-sm text-graphite">{t('telemetry.no_data')}</p>
        )}
      </Card>

      <Card>
        <div className="mb-2 text-xs text-graphite">{t('topology.cycle_history')}</div>
        <CycleHistoryList cycles={parcel.ciclos} />
      </Card>
    </div>
  );
}
