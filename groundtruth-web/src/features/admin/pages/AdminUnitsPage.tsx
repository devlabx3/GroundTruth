import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { fetchUnidades } from '../queries';
import type { UnidadResumen } from '@/types/api';

/** Estado de la unidad: activa / suspendida / pendiente de tesorería on-chain. */
const ESTADO_CLS = {
  activa: 'bg-emerald-100 text-emerald',
  suspendida: 'bg-sealwax-100 text-sealwax',
  pendiente: 'bg-porcelain text-graphite border border-porcelain-border',
};

/** Unidades de negocio (A1). */
export default function AdminUnitsPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const { data: units, isLoading } = useQuery({
    queryKey: ['admin', 'unidades'],
    queryFn: fetchUnidades,
  });

  const numFmt = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2 });
  const columns: Column<UnidadResumen>[] = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'pais', header: t('units.country') },
    { key: 'parcelas', header: t('common:nav.parcels'), align: 'right', mono: true },
    { key: 'saldoUsdc', header: t('units.balance'), align: 'right', render: (r) => (
      <span className="font-mono text-xs">{numFmt.format(r.saldoUsdc)} USDC</span>
    ) },
    { key: 'estado', header: t('common:fields.state'), render: (r) => (
      <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${ESTADO_CLS[r.estado]}`}>
        {t(`units.state.${r.estado}`)}
      </span>
    ) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{t('units.title')}</h1>
        <Button onClick={() => navigate(`/${locale}/admin/unidades/nueva`)}>
          <PlusIcon size={16} />
          {t('units.new')}
        </Button>
      </div>
      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <Table
          columns={columns}
          rows={units}
          onRowClick={(r) => navigate(`/${locale}/admin/unidades/${r.id}`)}
          emptyTitle={t('units.empty')}
        />
      )}
    </div>
  );
}
