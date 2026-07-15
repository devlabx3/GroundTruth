import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import { fetchParcelas } from '../queries';
import type { Parcela } from '@/types/api';
import RealtimeIndicator from '@/components/shared/RealtimeIndicator';
import { useRealtimeInvalidation } from '@/lib/useRealtime';

/** Fincas y parcelas (O4). */
export default function TopologyPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Misma señal que el panel: el semáforo de la parcela cambió (migración 0011).
  const enVivo = useRealtimeInvalidation({
    tabla: 'parcelas',
    queryKey: ['dashboard', 'parcels'],
  });
  const { data: parcels, isLoading } = useQuery({
    queryKey: ['dashboard', 'parcels'],
    queryFn: fetchParcelas,
  });

  const columns: Column<Parcela>[] = [
    { key: 'core', header: '', render: (r) => <SoilCoreIndicator filled={r.filled} certified={r.certificada} size="sm" /> },
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'finca', header: t('topology.farm') },
    { key: 'cultivo', header: t('common:fields.crop'), render: (r) => t(`common:crops.${r.cultivo}`) },
    { key: 'areaHa', header: t('topology.area'), align: 'right', mono: true, render: (r) => `${r.areaHa} ${t('common:units.ha')}` },
    { key: 'sensores', header: t('topology.sensors'), align: 'right', mono: true, render: (r) => `${r.sensores}/${r.sensoresRequeridos}` },
    { key: 'estado', header: t('common:fields.state'), render: (r) => <StatusBadge status={r.estado} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl">{t('topology.title')}</h1>
          <RealtimeIndicator estado={enVivo} />
        </div>
        <Button onClick={() => navigate(`/${locale}/dashboard/topologia/nueva`)}>
          <PlusIcon size={16} />
          {t('topology.new_parcel')}
        </Button>
      </div>

      {location.state?.created && <AlertBanner tone="info" messageKey="dashboard:topology.created" />}

      {isLoading ? (
        <SkeletonRows rows={5} />
      ) : (
        <Table
          columns={columns}
          rows={parcels}
          onRowClick={(r) => navigate(`/${locale}/dashboard/topologia/${r.id}`)}
          emptyTitle={t('topology.empty')}
        />
      )}
    </div>
  );
}
