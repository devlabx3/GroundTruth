import { forwardRef } from 'react';
import type { SelectHTMLAttributes } from 'react';
import ErrorInline from '@/components/shared/ErrorInline';
import type { FieldProps } from './Input';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {
  options?: SelectOption[];
  placeholder?: string;
}

/** Select nativo estilizado. options: [{ value, label }]. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, options = [], placeholder, errorKey, errorValues, className = '', ...props },
  ref,
) {
  return (
    <label className={`block text-sm ${className}`}>
      {label && <span className="text-graphite">{label}</span>}
      <select
        ref={ref}
        className={`mt-1 w-full rounded-card border bg-white px-3 py-2 text-ink outline-none focus:border-emerald ${
          errorKey ? 'border-sealwax' : 'border-porcelain-border'
        }`}
        aria-invalid={!!errorKey}
        defaultValue={props.defaultValue ?? ''}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ErrorInline messageKey={errorKey} values={errorValues} />
    </label>
  );
});

export default Select;
