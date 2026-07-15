import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonRows } from '@/components/ui/Skeleton';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import ParcelMap, { CENTRO_DEFECTO } from '@/components/shared/ParcelMap';
import PrivilegeGate from '@/components/shared/PrivilegeGate';
import TreasuryBalanceCard from '@/components/shared/TreasuryBalanceCard';
import { PRIVILEGES } from '@/lib/privileges';
import RealtimeIndicator from '@/components/shared/RealtimeIndicator';
import { useRealtimeInvalidation } from '@/lib/useRealtime';
import { fetchOverview } from '../queries';
import AlertBanner from '@/components/shared/AlertBanner';

/** Dashboard del operador (O2): métricas + mapa de estado + tesorería (gated). */
export default function DashboardHome() {
  const { t } = useTranslation('dashboard');
  const { locale } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: fetchOverview,
  });
  // Se escucha `parcelas`, NO `lecturas_telemetria`: Supabase Realtime no entrega
  // cambios de tablas particionadas (comprobado; ver migración 0011). El semáforo
  // vive materializado en `parcelas` y su disparador solo escribe cuando CAMBIA,
  // así que aquí llega una señal por cambio real, no una por lectura.
  const enVivo = useRealtimeInvalidation({
    tabla: 'parcelas',
    queryKey: ['dashboard', 'overview'],
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  // Consulta fallida: `data` es undefined con isLoading=false. Sin este corte la
  // vista revienta al leerlo — mejor decir que algo falló que romperse en blanco.
  if (!data) return <AlertBanner messageKey="errors:server" />;
  const { parcels, certsVigentes, treasury } = data;
  const metrics = [
    { key: 'active_parcels', value: parcels.length },
    { key: 'certificates_issued', value: certsVigentes },
    { key: 'open_alerts', value: parcels.filter((p) => p.estado === 'alerta').length, alert: true },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <RealtimeIndicator estado={enVivo} />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((m) => (
          <Card key={m.key}>
            <div className="text-xs text-graphite">{t(`metrics.${m.key}`)}</div>
            <div className={`mt-1 text-3xl ${m.alert && m.value > 0 ? 'text-sealwax' : 'text-ink'}`}>
              {m.value}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-2 text-xs text-graphite">{t('map.title')}</div>
          <ParcelMap
            center={CENTRO_DEFECTO}
            zoom={13}
            height={300}
            pins={parcels}
            onPinClick={(p) => navigate(`/${locale}/dashboard/topologia/${p.id}`)}
          />
        </Card>
        <div className="flex flex-col gap-4">
          {treasury && (
            <PrivilegeGate privilege={PRIVILEGES.TREASURY_VIEW}>
              <Link to={`/${locale}/dashboard/tesoreria`}>
                <TreasuryBalanceCard saldoUsdc={treasury.saldoUsdc} className="transition-colors hover:border-emerald" />
              </Link>
            </PrivilegeGate>
          )}
          <Card>
            <div className="mb-3 text-xs text-graphite">{t('map.recent')}</div>
            <div className="flex flex-col gap-3">
              {parcels.slice(0, 4).map((p) => (
                <Link key={p.id} to={`/${locale}/dashboard/topologia/${p.id}`} className="flex items-center gap-3">
                  <SoilCoreIndicator filled={p.filled} certified={p.certificada} size="sm" />
                  <span className="flex-1 text-sm text-ink">{p.nombre}</span>
                  <StatusBadge status={p.estado} />
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
