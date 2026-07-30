import type { HTMLAttributes } from 'react';

export type CardVariant = 'default' | 'telemetry' | 'farms';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

const VARIANTS: Record<CardVariant, string> = {
  default: 'border-porcelain-border bg-white',
  telemetry: 'border-azure-light bg-azure-light/20',
  farms: 'border-earthbrown bg-white',
};

export default function Card({ className = '', variant = 'default', ...props }: CardProps) {
  return (
    <div
      className={`rounded-card border p-5 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
