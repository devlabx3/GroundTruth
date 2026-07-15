import { forwardRef } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import ErrorInline from '@/components/shared/ErrorInline';
import type { FieldProps } from './Input';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps;

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, errorKey, errorValues, rows = 3, className = '', ...props },
  ref,
) {
  return (
    <label className={`block text-sm ${className}`}>
      {label && <span className="text-graphite">{label}</span>}
      <textarea
        ref={ref}
        rows={rows}
        className={`mt-1 w-full rounded-card border bg-white px-3 py-2 text-ink outline-none focus:border-emerald ${
          errorKey ? 'border-sealwax' : 'border-porcelain-border'
        }`}
        aria-invalid={!!errorKey}
        {...props}
      />
      <ErrorInline messageKey={errorKey} values={errorValues} />
    </label>
  );
});

export default Textarea;
