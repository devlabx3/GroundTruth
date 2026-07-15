import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import CycleHistoryList from '@/components/shared/CycleHistoryList';
import { fetchParcela } from '../queries';

/** Detalle de parcela del agricultor (F3, F4, F5). */
export default function FarmerParcelDetailPage() {
  const { t } = useTranslation(['farmer', 'common']);
  const { locale, id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: parcel, isLoading } = useQuery({
    queryKey: ['farmer', 'parcel', id],
    queryFn: () => fetchParcela(id!),
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  if (!parcel) {
    // 404 de recurso → estado vacío específico + navegación válida (Errores §2).
    return (
      <EmptyState
        title={t('errors:not_found', { ns: 'errors' })}
        action={
          <Link to={`/${locale}/dapp/parcelas`}>
            <Button variant="secondary">{t('common:actions.back')}</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {location.state?.planted && <AlertBanner tone="info" messageKey="farmer:new_planting.success" />}

      <Card className="flex items-center gap-4">
        <SoilCoreIndicator filled={parcel.filled} certified={parcel.certificada} size="lg" />
        <div className="flex-1">
          <h2 className="text-xl">{parcel.nombre}</h2>
          <div className="mt-1 font-mono text-xs text-graphite">
            {t(`common:crops.${parcel.cultivo}`)} · {parcel.areaHa} {t('common:units.ha')}
          </div>
        </div>
        <StatusBadge status={parcel.estado} />
      </Card>

      <Card>
        <div className="mb-2 text-xs text-graphite">{t('parcels.history')}</div>
        <CycleHistoryList cycles={parcel.ciclos} />
      </Card>

      <Button onClick={() => navigate(`/${locale}/dapp/parcelas/${parcel.id}/nueva-siembra`)}>
        {t('new_planting.action')}
      </Button>
    </div>
  );
}
