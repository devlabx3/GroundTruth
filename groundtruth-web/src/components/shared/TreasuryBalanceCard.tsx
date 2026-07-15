import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';

/**
 * Saldo de la Treasury PDA en USDC. Lo usan Operador (dashboard, tesorería)
 * y Admin (detalle de unidad, solo lectura). El monto es dato técnico → mono.
 */
export default function TreasuryBalanceCard({
  saldoUsdc,
  className = '',
}: {
  saldoUsdc: number;
  className?: string;
}) {
  const { t, i18n } = useTranslation('dashboard');
  const fmt = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <Card className={className}>
      <div className="text-xs text-graphite">{t('treasury.balance')}</div>
      <div className="mt-1 font-mono text-3xl text-ink">
        {fmt.format(saldoUsdc)} <span className="text-sm text-graphite">USDC</span>
      </div>
    </Card>
  );
}
