import { Link, Outlet, useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShieldCheckIcon } from '@phosphor-icons/react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import Logo from '@/components/shared/Logo';
import Button from '@/components/ui/Button';

export default function PublicShell() {
  const { t } = useTranslation(['common']);
  const { locale } = useParams();
  // En /login el botón de acceso del header sobra: el formulario ya es esa acción.
  const enLogin = useLocation().pathname.endsWith('/login');
  return (
    <div className="flex min-h-screen flex-col bg-porcelain">
      <header className="border-b border-porcelain-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to={`/${locale}/`}>
            <Logo className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-3">
            <Link to={`/${locale}/verificar`}>
              <Button variant="primary">
                <ShieldCheckIcon size={16} weight="bold" />
                {t('nav.verify')}
              </Button>
            </Link>
            <LanguageSwitcher />
            {!enLogin && (
              <Link to={`/${locale}/login`}>
                <Button variant="secondary">{t('nav.login')}</Button>
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col"><Outlet /></main>
      <footer className="border-t border-porcelain-border">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-8 text-xs text-graphite">
          <Logo className="h-5 w-auto" />
          <span className="mx-2">·</span>
          <span>{t('footer.regulation')}</span>
        </div>
      </footer>
    </div>
  );
}
