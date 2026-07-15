import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { fetchIntegraciones } from '../queries';

/**
 * Salud de integraciones resumida para la TopBar del AdminShell (Índice §2).
 *
 * Consume el MISMO endpoint (y la misma query cacheada) que la vista A9, así el
 * badge y la página nunca discrepan. Antes leía el fixture directo y por eso
 * mostraba siempre "3/5" aunque el backend reportara otra cosa.
 */
export default function IntegrationHealthBadge() {
  const { t } = useTranslation('admin');
  const { locale } = useParams();
  const { data: integrations = [] } = useQuery({
    queryKey: ['admin', 'integraciones'],
    queryFn: fetchIntegraciones,
    refetchInterval: 30_000,
  });

  // "Activas" = configuradas y funcionando: operativas (ok) o degradadas (warn). No
  // cuentan las caídas (down) ni las no configuradas — esas dos son las "no activas".
  const activas = integrations.filter((i) => i.estado === 'ok' || i.estado === 'warn').length;
  const total = integrations.length;
  const worst = integrations.some((i) => i.estado === 'down')
    ? 'down'
    : integrations.some((i) => i.estado === 'warn')
      ? 'warn'
      : 'ok';
  const dot = { ok: 'bg-emerald', warn: 'bg-gold', down: 'bg-sealwax' }[worst];

  return (
    <Link
      to={`/${locale}/admin/integraciones`}
      className="flex items-center gap-2 rounded-card border border-porcelain-border bg-white px-2.5 py-1.5 text-xs text-ink hover:bg-porcelain"
      title={t('integrations.title')}
    >
      <span className={`h-2 w-2 rounded-pill ${dot}`} aria-hidden />
      <span className="font-mono">{activas}/{total}</span>
      {t('integrations.badge')}
    </Link>
  );
}
