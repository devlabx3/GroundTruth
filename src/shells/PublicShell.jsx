import { Link, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import Button from '@/components/ui/Button';

export default function PublicShell() {
  const { t } = useTranslation(['common']);
  const { locale } = useParams();
  return (
    <div className="min-h-screen bg-porcelain">
      <header className="border-b border-porcelain-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to={`/${locale}/`} className="font-display text-lg text-emerald">
            {t('brand')}
          </Link>
          <nav className="flex items-center gap-4">
            <Link to={`/${locale}/verificar`} className="text-sm text-ink hover:text-emerald">
              {t('nav.verify')}
            </Link>
            <LanguageSwitcher />
            <Link to={`/${locale}/login`}>
              <Button variant="secondary">{t('nav.login')}</Button>
            </Link>
          </nav>
        </div>
      </header>
      <main><Outlet /></main>
      <footer className="mt-24 border-t border-porcelain-border">
        <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-graphite">
          <span className="font-display text-emerald">{t('brand')}</span>
          <span className="mx-2">·</span>
          <span>Reglamento (UE) 2023/1115 (EUDR)</span>
        </div>
      </footer>
    </div>
  );
}
