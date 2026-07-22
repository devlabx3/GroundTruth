import { forwardRef, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import ErrorInline from '@/components/shared/ErrorInline';

interface FieldProps {
  label?: ReactNode;
  errorKey?: string;
  errorValues?: Record<string, unknown>;
}

interface PasswordInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>, FieldProps {}

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, errorKey, errorValues, className = '', ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <label className={`block text-sm ${className}`}>
      {label && <span className="text-graphite">{label}</span>}
      <div className="relative">
        <input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          className={`mt-1 w-full rounded-card border bg-white px-3 py-2 pr-10 text-ink outline-none focus:border-emerald ${
            errorKey ? 'border-sealwax' : 'border-porcelain-border'
          }`}
          aria-invalid={!!errorKey}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 -translate-y-1/2 transform text-graphite hover:text-ink focus:outline-none mt-1"
          tabIndex={-1}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          {showPassword ? (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
              <path d="M15.171 13.576l1.473 1.473A10.014 10.014 0 0019.542 10c-1.274-4.057-5.064-7-9.542-7a9.958 9.958 0 00-4.512 1.074l1.473 1.473C9.591 4.555 9.787 4.5 10 4.5c5.523 0 10 4.477 10 10 0 .213-.045.409-.131.601z" />
            </svg>
          )}
        </button>
      </div>
      <ErrorInline messageKey={errorKey} values={errorValues} />
    </label>
  );
});

export default PasswordInput;
