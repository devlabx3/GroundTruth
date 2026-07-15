import { NavLink, Outlet, useNavigate, useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MapTrifoldIcon, PlantIcon, TruckIcon, WalletIcon, SealCheckIcon, UsersThreeIcon, UserListIcon, GearIcon, SignOutIcon,
} from '@phosphor-icons/react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import ContextSwitcher from '@/components/shared/ContextSwitcher';
import Logo from '@/components/shared/Logo';
import PrivilegeGate from '@/components/shared/PrivilegeGate';
import { PRIVILEGES } from '@/lib/privileges';
import { useSession } from '@/stores/session';
// Saldo de maqueta; con backend llega por query + Realtime (webhook Helius).
import { TREASURY } from '@/features/dashboard/fixtures';

/** Ítems del sidebar, cada uno con el privilegio que lo habilita (Indice-de-Vistas §5). */
const NAV = [
  { to: 'dashboard', key: 'nav.map', icon: MapTrifoldIcon, privilege: null },
  { to: 'dashboard/topologia', key: 'nav.parcels', icon: PlantIcon, privilege: PRIVILEGES.TOPOLOGY_MANAGE },
  { to: 'dashboard/embarques', key: 'nav.shipments', icon: TruckIcon, privilege: PRIVILEGES.SHIPMENTS_PREPARE },
  { to: 'dashboard/tesoreria', key: 'nav.treasury', icon: WalletIcon, privilege: PRIVILEGES.TREASURY_VIEW },
  { to: 'dashboard/certificados', key: 'nav.certificates', icon: SealCheckIcon, privilege: PRIVILEGES.CERTS_VIEW },
  { to: 'dashboard/agricultores', key: 'nav.farmers', icon: UserListIcon, privilege: PRIVILEGES.FARMERS_MANAGE },
  { to: 'dashboard/equipo', key: 'nav.team', icon: UsersThreeIcon, privilege: PRIVILEGES.TEAM_MANAGE },
  { to: 'dashboard/configuracion', key: 'nav.settings', icon: GearIcon, privilege: PRIVILEGES.UNIT_CONFIGURE },
];

export default function DashboardShell() {
  const { t, i18n } = useTranslation('common');
  const { locale } = useParams();
  const navigate = useNavigate();
  const ctx = useSession((s) => s.activeContext);
  const clear = useSession((s) => s.clear);
  const numFmt = new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2 });

  function logout() {
    clear();
    navigate(`/${locale}/`);
  }

  return (
    <div className="flex min-h-screen bg-porcelain">
      <aside className="flex w-56 shrink-0 flex-col gap-1 bg-ink p-3">
        <div className="px-2 pb-4 pt-2">
          <Logo variant="inverse" className="h-8 w-auto" />
        </div>
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
        {/* La barra (borde/fondo) va a ancho completo; su CONTENIDO se capa y centra a
            max-w-panel para alinear con el <main> — si no, la cabecera queda más ancha
            que el contenido y todo se ve descuadrado. */}
        <header className="border-b border-porcelain-border bg-white">
          <div className="mx-auto flex max-w-panel items-center justify-between px-6 py-3">
            <span className="text-sm font-medium text-ink">{ctx?.type === 'operator' ? ctx.operadorNombre : ''}</span>
            <div className="flex items-center gap-3">
              <PrivilegeGate privilege={PRIVILEGES.TREASURY_VIEW}>
                <Link
                  to={`/${locale}/dashboard/tesoreria`}
                  className="rounded-card border border-porcelain-border bg-white px-2.5 py-1.5 font-mono text-xs text-ink hover:bg-porcelain"
                >
                  {numFmt.format(TREASURY.saldoUsdc)} USDC
                </Link>
              </PrivilegeGate>
              <ContextSwitcher />
              <LanguageSwitcher size="sm" />
              <button
                onClick={logout}
                className="rounded-card p-1.5 text-graphite hover:bg-porcelain hover:text-ink"
                aria-label={t('nav.logout')}
                title={t('nav.logout')}
              >
                <SignOutIcon size={18} />
              </button>
            </div>
          </div>
        </header>
        {/* Contenido capado a max-w-panel (1440px) y centrado. `w-full` es CLAVE: sin él,
            el <main> (ítem flex con mx-auto) se encoge a su contenido en vez de llenar los
            1440px, y el contenido queda angosto y desalineado de la cabecera. */}
        <main className="mx-auto min-w-0 w-full flex-1 max-w-panel p-6"><Outlet /></main>
      </div>
    </div>
  );
}
