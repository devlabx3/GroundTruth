/**
 * Configuración i18n — Regla de arquitectura (Sistema-de-Diseno §6):
 * ninguna cadena visible se escribe en el código; todo vive en diccionarios.
 * Español es el idioma por defecto y único diccionario completo del MVP.
 * Agregar un idioma = agregar su carpeta de locales; cero cambios de código.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Namespaces: se cargan por superficie para no traer todo el vocabulario a la DApp lite.
import esCommon from './locales/es/common.json';
import esPublic from './locales/es/public.json';
import esDashboard from './locales/es/dashboard.json';
import esFarmer from './locales/es/farmer.json';
import esVerify from './locales/es/verify.json';
import esErrors from './locales/es/errors.json';

// Idiomas del roadmap (Sistema-de-Diseno §6). Solo `es` tiene diccionario en el MVP.
export const SUPPORTED_LOCALES = ['es', 'en', 'de', 'nl', 'it', 'fr', 'pt'];
export const DEFAULT_LOCALE = 'es';

export const resources = {
  es: {
    common: esCommon,
    public: esPublic,
    dashboard: esDashboard,
    farmer: esFarmer,
    verify: esVerify,
    errors: esErrors,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    defaultNS: 'common',
    ns: ['common', 'public', 'dashboard', 'farmer', 'verify', 'errors'],
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
