import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AlertBanner from '@/components/shared/AlertBanner';
import OnchainProgressModal from '@/components/shared/OnchainProgressModal';
import { zodResolver } from '@/lib/zodResolver';
import { useRealSaga } from '@/lib/useRealSaga';
import { crearUnidad } from '../queries';

const schema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  pais: z.string().min(2, 'errors:field_required').max(2, 'errors:field_required'),
  adminNombre: z.string().min(1, 'errors:field_required'),
  adminEmail: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/**
 * Alta de unidad (A1). Dos pasos reales: crear la unidad con su sub-rol de
 * dirección y sembrar a su administrador.
 *
 * La Treasury PDA NO se crea aquí: es una cuenta on-chain (`init_operator_treasury`)
 * y el programa Anchor todavía no existe. La unidad nace PENDIENTE_ONCHAIN y no
 * puede certificar hasta tenerla — lo decimos en vez de fingir una dirección.
 */
export default function AdminUnitNewPage() {
  const { t } = useTranslation(['admin', 'common']);
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
    defaultValues: { nombre: '', pais: '', adminNombre: '', adminEmail: '' },
  });

  async function onSubmit(values: Formulario) {
    try {
      await saga.start(
        [
          { key: 'create', labelKey: 'admin:onchain.step_create_unit' },
          { key: 'seed_admin', labelKey: 'admin:onchain.step_seed_admin' },
        ],
        () => crearUnidad(values),
      );
      queryClient.invalidateQueries({ queryKey: ['admin', 'unidades'] });
    } catch {
      // El modal ya pinta el paso fallido con su clave de error (Errores §6).
    }
  }

  function finish() {
    const ok = saga.result?.ok;
    saga.reset();
    if (ok) navigate(`/${locale}/admin/unidades`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('units.new')}</h1>
      <AlertBanner tone="info" messageKey="admin:units.treasury_pending_notice" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="flex flex-col gap-4">
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input
            label={t('units.country')}
            maxLength={2}
            errorKey={errors.pais?.message}
            {...register('pais')}
          />
          <Input
            label={t('units.admin_name')}
            errorKey={errors.adminNombre?.message}
            {...register('adminNombre')}
          />
          <Input
            label={t('units.admin_email')}
            type="email"
            errorKey={errors.adminEmail?.message}
            {...register('adminEmail')}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => navigate(`/${locale}/admin/unidades`)}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit">{t('common:actions.continue')}</Button>
          </div>
        </Card>
      </form>

      <OnchainProgressModal
        open={saga.open}
        titleKey="admin:units.new"
        steps={saga.steps}
        canDismiss={saga.done || saga.failed}
        onDismiss={finish}
      />
    </div>
  );
}
