import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { WrenchIcon } from '@phosphor-icons/react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import AlertBanner from '@/components/shared/AlertBanner';
import { zodResolver } from '@/lib/zodResolver';
import { getSupabase } from '@/lib/supabase';
import { api, errorKey } from '@/lib/api';
import { DEMO_PROFILES } from '@/lib/demo';
import { accesosRapidos } from '@/lib/devLogins';
import { useSession } from '@/stores/session';
import { buildContexts } from '@/components/shared/ContextSwitcher';
import type { ActiveContext, Profile } from '@/types/api';

const schema = z.object({
  email: z.string().min(1, 'errors:field_required').email('errors:email_invalid'),
  password: z.string().min(1, 'errors:field_required'),
});

/** Lo que valida el esquema es exactamente lo que recibe `onSubmit`. */
type Credenciales = z.infer<typeof schema>;

/**
 * Login (V4). Con backend: Supabase Auth → perfil (roles derivados) vía NestJS.
 * Sin credenciales configuradas corre en modo maqueta: perfiles de demostración.
 * Tras autenticar, si el usuario tiene más de un contexto (membresías y/o rol
 * agricultor) pasa por el selector de contexto ANTES del shell (Índice §2.2).
 */
export default function LoginPage() {
  const { t } = useTranslation(['public', 'common', 'errors']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useSession((s) => s.profile);
  const activeContext = useSession((s) => s.activeContext);
  const setSession = useSession((s) => s.setSession);
  const setActiveContext = useSession((s) => s.setActiveContext);
  const clear = useSession((s) => s.clear);
  const [pendingContexts, setPendingContexts] = useState<ActiveContext[] | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const demoMode = getSupabase() === null;
  // Vacío en producción (import.meta.env.DEV) y también si no se definen las variables.
  const rapidos = accesosRapidos();

  /** Rellena el formulario y entra por el flujo REAL: Auth → /me → rol derivado. */
  function entrarComo(email: string, password: string) {
    setValue('email', email);
    setValue('password', password);
    void onSubmit({ email, password });
  }

  function surfaceFor(ctx: ActiveContext | null, prof: Profile | null) {
    if (prof?.esAdmin && !ctx) return `/${locale}/admin`;
    if (ctx?.type === 'farmer') return `/${locale}/dapp`;
    return `/${locale}/dashboard`;
  }

  function enter(ctx: ActiveContext | null, prof: Profile | null) {
    const from = (location.state as { from?: string } | null)?.from;
    navigate(from ?? surfaceFor(ctx, prof), { replace: true });
  }

  // Ya hay sesión y contexto resuelto → esta vista redirige (Índice §3, V4).
  useEffect(() => {
    if (profile && (activeContext || profile.esAdmin) && !pendingContexts) {
      navigate(surfaceFor(activeContext, profile), { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Enrutamiento por contexto (§2.2), común a maqueta y real: un solo contexto
  // entra directo; varios pasan por el selector antes del shell.
  function proceedWithProfile(prof: Profile) {
    if (prof.esAdmin) return enter(null, prof);
    const contexts = buildContexts(prof);
    if (contexts.length > 1) {
      setPendingContexts(contexts);
      return;
    }
    const only = contexts[0] ?? null;
    if (only) setActiveContext(only);
    enter(only, prof);
  }

  function loginAs(demoProfile: Profile) {
    setSession(demoProfile, 'demo-token');
    proceedWithProfile(demoProfile);
  }

  function chooseContext(ctx: ActiveContext) {
    setActiveContext(ctx);
    setPendingContexts(null);
    enter(ctx, profile);
  }

  // Login real: Supabase Auth → perfil (roles derivados) vía GET /me.
  const onSubmit = async (values: Credenciales) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      const supabase = getSupabase();
      // Sin Supabase la app corre en modo maqueta y este formulario ni se muestra;
      // el corte existe para que el tipo lo sepa, no por defensa paranoica.
      if (!supabase) return;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (error) {
        setAuthError('errors:credentials_invalid');
        return;
      }
      try {
        const { data: prof } = await api.get('/me');
        setSession(prof, data.session.access_token);
        proceedWithProfile(prof);
      } catch (e) {
        // Autenticó pero el backend rechazó (cuenta inactiva / no aprovisionada).
        await supabase.auth.signOut();
        clear();
        setAuthError(errorKey(e));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingContexts) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
        <h1 className="text-2xl">{t('common:context.choose')}</h1>
        <div className="mt-6 flex flex-col gap-3">
          {pendingContexts.map((ctx) => (
            <Card
              key={ctx.type === 'farmer' ? 'farmer' : ctx.operadorId}
              className="cursor-pointer transition-colors hover:border-emerald"
              onClick={() => chooseContext(ctx)}
            >
              <div className="text-sm font-medium text-ink">
                {ctx.type === 'farmer' ? t('common:context.farmer') : ctx.operadorNombre}
              </div>
              <div className="mt-0.5 text-xs text-graphite">
                {ctx.type === 'farmer' ? t('common:context.farmer_desc') : t('common:context.operator_desc')}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-8">
      <h1 className="text-2xl">{t('common:nav.login')}</h1>
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="mt-6 flex flex-col gap-4">
          {authError && <AlertBanner messageKey={authError} />}
          <Input
            label={t('login.email')}
            type="email"
            autoComplete="email"
            errorKey={errors.email?.message}
            {...register('email')}
          />
          <Input
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
            errorKey={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" disabled={demoMode || submitting}>
            {submitting ? t('common:loading') : t('common:nav.login')}
          </Button>
        </Card>
      </form>

      {/* Accesos rápidos por rol — depuración. No existen en un build de producción:
          `accesosRapidos()` devuelve [] y Vite elimina la rama entera. Las credenciales
          salen del .env, nunca del código. */}
      {!demoMode && rapidos.length > 0 && (
        <div className="mt-8 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-graphite">
            <WrenchIcon size={14} />
            {t('login.dev_hint')}
          </div>
          {rapidos.map((c) => (
            <Button
              key={c.rol}
              variant="secondary"
              disabled={submitting}
              onClick={() => entrarComo(c.email, c.password)}
              className="justify-start"
            >
              <span className="font-medium">{t(`login.dev_roles.${c.rol}`)}</span>
              <span className="truncate text-xs text-graphite">· {c.etiqueta}</span>
            </Button>
          ))}
        </div>
      )}

      {demoMode && (
        <div className="mt-8 flex flex-col gap-3">
          <AlertBanner tone="info" messageKey="public:login.demo_hint" />
          {DEMO_PROFILES.map(({ key, profile: p }) => (
            <Button key={key} variant="secondary" onClick={() => loginAs(p)} className="justify-start">
              <span className="font-medium">{p.nombre}</span>
              <span className="text-xs text-graphite">· {t(`login.demo_roles.${key}`)}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
