import { useTranslation } from 'react-i18next';

/** Banner de sección — para errores que afectan una vista completa. */
export default function AlertBanner({ messageKey, values, tone = 'error' }) {
  const { t } = useTranslation();
  const tones = {
    error: 'bg-sealwax-100 text-sealwax',
    info: 'bg-emerald-100 text-emerald',
  };
  return (
    <div className={`rounded-card px-4 py-3 text-sm ${tones[tone]}`} role="alert">
      {t(messageKey, values)}
    </div>
  );
}
