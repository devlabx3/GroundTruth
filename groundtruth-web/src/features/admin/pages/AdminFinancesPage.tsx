import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { WarningIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { fetchFinanzas } from '../queries';

/**
 * Finanzas de plataforma: el dinero de LA PLATAFORMA (ingresos, fondo de gas, agregados),
 * no el de cada operador (eso está en Unidades). Solo lectura. Los valores on-chain van
 * en blanco (—) si Solana no está configurada.
 */
export default function AdminFinancesPage() {
  const { t, i18n } = useTranslation(['admin', 'common']);
  const { data: f, isLoading } = useQuery({
    queryKey: ['admin', 'finanzas'],
    queryFn: fetchFinanzas,
  });

  if (isLoading) return <SkeletonRows rows={4} />;
  if (!f) return <AlertBanner messageKey="errors:server" />;

  const usd = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sol = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 3, maximumFractionDigits: 4 });
  const num = new Intl.NumberFormat(i18n.language);
  const DASH = '—';
  const money = (v: number | null) => (v === null ? DASH : `${usd.format(v)} USDC`);
  const sinCadena = !f.solanaActiva ? t('finances.no_chain') : undefined;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl">{t('finances.title')}</h1>

      {f.gas.bajo && <AlertBanner messageKey="admin:finances.gas_low" />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat
          label={t('finances.income_onchain')}
          value={money(f.ingresos.plataformaUsdc)}
          sub={sinCadena ?? t('finances.income_onchain_hint')}
        />
        <Stat
          label={t('finances.collected')}
          value={money(f.ingresos.cobradoTotalUsdc)}
          sub={`${usd.format(f.ingresos.porCertificacionUsdc)} ${t('finances.collected_cert')} · ${usd.format(f.ingresos.porManifiestoUsdc)} ${t('finances.collected_manifest')}`}
        />
        <Stat
          label={t('finances.gas')}
          value={f.gas.solBackend === null ? DASH : `${sol.format(f.gas.solBackend)} SOL`}
          sub={sinCadena}
          alert={f.gas.bajo}
        />
        <Stat label={t('finances.operators_funds')} value={money(f.agregados.tesoreriasUsdc)} />
        <Stat label={t('finances.certs_issued')} value={num.format(f.agregados.certificadosEmitidos)} />
        <Stat label={t('finances.manifests_issued')} value={num.format(f.agregados.manifiestosEmitidos)} />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  alert = false,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <Card>
      <div className="flex items-center gap-1.5 text-xs text-graphite">
        {label}
        {alert && <WarningIcon size={13} className="text-sealwax" />}
      </div>
      <div className={`mt-1 font-mono text-2xl ${alert ? 'text-sealwax' : 'text-ink'}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-graphite">{sub}</div>}
    </Card>
  );
}
