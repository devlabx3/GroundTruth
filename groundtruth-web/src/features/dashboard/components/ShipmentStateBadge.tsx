import { useTranslation } from 'react-i18next';
import type { EstadoEmbarque } from '@/types/api';

/**
 * Estado del embarque: borrador / listo para aprobación / procesando / emitido.
 * "Emitido" en oro: es un momento de certificado (regla del oro, Sistema §2).
 */
const STYLES = {
  borrador: 'bg-porcelain text-graphite border border-porcelain-border',
  listo: 'bg-emerald-100 text-emerald',
  procesando: 'bg-porcelain text-graphite border border-porcelain-border animate-pulse',
  emitido: 'border border-gold text-gold',
  fallido: 'bg-sealwax-100 text-sealwax',
};

export default function ShipmentStateBadge({ estado }: { estado: EstadoEmbarque }) {
  const { t } = useTranslation('dashboard');
  const keyByState = {
    borrador: 'state_draft',
    listo: 'state_ready',
    procesando: 'state_processing',
    emitido: 'state_issued',
    fallido: 'state_failed',
  };
  return (
    <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${STYLES[estado] ?? STYLES.borrador}`}>
      {t(`shipments.${keyByState[estado] ?? 'state_draft'}`)}
    </span>
  );
}
