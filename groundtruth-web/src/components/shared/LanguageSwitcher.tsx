import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { AVAILABLE_LOCALES } from '@/i18n';

/**
 * Selector de idioma persistente. Cambia el prefijo :locale de la ruta.
 * Ofrece SOLO los idiomas con diccionario real (AVAILABLE_LOCALES); el resto
 * del roadmap aparece aquí automáticamente cuando su diccionario se registra.
 */
export interface LanguageSwitcherProps {
  /**
   * `md` (38px, para ir junto a botones — header público, ajustes) o
   * `sm` (30px, para las barras de sesión compactas donde los controles son text-xs).
   */
  size?: 'sm' | 'md';
}

export default function LanguageSwitcher({ size = 'md' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();

  const change = (loc: string) => {
    i18n.changeLanguage(loc);
    const path = window.location.pathname.replace(/^\/[^/]+/, `/${loc}`);
    navigate(path, { replace: true });
  };

  // El tamaño casa con la altura de sus vecinos: botones (38px) o controles text-xs (30px).
  const selectCls = size === 'sm' ? 'px-2 py-1.5 text-xs' : 'px-2 py-2 text-sm';

  return (
    <label className="inline-flex items-center gap-2 text-graphite">
      <span className="sr-only">{t('language')}</span>
      <select
        value={params.locale ?? i18n.language}
        onChange={(e) => change(e.target.value)}
        className={`rounded-card border border-porcelain-border bg-white text-ink ${selectCls}`}
      >
        {AVAILABLE_LOCALES.map((l) => (
          <option key={l} value={l}>{l.toUpperCase()}</option>
        ))}
      </select>
    </label>
  );
}
