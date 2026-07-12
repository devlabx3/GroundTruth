/**
 * Guards de ruta — orden de evaluación exacto de Indice-de-Vistas §2.1:
 *   1. ¿Hay sesión?      → si no, a /login conservando ruta de retorno.
 *   2. ¿Rol == shell?    → si no, 403 y redirección a la superficie correcta.
 *   3. ¿Privilegio?      → (solo Operador) si no, pantalla de bloqueo.
 */
import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useSession } from '@/stores/session';
import { useTranslation } from 'react-i18next';

export function RequireSession() {
  const profile = useSession((s) => s.profile);
  const { locale } = useParams();
  const location = useLocation();
  if (!profile) {
    return <Navigate to={`/${locale}/login`} replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function RequireRole({ role }) {
  const { locale } = useParams();
  const isAdmin = useSession((s) => s.isAdmin());
  const isOperator = useSession((s) => s.isOperator());
  const isFarmer = useSession((s) => s.isFarmer());
  const activeContext = useSession((s) => s.activeContext);

  const roleOk =
    (role === 'admin' && isAdmin) ||
    (role === 'operator' && isOperator && activeContext?.type === 'operator') ||
    (role === 'farmer' && isFarmer && activeContext?.type === 'farmer');

  if (!roleOk) {
    // Redirige a la superficie correcta del rol (Gestion-de-Errores §4).
    if (isFarmer && activeContext?.type === 'farmer') return <Navigate to={`/${locale}/dapp`} replace />;
    if (isOperator) return <Navigate to={`/${locale}/dashboard`} replace />;
    if (isAdmin) return <Navigate to={`/${locale}/admin`} replace />;
    return <Navigate to={`/${locale}/`} replace />;
  }
  return <Outlet />;
}

export function RequirePrivilege({ privilege, children }) {
  const can = useSession((s) => s.can);
  const { t } = useTranslation('errors');
  if (!can(privilege)) {
    return (
      <div className="mx-auto max-w-prose py-16 text-center">
        <p className="text-sm text-graphite">{t('no_access_section')}</p>
      </div>
    );
  }
  return children;
}
