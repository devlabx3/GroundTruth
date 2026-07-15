import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DownloadSimpleIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import PrivilegeGate from '@/components/shared/PrivilegeGate';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';
import { PRIVILEGES } from '@/lib/privileges';
import { useRealSaga } from '@/lib/useRealSaga';
import CostPreviewCard from '../components/CostPreviewCard';
import ShipmentStateBadge from '../components/ShipmentStateBadge';
import { fetchEmbarque, certificarEmbarque } from '../queries';

/**
 * Detalle de embarque (O7): ver con `embarques.preparar`, ejecutar con
 * `certificados.emitir`. Sin el privilegio: aviso "listo para aprobación"
 * (Errores §5.4). La emisión corre el saga de 5 pasos contra el backend real,
 * atómico e idempotente (débito de tesorería + emisión).
 */
export default function ShipmentDetailPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale, id } = useParams();
  const queryClient = useQueryClient();
  const saga = useRealSaga();

  const { data: shipment, isLoading } = useQuery({
    queryKey: ['dashboard', 'shipment', id],
    queryFn: () => fetchEmbarque(id!),
  });

  if (isLoading) return <SkeletonRows rows={5} />;
  if (!shipment) {
    return (
      <EmptyState
        title={t('errors:not_found', { ns: 'errors' })}
        action={
          <Link to={`/${locale}/dashboard/embarques`}>
            <Button variant="secondary">{t('common:actions.back')}</Button>
          </Link>
        }
      />
    );
  }

  const { estado, parcelas, certificados } = shipment;
  const nuevos = parcelas.filter((p) => !p.certificada).length;

  function issue() {
    saga
      .start(
        [
          { key: 'validate', labelKey: 'dashboard:onchain.step_validate' },
          { key: 'satellite', labelKey: 'dashboard:onchain.step_satellite' },
          { key: 'arweave', labelKey: 'dashboard:onchain.step_arweave' },
          {
            key: 'mint',
            labelKey: 'dashboard:onchain.step_mint',
            detail: `-${nuevos * 5 + 2} USDC`,
          },
          { key: 'manifest', labelKey: 'dashboard:onchain.step_manifest' },
        ],
        () => certificarEmbarque(id!),
      )
      .catch(() => {}); // el error ya quedó pintado en el paso del modal
  }

  function closeSaga() {
    const wasDone = saga.done;
    saga.reset();
    if (wasDone) {
      // Refrescar: el embarque pasó a emitido, el saldo bajó, hay certificados.
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'shipment', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'treasury'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    }
  }

  function downloadGeoJson() {
    // El botón solo existe con el embarque cargado; el corte es para el tipo.
    if (!shipment) return;
    const collection = {
      type: 'FeatureCollection',
      features: parcelas.map((p) => ({
        type: 'Feature',
        properties: { parcela: p.nombre, cultivo: p.cultivo, embarque: shipment.id },
        geometry: null, // el polígono real se agrega al conectar el manifiesto GeoJSON
      })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${shipment.id}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-mono text-2xl">{shipment.id.length > 12 ? `${shipment.id.slice(0, 8)}…` : shipment.id}</h1>
        <ShipmentStateBadge estado={estado} />
      </div>

      <Card>
        <div className="mb-3 text-xs text-graphite">
          {t('common:nav.parcels')} · {t(`common:crops.${shipment.cultivo}`)}
        </div>
        <div className="flex flex-col gap-3">
          {parcelas.map((p) => (
            <div key={p.id} className="flex items-center gap-3">
              <SoilCoreIndicator
                filled={estado === 'emitido' ? 4 : p.filled}
                certified={estado === 'emitido' || p.certificada}
                size="sm"
              />
              <Link to={`/${locale}/dashboard/topologia/${p.id}`} className="flex-1 text-sm text-ink hover:underline">
                {p.nombre}
              </Link>
              <StatusBadge status={p.estado} />
            </div>
          ))}
        </div>
      </Card>

      {estado !== 'emitido' && <CostPreviewCard parcels={parcelas} />}

      {estado === 'emitido' ? (
        <Card className="flex flex-col gap-3">
          <div className="text-xs text-graphite">{t('certificates.title')}</div>
          {certificados.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <Link
                to={`/${locale}/dashboard/certificados/${c.id}`}
                className="font-mono text-sm text-gold hover:underline"
              >
                {c.numeroPublico}
              </Link>
              <StatusBadge status="vigente" />
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 border-t border-porcelain-border pt-3">
            <Button variant="secondary" onClick={downloadGeoJson}>
              <DownloadSimpleIcon size={16} />
              {t('shipments.download_geojson')}
            </Button>
          </div>
        </Card>
      ) : (
        <PrivilegeGate
          privilege={PRIVILEGES.CERTS_ISSUE}
          fallback={<AlertBanner tone="info" messageKey="dashboard:shipments.awaiting_approval" />}
        >
          <div className="flex justify-end">
            <Button onClick={issue}>{t('shipments.generate')}</Button>
          </div>
        </PrivilegeGate>
      )}

      <OnchainProgressModal
        open={saga.open}
        titleKey="dashboard:onchain.certify_title"
        steps={saga.steps}
        canDismiss={saga.done || saga.failed}
        onDismiss={closeSaga}
        certified={saga.done}
      />
    </div>
  );
}
