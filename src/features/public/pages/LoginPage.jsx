import { useTranslation } from 'react-i18next';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

/**
 * Login (V4). El submit real usará Supabase Auth y luego cargará el perfil
 * (roles derivados) vía backend. Aquí queda la superficie lista.
 */
export default function LoginPage() {
  const { t } = useTranslation('common');
  return (
    <div className="mx-auto max-w-sm px-6 py-24">
      <h1 className="text-2xl">{t('nav.login')}</h1>
      <Card className="mt-6 flex flex-col gap-4">
        <input placeholder="correo@ejemplo.com" className="rounded-card border border-porcelain-border px-3 py-2" />
        <input type="password" placeholder="••••••••" className="rounded-card border border-porcelain-border px-3 py-2" />
        <Button>{t('nav.login')}</Button>
      </Card>
    </div>
  );
}
