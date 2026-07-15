import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { fetchCertificados } from '../queries';
import type { CertificadoResumen } from '@/types/api';

/** Certificados de la unidad (O8). El Nº de certificado va en oro (regla del oro). */
export default function CertificatesPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const { data: certs, isLoading } = useQuery({
    queryKey: ['dashboard', 'certificates'],
    queryFn: fetchCertificados,
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
  const shortId = (v: string) => (v && v.length > 12 ? `${v.slice(0, 8)}…` : v ?? '—');
  const columns: Column<CertificadoResumen>[] = [
    { key: 'numeroPublico', header: t('certificates.number'), render: (r) => <span className="font-mono text-xs text-gold">{r.numeroPublico}</span> },
    { key: 'parcela', header: t('common:nav.parcels') },
    { key: 'embarque', header: t('shipments.title'), mono: true, render: (r) => (r.embarque ? shortId(r.embarque) : '—') },
    { key: 'emitido', header: t('certificates.issued_on'), mono: true, render: (r) => (r.emitido ? dateFmt.format(new Date(r.emitido)) : '—') },
    { key: 'vigenciaHasta', header: t('certificates.valid_until'), mono: true, render: (r) => (r.vigenciaHasta ? dateFmt.format(new Date(r.vigenciaHasta)) : '—') },
    { key: 'estado', header: t('common:fields.state'), render: (r) => <StatusBadge status={r.estado} /> },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('certificates.title')}</h1>
      {isLoading ? (
        <SkeletonRows rows={3} />
      ) : (
        <Table
          columns={columns}
          rows={certs}
          onRowClick={(r) => navigate(`/${locale}/dashboard/certificados/${r.id}`)}
          emptyTitle={t('certificates.empty')}
        />
      )}
    </div>
  );
}
