import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { SkeletonRows } from '@/components/ui/Skeleton';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { SUPPORTED_LOCALES } from '@/i18n';
import { fetchUnidad, actualizarUnidad } from '../queries';

const schema = z.object({
  nombre: z.string().min(1, 'errors:field_required'),
  pais: z.string().min(2, 'errors:field_required').max(2, 'errors:field_required'),
  idiomaDefecto: z.string().min(1, 'errors:field_required'),
});

/** El formulario recibe EXACTAMENTE lo que el esquema valida. */
type Formulario = z.infer<typeof schema>;

/** Perfil de la unidad (O10). */
export default function UnitSettingsPage() {
  const { t } = useTranslation(['dashboard', 'common']);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['dashboard', 'unidad'], queryFn: fetchUnidad });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { nombre: '', pais: '', idiomaDefecto: 'es' },
  });

  useEffect(() => {
    if (data) reset(data);
  }, [data, reset]);

  if (isLoading) return <SkeletonRows rows={4} />;

  async function onSubmit(values: Formulario) {
    setBusy(true);
    try {
      await actualizarUnidad(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl">{t('settings.title')}</h1>
      {saved && <AlertBanner tone="info" messageKey="dashboard:settings.saved" />}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="flex flex-col gap-4">
          <Input label={t('common:fields.name')} errorKey={errors.nombre?.message} {...register('nombre')} />
          <Input label={t('settings.country')} maxLength={2} errorKey={errors.pais?.message} {...register('pais')} />
          <Select
            label={t('settings.default_language')}
            options={SUPPORTED_LOCALES.map((l) => ({ value: l, label: l.toUpperCase() }))}
            errorKey={errors.idiomaDefecto?.message}
            {...register('idiomaDefecto')}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? t('common:loading') : t('common:actions.save')}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
