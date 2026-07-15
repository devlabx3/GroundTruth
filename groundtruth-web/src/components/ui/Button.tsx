import type { ButtonHTMLAttributes } from 'react';

/**
 * Botón base. Variante primaria en esmeralda. El oro nunca se usa aquí (regla del oro).
 * Sobre superficies esmeralda/oscuras usar `inverted` / `ghostInverted` — NUNCA
 * sobreescribir colores del variant vía className: dos clases bg-/text- en
 * conflicto se resuelven por orden del CSS generado, no por orden en el string.
 */
// TODOS los variants llevan un borde de 1px (color por variante; transparente donde no
// se ve). Así el modelo de caja es idéntico entre variantes: un `primary` sin borde
// quedaba 2px más bajo que un `secondary` con borde, y al ponerlos juntos (p. ej. en el
// header) no alineaban. El fondo pinta bajo el borde (background-clip por defecto), así
// que un borde transparente sobre relleno se ve continuo, sin halo.
const VARIANTS = {
  primary: 'border-transparent bg-emerald text-porcelain hover:bg-[#0a3226]',
  secondary: 'border-porcelain-border bg-white text-ink hover:bg-porcelain',
  ghost: 'border-transparent text-ink hover:bg-emerald-100',
  danger: 'border-transparent bg-sealwax text-sealwax-100 hover:bg-[#5a0f1d]',
  // Para superficies esmeralda/tinta (hero, cabeceras oscuras):
  inverted: 'border-transparent bg-porcelain text-emerald hover:bg-white',
  // Secundario sobre oscuro: contorno porcelana visible (el ghost se perdía contra el fondo).
  outlineInverted: 'border-porcelain text-porcelain hover:bg-white/10',
  ghostInverted: 'border-transparent text-porcelain hover:bg-white/10',
} as const;

export type ButtonVariant = keyof typeof VARIANTS;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-card border px-4 py-2 font-sans text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  return <button className={`${base} ${VARIANTS[variant]} ${className}`} {...props} />;
}
