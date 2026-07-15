import { useTranslation } from 'react-i18next';
import { SealCheckIcon, XCircleIcon } from '@phosphor-icons/react';
import { truncate } from './ExplorerLink';

/**
 * Hash on-chain vs. hash calculado, con sello de coincidencia
 * (Indice-de-Vistas §7 — verificador público y detalle de certificado).
 * Los hashes no se traducen (regla i18n).
 */
export interface HashCompareRowProps {
  label: string;
  onchain?: string | null;
  computed?: string | null;
}

export default function HashCompareRow({ label, onchain, computed }: HashCompareRowProps) {
  const { t } = useTranslation('common');
  const match = !!onchain && onchain === computed;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-porcelain-border/60 py-3 last:border-0">
      <span className="w-40 shrink-0 text-xs text-graphite">{label}</span>
      <span className="font-mono text-xs text-ink" title={onchain ?? undefined}>
        {truncate(onchain, 10, 8)}
      </span>
      <span
        className={`inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-medium ${
          match ? 'border border-gold text-gold' : 'bg-sealwax-100 text-sealwax'
        }`}
      >
        {match ? <SealCheckIcon size={14} weight="fill" /> : <XCircleIcon size={14} weight="fill" />}
        {match ? t('hash.match') : t('hash.mismatch')}
      </span>
    </div>
  );
}
