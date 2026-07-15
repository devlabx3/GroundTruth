import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';
import { useRealSaga } from '@/lib/useRealSaga';
import { declararNuevaSiembra } from '../queries';

/**
 * Confirmar nueva siembra (F4): consecuencias explícitas ANTES de ejecutar
 * (cierra el ciclo, el próximo despacho vuelve a certificar y cobrar) y
 * OnchainProgressModal de 2 pasos contra el backend real (Sistema-de-Diseno §7.1).
 */
export default function FarmerNewPlantingPage() {
  const { t } = useTranslation(['farmer', 'common']);
  const { locale, id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saga = useRealSaga();

  function confirm() {
    saga
      .start(
        [
          { key: 'confirm', labelKey: 'dashboard:onchain.step_newplanting_confirm' },
          { key: 'chain', labelKey: 'dashboard:onchain.step_newplanting_chain' },
        ],
        () => declararNuevaSiembra(id!),
      )
      .catch(() => {}); // el error queda pintado en el paso del modal
  }

  function finish() {
    const wasDone = saga.done;
    saga.reset();
    if (wasDone) {
      queryClient.invalidateQueries({ queryKey: ['farmer', 'parcel', id] });
      navigate(`/${locale}/dapp/parcelas/${id}`, { state: { planted: true } });
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h2 className="text-xl">{t('new_planting.confirm_title')}</h2>
      <Card className="mt-4">
        <p className="text-sm text-ink">{t('new_planting.confirm_body')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => navigate(`/${locale}/dapp/parcelas/${id}`)}>
            {t('common:actions.cancel')}
          </Button>
          <Button onClick={confirm}>{t('common:actions.confirm')}</Button>
        </div>
      </Card>

      <OnchainProgressModal
        open={saga.open}
        titleKey="farmer:new_planting.action"
        steps={saga.steps}
        canDismiss={saga.done || saga.failed}
        onDismiss={finish}
      />
    </div>
  );
}
