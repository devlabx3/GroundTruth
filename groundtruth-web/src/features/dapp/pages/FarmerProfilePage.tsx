import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SignOutIcon } from '@phosphor-icons/react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import { useSession } from '@/stores/session';

/** Preferencias del agricultor (F1): idioma + cierre de sesión. */
export default function FarmerProfilePage() {
  const { t } = useTranslation(['farmer', 'common']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const profile = useSession((s) => s.profile);
  const clear = useSession((s) => s.clear);

  function logout() {
    clear();
    navigate(`/${locale}/`);
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl">{t('profile.title')}</h2>
      <Card>
        <div className="text-sm font-medium text-ink">{profile?.nombre}</div>
        <div className="mt-0.5 text-xs text-graphite">{profile?.email}</div>
      </Card>
      <Card className="flex items-center justify-between">
        <span className="text-sm text-graphite">{t('common:language')}</span>
        <LanguageSwitcher />
      </Card>
      <Button variant="secondary" onClick={logout}>
        <SignOutIcon size={16} />
        {t('common:nav.logout')}
      </Button>
    </div>
  );
}
