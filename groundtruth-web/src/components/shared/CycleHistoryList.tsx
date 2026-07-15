import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Ciclo } from '@/types/api';

/**
 * Historial de ciclos de una parcela (F3/O4). Un ciclo abre con la siembra y
 * cierra con la declaración de nueva siembra; certificado ⇒ hubo emisión en él.
 */
export default function CycleHistoryList({ cycles }: { cycles: Ciclo[] }) {
  const { t, i18n } = useTranslation('common');
  const fmt = new Intl.DateTimeFormat(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
  return (
    <ul className="flex flex-col">
      {cycles.map((c) => (
        <li
          key={c.id}
          className="flex items-center justify-between gap-3 border-b border-porcelain-border/60 py-2.5 last:border-0"
        >
          <span className="font-mono text-xs text-ink">
            {fmt.format(new Date(c.inicio))}
            {' — '}
            {c.fin ? fmt.format(new Date(c.fin)) : t('cycle.ongoing')}
          </span>
          <StatusBadge status={c.certificado ? 'vigente' : c.fin ? 'expirado' : 'pendiente'} />
        </li>
      ))}
    </ul>
  );
}
