import type { HTMLAttributes } from 'react';

export default function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-porcelain-border bg-white p-5 ${className}`}
      {...props}
    />
  );
}
