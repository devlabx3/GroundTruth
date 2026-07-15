import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowClockwiseIcon, CaretDownIcon, CaretUpIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { fetchSagas, reintentarSaga } from '../queries';
import { errorKey as claveDeError } from '@/lib/api';

/**
 * Auditoría del saga de certificación (A7): cola CERT_PENDING / FAILED con el
 * paso donde se quedó, su motivo y el reintento.
 *
 * El reintento vuelve a ejecutar la MISMA certificación del operador: es una
 * transacción atómica e idempotente por embarque — nunca duplica cobro ni mint.
 */
export default function AdminSagaPage() {
  const { t, i18n } = useTranslation(['admin', 'common', 'errors', 'dashboard']);
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'saga'],
    queryFn: fetchSagas,
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  async function retry(id: string) {
    setBusyId(id);
    setErrorKey(null);
    try {
      await reintentarSaga(id);
      queryClient.invalidateQueries({ queryKey: ['admin', 'saga'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
    } catch (e) {
      setErrorKey(claveDeError(e));
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) return <SkeletonRows rows={3} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('saga.title')}</h1>
      {errorKey && <AlertBanner messageKey={errorKey} />}

      {rows.length === 0 ? (
        <EmptyState title={t('saga.empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <Card key={r.id} className="p-0">
                <button
                  className="flex w-full items-center gap-3 px-5 py-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                >
                  <span className="flex-1 text-sm text-graphite">
                    {r.unidad} · <span className="font-mono text-xs">{r.embarque.slice(0, 8)}</span>
                  </span>
                  <span
                    className={`inline-flex items-center rounded-pill px-3 py-1 font-mono text-[11px] font-medium ${
                      r.estado === 'FAILED'
                        ? 'bg-sealwax-100 text-sealwax'
                        : 'bg-porcelain text-graphite border border-porcelain-border'
                    }`}
                  >
                    {r.estado}
                  </span>
                  {isOpen ? <CaretUpIcon size={14} /> : <CaretDownIcon size={14} />}
                </button>

                {isOpen && (
                  <div className="border-t border-porcelain-border px-5 py-4">
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-graphite">{t('saga.failed_step')}</dt>
                        <dd className="font-mono text-xs text-ink">{r.paso ?? '—'}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-graphite">{t('common:fields.date')}</dt>
                        <dd className="font-mono text-xs text-ink">{dateFmt.format(new Date(r.fecha))}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-graphite">{t('saga.attempts')}</dt>
                        <dd className="font-mono text-xs text-ink">{r.intentos}</dd>
                      </div>
                      {r.motivoKey && (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-graphite">{t('saga.reason')}</dt>
                          <dd className="text-sealwax">{t(`errors:${r.motivoKey}`)}</dd>
                        </div>
                      )}
                    </dl>
                    {r.retryable && (
                      <div className="mt-3 flex justify-end">
                        <Button variant="secondary" disabled={busyId === r.id} onClick={() => retry(r.id)}>
                          <ArrowClockwiseIcon size={16} />
                          {busyId === r.id ? t('common:loading') : t('common:actions.retry')}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
