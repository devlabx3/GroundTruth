import { useTranslation } from 'react-i18next';

/** Banner de sección — para errores que afectan una vista completa. */
const TONES = {
  error: 'bg-sealwax-100 text-sealwax',
  info: 'bg-emerald-100 text-emerald',
} as const;

export interface AlertBannerProps {
  messageKey: string;
  values?: Record<string, unknown>;
  tone?: keyof typeof TONES;
}

export default function AlertBanner({ messageKey, values, tone = 'error' }: AlertBannerProps) {
  const { t } = useTranslation();
  const tones = TONES;
  return (
    <div className={`rounded-card px-4 py-3 text-sm ${tones[tone]}`} role="alert">
      {t(messageKey, values)}
    </div>
  );
}
