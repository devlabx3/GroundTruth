/**
 * Configuración i18n — Regla de arquitectura (Sistema-de-Diseno §6):
 * ninguna cadena visible se escribe en el código; todo vive en diccionarios.
 * Español es el idioma por defecto.
 *
 * Agregar un idioma = crear `locales/<código>/<namespace>.json` — nada más.
 * El glob de Vite arma `resources` en build; AVAILABLE_LOCALES (lo que ofrece
 * el LanguageSwitcher) se deriva de las carpetas presentes.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Roadmap completo (Sistema-de-Diseno §6): es → en → de, nl, it, fr → pt.
export const SUPPORTED_LOCALES = ['es', 'en', 'de', 'nl', 'it', 'fr', 'pt'];
export const DEFAULT_LOCALE = 'es';

// ./locales/<locale>/<namespace>.json → resources[locale][namespace]
type Diccionario = Record<string, unknown>;

const modules = import.meta.glob<{ default: Diccionario }>('./locales/*/*.json', {
  eager: true,
});

export const resources: Record<string, Record<string, Diccionario>> = {};
for (const [path, mod] of Object.entries(modules)) {
  const m = path.match(/\.\/locales\/([^/]+)\/([^/]+)\.json$/);
  // Si un JSON cae fuera de `locales/<idioma>/<namespace>.json` no se registra en
  // silencio: se ignora explícitamente en vez de reventar al desestructurar null.
  if (!m) continue;
  const [, locale, namespace] = m;
  (resources[locale] ??= {})[namespace] = mod.default;
}

// Idiomas con diccionario real, en el orden del roadmap.
export const AVAILABLE_LOCALES = SUPPORTED_LOCALES.filter((l) => resources[l]);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: ['common', 'public', 'dashboard', 'farmer', 'verify', 'errors', 'admin'],
    interpolation: {
      escapeValue: false, // React ya escapa
    },
    detection: {
      order: ['path', 'localStorage', 'navigator'],
      lookupFromPathIndex: 0, // /:locale/...
      caches: ['localStorage'],
    },
  });

export default i18n;
