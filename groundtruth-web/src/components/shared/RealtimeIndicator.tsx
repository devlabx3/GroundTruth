import { useTranslation } from 'react-i18next';
import { WarningCircleIcon } from '@phosphor-icons/react';
import type { EstadoRealtime } from '@/lib/useRealtime';

/**
 * Estado REAL del canal en vivo.
 *
 * Antes había un punto verde parpadeando en la pantalla del agricultor que decía
 * "Actualización en vivo" pasara lo que pasara: no había ninguna suscripción detrás.
 * Un indicador que siempre dice que sí no informa de nada — y peor, hace creer que
 * una alerta llegaría sola. Este refleja el canal de verdad, y cuando se cae lo dice
 * (Gestión de Errores §7: degradar, no romper — la app sigue por refetch).
 */
export default function RealtimeIndicator({ estado }: { estado: EstadoRealtime }) {
  const { t } = useTranslation('common');

  // Sin Supabase (modo maqueta) no hay canal: no se anuncia nada en vez de mentir.
  if (estado === 'inactivo') return null;

  if (estado === 'reintentando') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-sealwax">
        <WarningCircleIcon size={14} weight="fill" />
        {t('realtime.down')}
      </span>
    );
  }

  const conectado = estado === 'conectado';
  return (
    <span className="flex items-center gap-1.5 text-xs text-graphite">
      <span
        className={`h-2 w-2 rounded-pill ${conectado ? 'animate-pulse bg-emerald' : 'bg-graphite/40'}`}
        aria-hidden
      />
      {t('realtime.live')}
    </span>
  );
}
