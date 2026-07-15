import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import { SkeletonRows } from '@/components/ui/Skeleton';
import { fetchIntegraciones } from '../queries';

const DOT = {
  ok: 'bg-emerald',
  warn: 'bg-gold', // excepción deliberada: advertencia operativa, no momento de certificado
  down: 'bg-sealwax',
  no_configurado: 'bg-porcelain-border',
};

const PILL = {
  ok: 'bg-emerald-100 text-emerald',
  warn: 'bg-porcelain text-gold-900 border border-gold',
  down: 'bg-sealwax-100 text-sealwax',
  no_configurado: 'bg-porcelain text-graphite border border-porcelain-border',
};

/**
 * Salud de integraciones (A9). El backend solo sondea lo que existe hoy
 * (Supabase y, si se configura, el RPC de Solana); Sentinel, Helius e Irys
 * aparecen como "no configurada" en vez de un "operativa" inventado — un panel
 * de salud que miente es peor que no tenerlo.
 */
export default function AdminIntegrationsPage() {
  const { t } = useTranslation(['admin', 'common']);
  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ['admin', 'integraciones'],
    queryFn: fetchIntegraciones,
    refetchInterval: 30_000,
  });

  if (isLoading) return <SkeletonRows rows={3} />;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('integrations.title')}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((i) => (
          <Card key={i.key} className="flex items-center gap-3">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-pill ${DOT[i.estado]}`} aria-hidden />
            <div className="flex-1">
              <div className="text-sm font-medium text-ink">{i.nombre}</div>
              <div className="mt-0.5 font-mono text-xs text-graphite">
                {i.latenciaMs != null ? `${i.latenciaMs} ms` : '—'}
              </div>
            </div>
            <span className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-medium ${PILL[i.estado]}`}>
              {t(`integrations.state.${i.estado}`)}
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
