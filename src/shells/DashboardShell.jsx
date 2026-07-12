import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapTrifold, Plant, Truck, Wallet, SealCheck, UsersThree, Gear,
} from '@phosphor-icons/react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import PrivilegeGate from '@/components/shared/PrivilegeGate';
import { PRIVILEGES } from '@/lib/privileges';
import { useSession } from '@/stores/session';

/** Ítems del sidebar, cada uno con el privilegio que lo habilita (Indice-de-Vistas §5). */
const NAV = [
  { to: 'dashboard', key: 'nav.map', icon: MapTrifold, privilege: null },
  { to: 'dashboard/topologia', key: 'nav.parcels', icon: Plant, privilege: PRIVILEGES.TOPOLOGY_MANAGE },
  { to: 'dashboard/embarques', key: 'nav.shipments', icon: Truck, privilege: PRIVILEGES.SHIPMENTS_PREPARE },
  { to: 'dashboard/tesoreria', key: 'nav.treasury', icon: Wallet, privilege: PRIVILEGES.TREASURY_VIEW },
  { to: 'dashboard/certificados', key: 'nav.certificates', icon: SealCheck, privilege: PRIVILEGES.CERTS_VIEW },
  { to: 'dashboard/agricultores', key: 'nav.farmers', icon: UsersThree, privilege: PRIVILEGES.FARMERS_MANAGE },
  { to: 'dashboard/equipo', key: 'nav.team', icon: UsersThree, privilege: PRIVILEGES.TEAM_MANAGE },
  { to: 'dashboard/configuracion', key: 'nav.settings', icon: Gear, privilege: PRIVILEGES.UNIT_CONFIGURE },
];

export default function DashboardShell() {
  const { t } = useTranslation('common');
  const { locale } = useParams();
  const ctx = useSession((s) => s.activeContext);

  return (
    <div className="flex min-h-screen bg-porcelain">
      <aside className="flex w-56 shrink-0 flex-col gap-1 bg-ink p-3">
        <div className="px-2 pb-4 pt-2 font-display text-lg text-porcelain">{t('brand')}</div>
        {NAV.map(({ to, key, icon: Icon, privilege }) => {
          const item = (
            <NavLink
              key={to}
              to={`/${locale}/${to}`}
              end={to === 'dashboard'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-card px-2.5 py-2 text-sm ${
                  isActive ? 'bg-emerald text-porcelain' : 'text-porcelain/80 hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              {t(key)}
            </NavLink>
          );
          return privilege ? (
            <PrivilegeGate key={to} privilege={privilege}>{item}</PrivilegeGate>
          ) : item;
        })}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-porcelain-border bg-white px-6 py-3">
          <span className="text-sm font-medium text-ink">{ctx?.operadorNombre ?? ''}</span>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
}
