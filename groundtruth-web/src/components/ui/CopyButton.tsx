import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CopyIcon, CheckIcon } from '@phosphor-icons/react';
import Button from './Button';

/** Copia `value` al portapapeles con confirmación visual efímera. */
export interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
}

export default function CopyButton({ value, label, className = '' }: CopyButtonProps) {
  const { t } = useTranslation('common');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard no disponible: sin efecto, el valor sigue visible en pantalla */
    }
  }

  return (
    <Button variant="secondary" onClick={copy} className={className}>
      {copied ? <CheckIcon size={16} color="#0C3C2D" /> : <CopyIcon size={16} />}
      {copied ? t('actions.copied') : (label ?? t('actions.copy'))}
    </Button>
  );
}
