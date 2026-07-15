import { Link, NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BellIcon, PlantIcon, UserIcon } from '@phosphor-icons/react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import ContextSwitcher from '@/components/shared/ContextSwitcher';
import Logo from '@/components/shared/Logo';

/**
 * DApp lite del agricultor: header simple + contenido de una columna,
 * sin sidebar (Índice §2). Navegación mínima de 3 destinos.
 */
const NAV = [
  { to: 'dapp', key: 'nav.alerts', icon: BellIcon, end: true },
  { to: 'dapp/parcelas', key: 'nav.parcels', icon: PlantIcon },
  { to: 'dapp/perfil', key: 'nav.profile', icon: UserIcon },
];

export default function DAppLiteShell() {
  const { t } = useTranslation(['common', 'farmer']);
  const { locale } = useParams();
  return (
    <div className="min-h-screen bg-porcelain">
      <header className="border-b border-porcelain-border bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to={`/${locale}/dapp`}>
            <Logo className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-3">
            <ContextSwitcher />
            <LanguageSwitcher size="sm" />
          </div>
        </div>
        <nav className="mx-auto flex max-w-2xl gap-1 px-4 pb-2">
          {NAV.map(({ to, key, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={`/${locale}/${to}`}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-card px-2.5 py-1.5 text-xs ${
                  isActive ? 'bg-emerald text-porcelain' : 'text-graphite hover:bg-porcelain'
                }`
              }
            >
              <Icon size={15} />
              {t(`farmer:${key}`)}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6"><Outlet /></main>
    </div>
  );
}
