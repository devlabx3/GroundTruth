import { useTranslation } from 'react-i18next';
import { WarningCircleIcon } from '@phosphor-icons/react';

/** Error inline de campo/acción — texto lacre (Gestion-de-Errores §3). */
export interface ErrorInlineProps {
  /** CLAVE i18n, nunca texto. `undefined` = sin error → no renderiza nada. */
  messageKey?: string;
  values?: Record<string, unknown>;
}

export default function ErrorInline({ messageKey, values }: ErrorInlineProps) {
  const { t } = useTranslation();
  if (!messageKey) return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-sealwax">
      <WarningCircleIcon size={14} weight="fill" />
      {t(messageKey, values)}
    </p>
  );
}
