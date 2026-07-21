import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { getSupabase } from '@/lib/supabase';

const schema = z
  .object({
    password: z.string().min(8, 'errors:password_min'),
    confirmPassword: z.string().min(8, 'errors:password_min'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'errors:password_mismatch',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

/**
 * Reset de contraseña vía email de recuperación. El usuario recibe un link
 * con access_token en el hash (#access_token=...&type=recovery), supabase-js
 * detecta automáticamente la sesión de recovery, y esta página permite fijar
 * la nueva contraseña con supabase.auth.updateUser().
 */
export default function ResetPasswordPage() {
  const { t } = useTranslation(['public', 'common', 'errors']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const supabase = getSupabase();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Verificar que hay una sesión de recovery válida
  useEffect(() => {
    if (!supabase) {
      // Modo maqueta: no hay reset en demo
      setError('public:reset_password.not_configured');
      setLoading(false);
      return;
    }

    async function checkSession() {
      try {
        const { data, error: sessionError } = await supabase!.auth.getSession();
        // getSession devuelve la sesión actual (si la hay). Si el hash tiene
        // access_token y type=recovery, supabase-js ya lo procesó y la sesión
        // debe ser de tipo recovery (user.user_metadata o similar). Si no,
        // o si hay error, el link es inválido/expirado.
        if (sessionError || !data?.session) {
          setError('public:reset_password.invalid_link');
        }
      } catch (e) {
        setError('public:reset_password.invalid_link');
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, [supabase]);

  async function onSubmit(values: FormData) {
    if (!supabase) {
      setError('public:reset_password.not_configured');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (updateError) {
        setError(updateError.message || 'public:reset_password.error');
        return;
      }

      setSuccess(true);
      // Redirigir a login después de 2 segundos
      setTimeout(() => {
        navigate(`/${locale}/login`, { replace: true });
      }, 2000);
    } catch (e) {
      setError('public:reset_password.error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
        <div className="text-center text-graphite">{t('common:loading')}</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
        <Card className="flex flex-col gap-4">
          <div className="text-center">
            <h1 className="text-2xl font-medium text-emerald">{t('public:reset_password.success_title')}</h1>
            <p className="mt-2 text-sm text-graphite">{t('public:reset_password.success_message')}</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
        <Card className="flex flex-col gap-4">
          <AlertBanner messageKey={error} />
          <Button onClick={() => navigate(`/${locale}/login`, { replace: true })} variant="secondary">
            {t('public:reset_password.back_to_login')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
      <h1 className="text-2xl">{t('public:reset_password.title')}</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="mt-6 flex flex-col gap-4">
          <Input
            label={t('public:reset_password.new_password')}
            type="password"
            autoComplete="new-password"
            errorKey={errors.password?.message}
            {...register('password')}
          />
          <Input
            label={t('public:reset_password.confirm_password')}
            type="password"
            autoComplete="new-password"
            errorKey={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? t('common:loading') : t('public:reset_password.submit')}
          </Button>
        </Card>
      </form>
    </div>
  );
}
