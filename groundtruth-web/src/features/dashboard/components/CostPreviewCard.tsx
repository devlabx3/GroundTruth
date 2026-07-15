import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import { PRICING } from '../fixtures';
import type { ReactNode } from 'react';
import type { Parcela } from '@/types/api';

/**
 * Costo estimado del embarque (O7): solo se cobran certificados NUEVOS —
 * una parcela con certificado vigente del mismo ciclo se reutiliza sin costo
 * (idempotencia, Errores §5.4) — más la tarifa fija de manifiesto.
 */
export default function CostPreviewCard({ parcels }: { parcels: Parcela[] }) {
  const { t, i18n } = useTranslation('dashboard');
  const fmt = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2 });
  const nuevos = parcels.filter((p) => !p.certificada).length;
  const reutilizados = parcels.length - nuevos;
  const costoCerts = nuevos * PRICING.certificacionUsdc;
  const total = costoCerts + PRICING.manifiestoUsdc;

  return (
    <Card>
      <div className="text-xs text-graphite">{t('shipments.cost_preview')}</div>
      <dl className="mt-3 flex flex-col gap-1.5 text-sm">
        <Row label={t('shipments.cost_new', { n: nuevos })} value={`${fmt.format(costoCerts)} USDC`} />
        {reutilizados > 0 && (
          <Row label={t('shipments.cost_reused', { n: reutilizados })} value="0.00 USDC" />
        )}
        <Row label={t('shipments.cost_manifest')} value={`${fmt.format(PRICING.manifiestoUsdc)} USDC`} />
      </dl>
      <div className="mt-3 flex items-baseline justify-between border-t border-porcelain-border pt-3">
        <span className="text-xs text-graphite">{t('shipments.cost_total')}</span>
        <span className="font-mono text-xl text-ink">{fmt.format(total)} USDC</span>
      </div>
    </Card>
  );
}

function Row({ label, value }: { label: ReactNode; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-graphite">{label}</dt>
      <dd className="font-mono text-xs text-ink">{value}</dd>
    </div>
  );
}
