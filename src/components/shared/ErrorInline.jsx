import { useTranslation } from 'react-i18next';
import { WarningCircle } from '@phosphor-icons/react';

/** Error inline de campo/acción — texto lacre (Gestion-de-Errores §3). */
export default function ErrorInline({ messageKey, values }) {
  const { t } = useTranslation();
  if (!messageKey) return null;
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-sealwax">
      <WarningCircle size={14} weight="fill" />
      {t(messageKey, values)}
    </p>
  );
}
