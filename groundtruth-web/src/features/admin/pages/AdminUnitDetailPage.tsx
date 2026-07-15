import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CopyButton from '@/components/ui/CopyButton';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import TreasuryBalanceCard from '@/components/shared/TreasuryBalanceCard';
import ExplorerLink from '@/components/shared/ExplorerLink';
import { fetchUnidad, cambiarEstadoUnidad } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';
import type { EstadoUnidad } from '@/types/api';

/** Detalle de unidad (A1): tesorería y miembros SOLO lectura + suspensión. */
export default function AdminUnitDetailPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { locale, id } = useParams();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: unit, isLoading } = useQuery({
    queryKey: ['admin', 'unidad', id],
    queryFn: () => fetchUnidad(id!),
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  if (!unit) {
    return (
      <EmptyState
        title={t('errors:not_found', { ns: 'errors' })}
        action={
          <Link to={`/${locale}/admin/unidades`}>
            <Button variant="secondary">{t('common:actions.back')}</Button>
          </Link>
        }
      />
    );
  }

  const isSuspended = unit.estado === 'suspendida';
  const isPending = unit.estado === 'pendiente';

  async function cambiarEstado(estado: EstadoUnidad) {
    setBusy(true);
    setErrorKey(null);
    try {
      await cambiarEstadoUnidad(id!, estado);
      queryClient.invalidateQueries({ queryKey: ['admin', 'unidad', id] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'unidades'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  const memberColumns = [
    { key: 'nombre', header: t('common:fields.name') },
    { key: 'email', header: t('common:fields.email') },
    { key: 'subRol', header: t('units.subrole') },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl">{unit.nombre}</h1>
        <span className="font-mono text-xs text-graphite">{unit.pais}</span>
      </div>

      {errorKey && <AlertBanner messageKey={errorKey} />}
      {isSuspended && <AlertBanner messageKey="admin:units.suspended_notice" />}
      {isPending && <AlertBanner messageKey="admin:units.pending_notice" />}

      {/* Sin programa Anchor, una unidad recién creada no tiene Treasury PDA:
          mostramos el hueco en vez de una dirección inventada. */}
      {unit.treasury ? (
        <div className="grid gap-4 md:grid-cols-2">
          <TreasuryBalanceCard saldoUsdc={unit.saldoUsdc ?? 0} />
          <Card>
            <div className="text-xs text-graphite">{t('units.treasury_address')}</div>
            <div className="mt-2 break-all font-mono text-xs text-ink">{unit.treasury}</div>
            <div className="mt-3 flex items-center gap-3">
              <CopyButton value={unit.treasury} />
              <ExplorerLink type="address" value={unit.treasury} />
            </div>
          </Card>
        </div>
      ) : (
        <Card>
          <div className="text-xs text-graphite">{t('units.treasury_address')}</div>
          <div className="mt-2 text-sm text-graphite">{t('units.treasury_pending')}</div>
        </Card>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-ink">{t('units.members')}</h2>
        <Table columns={memberColumns} rows={unit.miembros} emptyTitle={t('units.members_empty')} />
      </section>

      {!isPending && (
        <div className="flex justify-end">
          {isSuspended ? (
            <Button variant="secondary" disabled={busy} onClick={() => cambiarEstado('activa')}>
              {busy ? t('common:loading') : t('units.reactivate')}
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              {t('units.suspend')}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => cambiarEstado('suspendida')}
        title={t('units.suspend')}
        body={t('units.suspend_confirm')}
        confirmLabel={t('units.suspend')}
        danger
      />
    </div>
  );
}
