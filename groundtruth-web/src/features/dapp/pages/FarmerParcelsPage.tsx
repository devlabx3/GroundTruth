import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CaretRightIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import { fetchParcelas } from '../queries';

/** Mis parcelas (F3). GET /farmer/parcelas. */
export default function FarmerParcelsPage() {
  const { t } = useTranslation(['farmer', 'common']);
  const { locale } = useParams();
  const { data: parcels, isLoading } = useQuery({
    queryKey: ['farmer', 'parcels'],
    queryFn: fetchParcelas,
  });

  return (
    <div>
      <h2 className="mb-3 text-xl">{t('parcels.title')}</h2>
      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (parcels ?? []).length === 0 ? (
        <EmptyState title={t('parcels.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {(parcels ?? []).map((p) => (
            <Link key={p.id} to={`/${locale}/dapp/parcelas/${p.id}`}>
              <Card className="flex items-center gap-4 transition-colors hover:border-emerald">
                <SoilCoreIndicator filled={p.filled} certified={p.certificada} size="sm" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">{p.nombre}</div>
                  <div className="mt-0.5 font-mono text-xs text-graphite">
                    {t(`common:crops.${p.cultivo}`)} · {p.areaHa} {t('common:units.ha')}
                  </div>
                </div>
                <StatusBadge status={p.estado} />
                <CaretRightIcon size={16} className="text-graphite" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
