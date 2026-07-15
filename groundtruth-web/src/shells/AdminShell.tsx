import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  BuildingsIcon, ShieldCheckIcon, UsersIcon, SlidersIcon, BroadcastIcon, MagnifyingGlassIcon, StackIcon,
  HeartbeatIcon, SealCheckIcon, BinocularsIcon, SignOutIcon, CoinsIcon,
} from '@phosphor-icons/react';
import LanguageSwitcher from '@/components/shared/LanguageSwitcher';
import Logo from '@/components/shared/Logo';
import IntegrationHealthBadge from '@/features/admin/components/IntegrationHealthBadge';
import { useSession } from '@/stores/session';

/** Admin: sidebar fijo, sin filtrado por privilegio (máximo control). */
const NAV = [
  { to: 'admin', key: 'nav.panel', icon: MagnifyingGlassIcon, end: true },
  { to: 'admin/unidades', key: 'nav.units', icon: BuildingsIcon },
  { to: 'admin/privilegios', key: 'nav.privileges', icon: ShieldCheckIcon },
  { to: 'admin/usuarios', key: 'nav.users', icon: UsersIcon },
  { to: 'admin/parametros', key: 'nav.params', icon: SlidersIcon },
  { to: 'admin/simulador', key: 'nav.simulator', icon: BroadcastIcon },
  { to: 'admin/supervision', key: 'nav.supervision', icon: BinocularsIcon },
  { to: 'admin/saga', key: 'nav.saga', icon: StackIcon },
  { to: 'admin/certificados', key: 'nav.certificates', icon: SealCheckIcon },
  { to: 'admin/finanzas', key: 'nav.finances', icon: CoinsIcon },
  { to: 'admin/integraciones', key: 'nav.integrations', icon: HeartbeatIcon },
];

export default function AdminShell() {
  const { t } = useTranslation(['common', 'admin']);
  const { locale } = useParams();
  const navigate = useNavigate();
  const clear = useSession((s) => s.clear);

  function logout() {
    clear();
    navigate(`/${locale}/`);
  }

  return (
    <div className="flex min-h-screen bg-porcelain">
      <aside className="flex w-56 shrink-0 flex-col gap-1 bg-ink p-3">
        <div className="flex items-center gap-2 px-2 pb-4 pt-2">
          <Logo variant="inverse" className="h-7 w-auto" />
          <span className="text-xs font-medium text-gold">Admin</span>
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
            {t(`admin:${key}`)}
          </NavLink>
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {/* La barra (borde/fondo) va a ancho completo; su CONTENIDO se capa y centra a
            max-w-panel para alinear con el <main> — si no, la cabecera queda más ancha
            que el contenido y todo se ve descuadrado. */}
        <header className="border-b border-porcelain-border bg-white">
          <div className="mx-auto flex max-w-panel items-center justify-end gap-3 px-6 py-3">
            <IntegrationHealthBadge />
            <LanguageSwitcher size="sm" />
            <button
              onClick={logout}
              className="rounded-card p-1.5 text-graphite hover:bg-porcelain hover:text-ink"
              aria-label={t('common:nav.logout')}
              title={t('common:nav.logout')}
            >
              <SignOutIcon size={18} />
            </button>
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
