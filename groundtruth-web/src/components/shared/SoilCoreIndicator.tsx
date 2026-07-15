/**
 * SoilCoreIndicator — elemento de firma de la marca (Sistema-de-Diseno §4).
 * Barra vertical de 4 segmentos: telemetría → satélite → tesorería → certificado.
 * Segmentos en esmeralda; el 4.º se pinta ORO al emitirse el certificado
 * (único uso del oro permitido junto con badges/sello de certificado).
 *
 * Usos: indicador de estado por parcela, progreso del saga, favicon.
 */
import type { SealSize } from '@/types/ui';

const STAGE_KEYS = ['telemetria', 'satelite', 'tesoreria', 'certificado'] as const;

const DIMS: Record<SealSize, { w: number; h: number; gap: number }> = {
  sm: { w: 8, h: 9, gap: 2 },
  md: { w: 12, h: 16, gap: 3 },
  lg: { w: 16, h: 22, gap: 4 },
};

export interface SoilCoreIndicatorProps {
  /** Cuántos segmentos activos (0–4). */
  filled?: number;
  /** Si el 4.º va en oro. */
  certified?: boolean;
  size?: SealSize;
  className?: string;
}

export default function SoilCoreIndicator({
  filled = 0,
  certified = false,
  size = 'md',
  className = '',
}: SoilCoreIndicatorProps) {
  const dims = DIMS[size];

  return (
    <div
      className={`inline-flex flex-col ${className}`}
      style={{ gap: dims.gap, width: dims.w }}
      role="img"
      aria-label="Núcleo de verificación"
    >
      {STAGE_KEYS.map((key, i) => {
        const active = i < filled;
        const isCertifiedSegment = i === 3 && certified;
        let bg = 'var(--gt-graphite, #6B6F6B)';
        let opacity = 0.35;
        if (active) {
          opacity = 1;
          bg = isCertifiedSegment ? '#C69B3C' : '#0C3C2D';
        }
        return (
          <span
            key={key}
            style={{ height: dims.h, background: bg, opacity, borderRadius: 2 }}
          />
        );
      })}
    </div>
  );
}
