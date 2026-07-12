import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { SUPPORTED_LOCALES } from '@/i18n';

/** Selector de idioma persistente. Cambia el prefijo :locale de la ruta. */
export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();

  const change = (loc) => {
    i18n.changeLanguage(loc);
    const path = window.location.pathname.replace(/^\/[^/]+/, `/${loc}`);
    navigate(path, { replace: true });
  };

  return (
    <label className="inline-flex items-center gap-2 text-sm text-graphite">
      <span className="sr-only">{t('language')}</span>
      <select
        value={params.locale ?? i18n.language}
        onChange={(e) => change(e.target.value)}
        className="rounded-card border border-porcelain-border bg-white px-2 py-1 text-ink"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>{l.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}
