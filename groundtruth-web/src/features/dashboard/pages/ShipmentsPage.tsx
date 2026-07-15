import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { SkeletonRows } from '@/components/ui/Skeleton';
import ShipmentStateBadge from '../components/ShipmentStateBadge';
import { fetchEmbarques } from '../queries';
import type { EmbarqueResumen } from '@/types/api';

/** Embarques (O7). */
export default function ShipmentsPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const { data: shipments, isLoading } = useQuery({
    queryKey: ['dashboard', 'shipments'],
    queryFn: fetchEmbarques,
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
  const shortId = (id: string) => (id.length > 12 ? `${id.slice(0, 8)}…` : id);
  const columns: Column<EmbarqueResumen>[] = [
    { key: 'id', header: 'ID', mono: true, render: (r) => shortId(r.id) },
    { key: 'cultivo', header: t('common:fields.crop'), render: (r) => t(`common:crops.${r.cultivo}`) },
    { key: 'parcelas', header: t('common:nav.parcels'), align: 'right', mono: true, render: (r) => r.numParcelas },
    { key: 'fecha', header: t('common:fields.date'), mono: true, render: (r) => dateFmt.format(new Date(r.fecha)) },
    { key: 'estado', header: t('common:fields.state'), render: (r) => <ShipmentStateBadge estado={r.estado} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('shipments.title')}</h1>
        <Button onClick={() => navigate(`/${locale}/dashboard/embarques/nuevo`)}>
          <PlusIcon size={16} />
          {t('shipments.new')}
        </Button>
      </div>

      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <Table
          columns={columns}
          rows={shipments}
          onRowClick={(r) => navigate(`/${locale}/dashboard/embarques/${r.id}`)}
          emptyTitle={t('shipments.empty')}
        />
      )}
    </div>
  );
}
