import { useTranslation } from 'react-i18next';
import { ArrowSquareOutIcon } from '@phosphor-icons/react';

const CLUSTER = import.meta.env.VITE_SOLANA_CLUSTER ?? 'devnet';

/**
 * Enlace al explorer de Solana para verificación independiente
 * (Indice-de-Vistas §7). `type`: 'tx' | 'address' — los asset ids de cNFT
 * también se consultan como address.
 */
export interface ExplorerLinkProps {
  type?: 'tx' | 'address';
  value?: string | null;
  className?: string;
}

export default function ExplorerLink({ type = 'tx', value, className = '' }: ExplorerLinkProps) {
  const { t } = useTranslation('common');
  if (!value) return null;
  const href = `https://explorer.solana.com/${type === 'tx' ? 'tx' : 'address'}/${value}?cluster=${CLUSTER}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center gap-1.5 text-xs text-emerald underline-offset-2 hover:underline ${className}`}
    >
      <ArrowSquareOutIcon size={14} />
      {t('explorer')}
      <span className="font-mono text-graphite">{truncate(value)}</span>
    </a>
  );
}

export function truncate(v: string | null | undefined, head = 6, tail = 4): string {
  if (!v) return '';
  if (v.length <= head + tail + 1) return v;
  return `${v.slice(0, head)}…${v.slice(-tail)}`;
}
