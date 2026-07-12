import { useTranslation } from 'react-i18next';

/**
 * Pill de estado. Mapea estados de dominio a la paleta:
 * conforme/vigente → esmeralda · alerta/revocado → lacre · pendiente → neutro.
 * El oro se reserva para "verificado"/certificado emitido.
 */
const STYLES = {
  conforme: 'bg-emerald-100 text-emerald',
  vigente: 'bg-emerald-100 text-emerald',
  alerta: 'bg-sealwax-100 text-sealwax',
  revocado: 'bg-sealwax-100 text-sealwax',
  pendiente: 'bg-porcelain text-graphite border border-porcelain-border',
  sustituido: 'bg-porcelain text-graphite border border-porcelain-border',
  expirado: 'bg-porcelain text-graphite border border-porcelain-border',
  verificado: 'border border-gold text-gold',
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const cls = STYLES[status] ?? STYLES.pendiente;
  return (
    <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${cls}`}>
      {t(`status.${status}`)}
    </span>
  );
}
