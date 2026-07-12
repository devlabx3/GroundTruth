/**
 * GroundTruth — tokens de diseño.
 * Fuente única: GroundTruth-Sistema-de-Diseno.md §2 (paleta) y §3 (tipografía).
 * Regla del oro: `gold` SOLO en momentos de certificado. No usar en botones ni navegación.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    // Paleta cerrada: 3 núcleo + neutros. No se agregan colores fuera de esta lista.
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      emerald: {
        DEFAULT: '#0C3C2D', // marca, superficies primarias, botón primario, "conforme"
        100: '#E7F0EC',
        300: '#9FC4B5',
      },
      porcelain: {
        DEFAULT: '#F7F5F0', // fondo claro de la app
        border: '#E2DED4',
      },
      gold: {
        DEFAULT: '#C69B3C', // SOLO momentos de certificado (badge, sello, Nº, 4º segmento)
        900: '#5C4310',
      },
      ink: {
        DEFAULT: '#101312', // texto principal, superficies oscuras (no negro puro)
        muted: '#8A8F8A',
      },
      sealwax: {
        DEFAULT: '#6E1423', // alertas, revocación, error (prohibido rojo semáforo)
        100: '#F7E8EA',
      },
      graphite: {
        DEFAULT: '#6B6F6B', // texto secundario, bordes, metadatos
      },
      white: '#FFFFFF',
    },
    fontFamily: {
      // §3 — Libre Caslon (display), Hanken Grotesk (UI), IBM Plex Mono (datos)
      display: ['"Libre Caslon Text"', 'Georgia', 'serif'],
      sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
      mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
    },
    extend: {
      fontWeight: {
        // Dos pesos máximo en UI (§3)
        normal: '400',
        medium: '500',
      },
      borderColor: {
        DEFAULT: '#E2DED4', // porcelain-border por defecto
      },
      borderRadius: {
        card: '12px',
        pill: '9999px',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
};
