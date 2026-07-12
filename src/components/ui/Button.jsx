/** Botón base. Variante primaria en esmeralda. El oro nunca se usa aquí (regla del oro). */
export default function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-card px-4 py-2 font-sans text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none';
  const variants = {
    primary: 'bg-emerald text-porcelain hover:bg-[#0a3226]',
    secondary: 'border border-porcelain-border bg-white text-ink hover:bg-porcelain',
    ghost: 'text-ink hover:bg-emerald-100',
    danger: 'bg-sealwax text-sealwax-100 hover:bg-[#5a0f1d]',
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
