import { forwardRef } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import ErrorInline from '@/components/shared/ErrorInline';

/**
 * Input con label y error inline (Gestion-de-Errores §3: texto lacre bajo el
 * campo, borde lacre). Compatible con react-hook-form vía forwardRef.
 * `mono` para datos técnicos (hashes, direcciones, coordenadas — §3 tipografía).
 */
export interface FieldProps {
  label?: ReactNode;
  /** CLAVE i18n del error, nunca el texto: lo traduce ErrorInline. */
  errorKey?: string;
  /** Interpolaciones del mensaje (el `n` de sensores lo calcula el servidor). */
  errorValues?: Record<string, unknown>;
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {
  mono?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, errorKey, errorValues, mono = false, className = '', ...props },
  ref,
) {
  return (
    <label className={`block text-sm ${className}`}>
      {label && <span className="text-graphite">{label}</span>}
      <input
        ref={ref}
        className={`mt-1 w-full rounded-card border bg-white px-3 py-2 text-ink outline-none focus:border-emerald ${
          errorKey ? 'border-sealwax' : 'border-porcelain-border'
        } ${mono ? 'font-mono text-xs' : ''}`}
        aria-invalid={!!errorKey}
        {...props}
      />
      <ErrorInline messageKey={errorKey} values={errorValues} />
    </label>
  );
});

export default Input;
