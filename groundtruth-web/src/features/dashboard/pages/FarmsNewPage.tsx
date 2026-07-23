import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';
import { zodResolver } from '@/lib/zodResolver';
import { useRealSaga } from '@/lib/useRealSaga';
import { COUNTRIES } from '@/lib/countries';
import { crearFincaConAgricultor } from '../queries';

const schema = z.object({
  nombreFinca: z.string().min(1, 'errors:field_required'),
  paisFinca: z.string().length(2, 'errors:field_required'),
  areaHa: z.number().positive('errors:field_required'),
  nombreAgricultor: z.string().min(1, 'errors:field_required'),
  emailAgricultor: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/**
 * Alta de finca con agricultor encargado (O4 + agricultor).
 * Patrón idéntico a AdminUnitNewPage: saga onchain de dos pasos.
 */
export default function FarmsNewPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saga = useRealSaga();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombreFinca: '', paisFinca: '', areaHa: 0, nombreAgricultor: '', emailAgricultor: '' },
  });

  async function onSubmit(values: Formulario) {
    try {
      await saga.start(
        [
          { key: 'create_farm', labelKey: 'dashboard:farms.saga_create_farm' },
          { key: 'seed_farmer', labelKey: 'dashboard:farms.saga_seed_farmer' },
        ],
        () => crearFincaConAgricultor(values),
      );
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'fincas'] });
    } catch {
      // El modal ya pinta el paso fallido con su clave de error.
    }
  }

  function finish() {
    const ok = saga.result?.ok;
    saga.reset();
    if (ok) navigate(`/${locale}/dashboard/fincas`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('dashboard:farms.new_with_farmer')}</h1>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="flex flex-col gap-4">
          {/* Sección Finca */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">{t('dashboard:farms.farm_data')}</h2>
            <div className="space-y-4">
              <Input
                label={t('common:fields.name')}
                placeholder={t('common:fields.name')}
                errorKey={errors.nombreFinca?.message}
                {...register('nombreFinca')}
              />
              <Select
                label={t('common:fields.country')}
                options={COUNTRIES}
                placeholder={t('common:fields.select_country')}
                errorKey={errors.paisFinca?.message}
                {...register('paisFinca')}
              />
              <Input
                label={t('dashboard:farms.area')}
                type="number"
                step="0.01"
                min="0"
                placeholder="10.5"
                errorKey={errors.areaHa?.message}
                {...register('areaHa', { valueAsNumber: true })}
              />
            </div>
          </div>

          {/* Separador visual */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Sección Agricultor */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">{t('dashboard:farms.farmer_data')}</h2>
            <div className="space-y-4">
              <Input
                label={t('dashboard:farms.farmer_name')}
                placeholder={t('common:fields.name')}
                errorKey={errors.nombreAgricultor?.message}
                {...register('nombreAgricultor')}
              />
              <Input
                label={t('common:fields.email')}
                type="email"
                placeholder="agricultor@example.com"
                errorKey={errors.emailAgricultor?.message}
                {...register('emailAgricultor')}
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => navigate(`/${locale}/dashboard/fincas`)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit">{t('common:actions.continue')}</Button>
          </div>
        </Card>
      </form>

      <OnchainProgressModal
        open={saga.open}
        titleKey="dashboard:farms.new_with_farmer"
        steps={saga.steps}
        canDismiss={saga.done || saga.failed}
        onDismiss={finish}
      />
    </div>
  );
}
