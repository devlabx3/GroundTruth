import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LeafIcon, WarningCircleIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonRows } from '@/components/ui/Skeleton';
import RealtimeIndicator from '@/components/shared/RealtimeIndicator';
import { useRealtimeInvalidation } from '@/lib/useRealtime';
import { fetchAlertas } from '../queries';
import type { AlertaAgricultor } from '@/types/api';

/**
 * Inicio del agricultor (F2): SOLO alertas de sus parcelas.
 *
 * Es la vista donde el tiempo real importa de verdad: un umbral EUDR que se rompe
 * de madrugada no puede esperar a que alguien abra la app. La suscripción a
 * `alertas` solo AVISA; la alerta la sirve el backend (RLS ya acota a sus fincas).
 */
export default function FarmerHome() {
  const { t, i18n } = useTranslation(['farmer', 'dashboard']);
  const { locale } = useParams();
  const { data: alerts, isLoading } = useQuery({
    queryKey: ['farmer', 'alerts'],
    queryFn: fetchAlertas,
  });
  const enVivo = useRealtimeInvalidation({ tabla: 'alertas', queryKey: ['farmer', 'alerts'] });
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  // Real: variableKey (se traduce); maqueta: variable ya localizado en el fixture.
  const varLabel = (a: AlertaAgricultor) => (a.variableKey ? t(`dashboard:telemetry.${a.variableKey}`) : a.variable);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl">{t('alerts.title')}</h2>
          <RealtimeIndicator estado={enVivo} />
        </div>

        {isLoading ? (
          <SkeletonRows rows={2} />
        ) : (alerts ?? []).length === 0 ? (
          <EmptyState icon={<LeafIcon size={40} />} title={t('alerts.empty')} />
        ) : (
          <div className="flex flex-col gap-3">
            {(alerts ?? []).map((a: AlertaAgricultor) => (
              <Card key={a.id} className="flex items-start gap-3 border-l-4 border-l-sealwax">
                <WarningCircleIcon size={22} weight="fill" className="mt-0.5 shrink-0" color="#6E1423" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-ink">
                    {t('alerts.detail', { variable: varLabel(a), valor: a.valor, umbral: a.umbral })}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-graphite">
                    <Link to={`/${locale}/dapp/parcelas/${a.parcelaId}`} className="text-emerald hover:underline">
                      {a.parcela}
                    </Link>
                    <span className="font-mono">{fmt.format(new Date(a.fecha))}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
