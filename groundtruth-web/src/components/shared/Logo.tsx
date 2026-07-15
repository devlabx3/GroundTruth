/**
 * Logotipo GroundTruth (isotipo + wordmark) como SVG vectorial.
 *
 * El arte vive en `public/brand/` (no se importa como módulo): así se edita el SVG
 * sin recompilar y pesa nada en el bundle. Dos variantes, porque el navy de la marca
 * desaparece sobre fondo oscuro:
 *   - `primary`  → estructura en navy, para fondos claros (porcelana/blanco).
 *   - `inverse`  → estructura en porcelana, para fondos oscuros (bg-ink: sidebars).
 *
 * El wordmark va con el texto convertido a trazos (no depende de que Montserrat esté
 * instalada). El favicon NO es esto: es el SoilCore (Sistema-de-Diseño §4).
 */
const SRC = {
  primary: '/brand/logo.svg',
  inverse: '/brand/logo-inverse.svg',
} as const;

export interface LogoProps {
  variant?: keyof typeof SRC;
  /** Controla el tamaño; da la altura y deja el ancho automático. */
  className?: string;
}

export default function Logo({ variant = 'primary', className = 'h-8 w-auto' }: LogoProps) {
  return <img src={SRC[variant]} alt="GroundTruth" className={className} draggable={false} />;
}
