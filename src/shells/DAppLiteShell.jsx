import { Link, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

export default function DAppLiteShell() {
  const { t } = useTranslation('common');
  const { locale } = useParams();
  return (
    <div className="min-h-screen bg-porcelain">
      <header className="border-b border-porcelain-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to={`/${locale}/dapp`} className="font-display text-lg text-emerald">
            {t('brand')}
          </Link>
          <LanguageSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
