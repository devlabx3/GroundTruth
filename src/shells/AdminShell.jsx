import { NavLink, Outlet, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Buildings, ShieldCheck, Users, Sliders, Broadcast, MagnifyingGlass, Stack, Heartbeat } from '@phosphor-icons/react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';

/** Admin: sidebar fijo, sin filtrado por privilegio (máximo control). */
const NAV = [
  { to: 'admin', key: 'Panel', icon: MagnifyingGlass, end: true },
  { to: 'admin/unidades', key: 'Unidades', icon: Buildings },
  { to: 'admin/privilegios', key: 'Privilegios', icon: ShieldCheck },
  { to: 'admin/usuarios', key: 'Usuarios', icon: Users },
  { to: 'admin/parametros', key: 'Parámetros', icon: Sliders },
  { to: 'admin/simulador', key: 'Simulador IoT', icon: Broadcast },
  { to: 'admin/saga', key: 'Saga', icon: Stack },
  { to: 'admin/integraciones', key: 'Integraciones', icon: Heartbeat },
];

export default function AdminShell() {
  const { t } = useTranslation('common');
  const { locale } = useParams();
  return (
    <div className="flex min-h-screen bg-porcelain">
      <aside className="flex w-56 shrink-0 flex-col gap-1 bg-ink p-3">
        <div className="px-2 pb-4 pt-2 font-display text-lg text-porcelain">
          {t('brand')} <span className="text-xs text-gold">Admin</span>
        </div>
        {NAV.map(({ to, key, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={`/${locale}/${to}`}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 rounded-card px-2.5 py-2 text-sm ${
                isActive ? 'bg-emerald text-porcelain' : 'text-porcelain/80 hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {key}
          </NavLink>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-porcelain-border bg-white px-6 py-3">
          <LanguageSwitcher />
        </header>
        <main className="min-w-0 flex-1 p-6"><Outlet /></main>
      </div>
    </div>
  );
}
