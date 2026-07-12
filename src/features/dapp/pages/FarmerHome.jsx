import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Leaf } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import SoilCoreIndicator from '@/components/shared/SoilCoreIndicator';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';

export default function FarmerHome() {
  const { t } = useTranslation(['farmer', 'common', 'dashboard']);
  const [modal, setModal] = useState(null); // null | steps[]

  // Datos de maqueta; en producción vienen de TanStack Query (alertas por Realtime).
  const alerts = [];
  const parcels = [
    { id: '1', nombre: 'La Esperanza · 03', estado: 'conforme', filled: 4 },
    { id: '2', nombre: 'El Mirador · 07', estado: 'pendiente', filled: 2 },
  ];

  function declareNewPlanting() {
    // 2 pasos (Sistema-de-Diseno §7.1) — cierre de ciclo + registro en cadena.
    setModal([
      { key: 'confirm', labelKey: 'dashboard:onchain.step_newplanting_confirm', status: 'done' },
      { key: 'chain', labelKey: 'dashboard:onchain.step_newplanting_chain', status: 'active' },
    ]);
    setTimeout(() => setModal((s) => s && [s[0], { ...s[1], status: 'done' }]), 1500);
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-3 text-xl">{t('alerts.title')}</h2>
        {alerts.length === 0 ? (
          <EmptyState icon={<Leaf size={40} />} title={t('alerts.empty')} />
        ) : null}
      </section>

      <section>
        <h2 className="mb-3 text-xl">{t('parcels.title')}</h2>
        <div className="flex flex-col gap-3">
          {parcels.map((p) => (
            <Card key={p.id} className="flex items-center gap-4">
              <SoilCoreIndicator filled={p.filled} certified={p.filled === 4} size="sm" />
              <div className="flex-1">
                <div className="text-sm font-medium text-ink">{p.nombre}</div>
                <div className="mt-1"><StatusBadge status={p.estado} /></div>
              </div>
              <Button variant="secondary" onClick={declareNewPlanting}>
                {t('new_planting.action')}
              </Button>
            </Card>
          ))}
        </div>
      </section>

      <OnchainProgressModal
        open={!!modal}
        titleKey="new_planting.action"
        steps={modal ?? []}
        canDismiss={modal ? modal.every((s) => s.status === 'done') : false}
        onDismiss={() => setModal(null)}
      />
    </div>
  );
}
