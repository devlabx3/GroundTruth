import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Textarea from '@/components/ui/Textarea';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import HashCompareRow from '@/components/shared/HashCompareRow';
import ExplorerLink from '@/components/shared/ExplorerLink';
import PrivilegeGate from '@/components/shared/PrivilegeGate';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';
import { PRIVILEGES } from '@/lib/privileges';
import { useRealSaga } from '@/lib/useRealSaga';
import { fetchCertificado, revocarCertificado } from '../queries';

/**
 * Detalle de certificado (O8): hashes verificables + explorer. Revocar exige
 * privilegio, motivo explícito y ConfirmDialog; corre saga de 2 pasos contra
 * el backend real (transacción + auditoría).
 */
export default function CertificateDetailPage() {
  const { t, i18n } = useTranslation(['dashboard', 'common']);
  const { locale, id } = useParams();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const saga = useRealSaga();

  const { data: cert, isLoading } = useQuery({
    queryKey: ['dashboard', 'certificate', id],
    queryFn: () => fetchCertificado(id!),
  });

  if (isLoading) return <SkeletonRows rows={5} />;
  if (!cert) {
    return (
      <EmptyState
        title={t('errors:cert_not_found', { ns: 'errors' })}
        action={
          <Link to={`/${locale}/dashboard/certificados`}>
            <Button variant="secondary">{t('common:actions.back')}</Button>
          </Link>
        }
      />
    );
  }

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'long', year: 'numeric' });

  function revoke() {
    setConfirmOpen(false);
    saga
      .start(
        [
          { key: 'record', labelKey: 'dashboard:onchain.step_revoke_record' },
          { key: 'chain', labelKey: 'dashboard:onchain.step_revoke_chain' },
        ],
        () => revocarCertificado(id!, reason),
      )
      .catch(() => {});
  }

  function closeSaga() {
    const wasDone = saga.done;
    saga.reset();
    if (wasDone) {
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'certificate', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'certificates'] });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Un certificado revocado SIEMPRE tiene fecha de revocación: el `?? Date.now()`
          que había aquí era impuro (cambia en cada render) y además tapaba el caso
          incoherente en vez de dejarlo ver. */}
      {cert.estado === 'revocado' && cert.revocadoEn && (
        <AlertBanner
          messageKey="dashboard:certificates.revoked_on"
          values={{ date: dateFmt.format(new Date(cert.revocadoEn)) }}
        />
      )}

      <Card className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-graphite">{t('certificates.number')}</div>
          <div className="font-mono text-2xl text-gold">{cert.numeroPublico}</div>
        </div>
        <StatusBadge status={cert.estado} />
      </Card>

      <Card>
        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Meta label={t('common:nav.parcels')} value={cert.parcela} />
          <Meta label={t('common:fields.crop')} value={cert.cultivo ? t(`common:crops.${cert.cultivo}`) : '—'} />
          <Meta label={t('certificates.issued_on')} value={cert.emitido ? dateFmt.format(new Date(cert.emitido)) : '—'} mono />
          <Meta label={t('certificates.valid_until')} value={cert.vigenciaHasta ? dateFmt.format(new Date(cert.vigenciaHasta)) : '—'} mono />
        </dl>
      </Card>

      <Card>
        <div className="mb-1 text-xs text-graphite">{t('certificates.integrity')}</div>
        {cert.hashes ? (
          <>
            <HashCompareRow label={t('common:hash.pdf')} onchain={cert.hashes.pdf.onchain} computed={cert.hashes.pdf.computed} />
            <HashCompareRow label={t('common:hash.img')} onchain={cert.hashes.img.onchain} computed={cert.hashes.img.computed} />
            <div className="mt-3 flex flex-wrap gap-4">
              {cert.assetId && <ExplorerLink type="address" value={cert.assetId} />}
              {cert.tx && <ExplorerLink type="tx" value={cert.tx} />}
            </div>
          </>
        ) : (
          <p className="text-sm text-graphite">{t('certificates.integrity_pending')}</p>
        )}
      </Card>

      {cert.estado === 'vigente' && (
        <PrivilegeGate privilege={PRIVILEGES.CERTS_REVOKE}>
          <div className="flex justify-end">
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              {t('certificates.revoke')}
            </Button>
          </div>
        </PrivilegeGate>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={revoke}
        title={t('certificates.revoke')}
        body={t('certificates.revoke_confirm')}
        confirmLabel={t('certificates.revoke')}
        confirmDisabled={reason.trim().length === 0}
        danger
      >
        <Textarea
          label={t('certificates.revoke_reason')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-3"
        />
      </ConfirmDialog>

      <OnchainProgressModal
        open={saga.open}
        titleKey="dashboard:certificates.revoke"
        steps={saga.steps}
        canDismiss={saga.done || saga.failed}
        onDismiss={closeSaga}
      />
    </div>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 sm:block">
      <dt className="text-xs text-graphite">{label}</dt>
      <dd className={`text-ink ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
