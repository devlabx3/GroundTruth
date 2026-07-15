import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Table from '@/components/ui/Table';
import type { Column } from '@/components/ui/Table';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import Textarea from '@/components/ui/Textarea';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonRows } from '@/components/ui/Skeleton';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';
import { useRealSaga } from '@/lib/useRealSaga';
import { fetchCertificadosGlobales, revocarCertificadoGlobal } from '../queries';
import type { CertificadoGlobal } from '@/types/api';

/**
 * Revocación global (A8): el admin revoca certificados de cualquier unidad.
 * Ejecuta la MISMA revocación del operador (transacción + auditoría); el admin
 * solo elimina la restricción de unidad, no duplica la lógica.
 */
export default function AdminCertificatesPage() {
  const { t, i18n } = useTranslation(['admin', 'dashboard', 'common']);
  const queryClient = useQueryClient();
  const [revoking, setRevoking] = useState<CertificadoGlobal | null>(null);
  const [reason, setReason] = useState('');
  const saga = useRealSaga();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'certificados'],
    queryFn: fetchCertificadosGlobales,
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  async function confirmRevoke() {
    // Sin certificado seleccionado no hay nada que revocar. El corte va ANTES de
    // tocar el estado de la UI: si no, el diálogo quedaría a medio cerrar.
    const target = revoking;
    if (!target) return;
    const motivo = reason;
    setRevoking(null);
    setReason('');
    try {
      await saga.start(
        [
          { key: 'record', labelKey: 'dashboard:onchain.step_revoke_record' },
          { key: 'chain', labelKey: 'dashboard:onchain.step_revoke_chain' },
        ],
        () => revocarCertificadoGlobal(target.id, motivo),
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'certificados'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    } catch {
      // El modal muestra el paso fallido con su clave de error.
    }
  }

  const columns: Column<CertificadoGlobal>[] = [
    {
      key: 'numeroPublico',
      header: t('dashboard:certificates.number'),
      render: (r) => <span className="font-mono text-xs text-gold">{r.numeroPublico}</span>,
    },
    { key: 'unidad', header: t('units.unit') },
    { key: 'parcela', header: t('common:nav.parcels') },
    {
      key: 'emitido',
      header: t('dashboard:certificates.issued_on'),
      mono: true,
      render: (r) => (r.emitido ? dateFmt.format(new Date(r.emitido)) : '—'),
    },
    { key: 'estado', header: t('common:fields.state'), render: (r) => <StatusBadge status={r.estado} /> },
    { key: 'actions', header: '', align: 'right', render: (r) =>
      r.estado === 'vigente' ? (
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => setRevoking(r)}>
          {t('dashboard:certificates.revoke')}
        </Button>
      ) : null },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('certificates.title')}</h1>

      {isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <Table columns={columns} rows={rows} emptyTitle={t('certificates.empty')} />
      )}

      <ConfirmDialog
        open={!!revoking}
        onClose={() => { setRevoking(null); setReason(''); }}
        onConfirm={confirmRevoke}
        title={t('dashboard:certificates.revoke')}
        body={t('dashboard:certificates.revoke_confirm')}
        confirmLabel={t('dashboard:certificates.revoke')}
        confirmDisabled={reason.trim().length === 0}
        danger
      >
        <Textarea
          label={t('dashboard:certificates.revoke_reason')}
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
        onDismiss={saga.reset}
      />
    </div>
  );
}
