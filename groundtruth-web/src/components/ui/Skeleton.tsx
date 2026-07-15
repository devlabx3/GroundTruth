/** Carga con skeleton, no spinner infinito (Gestion-de-Errores §7.1). */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-porcelain-border/60 ${className}`} />;
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
