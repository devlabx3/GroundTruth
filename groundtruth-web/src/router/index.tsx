/**
 * Router — espejo 1:1 de GroundTruth-Indice-de-Vistas-y-Navegacion.md.
 * Guards en el orden del §2.1: sesión → rol → privilegio (solo Operador).
 * Regla §8: ninguna ruta se agrega aquí sin existir antes en el índice.
 *
 * Code-splitting: cada vista es un chunk (React.lazy) — Leaflet y Recharts
 * solo se descargan en las vistas que los usan. Los shells quedan eager.
 */
import { lazy, Suspense } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DEFAULT_LOCALE } from '@/i18n';
import { RequireSession, RequireRole, RequirePrivilege } from './guards';
import { PRIVILEGES } from '@/lib/privileges';
import { SkeletonRows } from '@/components/ui/Skeleton';
import type { Privilege } from '@/types/api';

import PublicShell from '@/shells/PublicShell';
import DAppLiteShell from '@/shells/DAppLiteShell';
import DashboardShell from '@/shells/DashboardShell';
import AdminShell from '@/shells/AdminShell';

// Carga diferida con fallback de skeleton (carga = skeleton, Errores §7.1).
const page = (loader: () => Promise<{ default: ComponentType }>) => {
  const Component = lazy(loader);
  return (
    <Suspense fallback={<div className="p-2"><SkeletonRows rows={4} /></div>}>
      <Component />
    </Suspense>
  );
};

// Sub-rutas del Operador: sin el privilegio no se renderiza ni por URL directa (§2.1.3).
const gated = (privilege: Privilege, element: ReactNode) => (
  <RequirePrivilege privilege={privilege}>{element}</RequirePrivilege>
);

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={`/${DEFAULT_LOCALE}/`} replace /> },
  {
    path: '/:locale',
    children: [
      // ---- Público (sin guard) ----
      {
        element: <PublicShell />,
        children: [
          { index: true, element: page(() => import('@/features/public/pages/LandingPage')) },
          { path: 'verificar', element: page(() => import('@/features/public/pages/VerifierPage')) },
          { path: 'verificar/:certId', element: page(() => import('@/features/public/pages/VerifierPage')) },
          { path: 'contacto', element: page(() => import('@/features/public/pages/ContactPage')) },
          { path: 'login', element: page(() => import('@/features/public/pages/LoginPage')) },
        ],
      },
      // ---- Autenticado (sesión) ----
      {
        element: <RequireSession />,
        children: [
          // ---- Agricultor (rol FARMER) ----
          {
            element: <RequireRole role="farmer" />,
            children: [
              { element: <DAppLiteShell />, children: [
                { path: 'dapp', element: page(() => import('@/features/dapp/pages/FarmerHome')) },
                { path: 'dapp/parcelas', element: page(() => import('@/features/dapp/pages/FarmerParcelsPage')) },
                { path: 'dapp/parcelas/:id', element: page(() => import('@/features/dapp/pages/FarmerParcelDetailPage')) },
                { path: 'dapp/parcelas/:id/nueva-siembra', element: page(() => import('@/features/dapp/pages/FarmerNewPlantingPage')) },
                { path: 'dapp/perfil', element: page(() => import('@/features/dapp/pages/FarmerProfilePage')) },
              ]},
            ],
          },
          // ---- Operador (rol OPERATOR + privilegio por sub-ruta) ----
          {
            element: <RequireRole role="operator" />,
            children: [
              { element: <DashboardShell />, children: [
                { path: 'dashboard', element: page(() => import('@/features/dashboard/pages/DashboardHome')) },
                { path: 'dashboard/tesoreria', element: gated(PRIVILEGES.TREASURY_VIEW, page(() => import('@/features/dashboard/pages/TreasuryPage'))) },
                { path: 'dashboard/topologia', element: gated(PRIVILEGES.TOPOLOGY_MANAGE, page(() => import('@/features/dashboard/pages/TopologyPage'))) },
                { path: 'dashboard/topologia/nueva', element: gated(PRIVILEGES.TOPOLOGY_MANAGE, page(() => import('@/features/dashboard/pages/TopologyNewPage'))) },
                {
                  path: 'dashboard/topologia/:id',
                  element: (
                    <RequirePrivilege anyOf={[PRIVILEGES.TOPOLOGY_MANAGE, PRIVILEGES.TELEMETRY_VIEW]}>
                      {page(() => import('@/features/dashboard/pages/TopologyDetailPage'))}
                    </RequirePrivilege>
                  ),
                },
                { path: 'dashboard/agricultores', element: gated(PRIVILEGES.FARMERS_MANAGE, page(() => import('@/features/dashboard/pages/FarmersPage'))) },
                { path: 'dashboard/embarques', element: gated(PRIVILEGES.SHIPMENTS_PREPARE, page(() => import('@/features/dashboard/pages/ShipmentsPage'))) },
                { path: 'dashboard/embarques/nuevo', element: gated(PRIVILEGES.SHIPMENTS_PREPARE, page(() => import('@/features/dashboard/pages/ShipmentNewPage'))) },
                { path: 'dashboard/embarques/:id', element: gated(PRIVILEGES.SHIPMENTS_PREPARE, page(() => import('@/features/dashboard/pages/ShipmentDetailPage'))) },
                { path: 'dashboard/certificados', element: gated(PRIVILEGES.CERTS_VIEW, page(() => import('@/features/dashboard/pages/CertificatesPage'))) },
                { path: 'dashboard/certificados/:id', element: gated(PRIVILEGES.CERTS_VIEW, page(() => import('@/features/dashboard/pages/CertificateDetailPage'))) },
                { path: 'dashboard/equipo', element: gated(PRIVILEGES.TEAM_MANAGE, page(() => import('@/features/dashboard/pages/TeamPage'))) },
                { path: 'dashboard/configuracion', element: gated(PRIVILEGES.UNIT_CONFIGURE, page(() => import('@/features/dashboard/pages/UnitSettingsPage'))) },
              ]},
            ],
          },
          // ---- Admin (rol ADMIN, sidebar fijo sin gates) ----
          {
            element: <RequireRole role="admin" />,
            children: [
              { element: <AdminShell />, children: [
                { path: 'admin', element: page(() => import('@/features/admin/pages/AdminHomePage')) },
                { path: 'admin/unidades', element: page(() => import('@/features/admin/pages/AdminUnitsPage')) },
                { path: 'admin/unidades/nueva', element: page(() => import('@/features/admin/pages/AdminUnitNewPage')) },
                { path: 'admin/unidades/:id', element: page(() => import('@/features/admin/pages/AdminUnitDetailPage')) },
                { path: 'admin/privilegios', element: page(() => import('@/features/admin/pages/AdminPrivilegesPage')) },
                { path: 'admin/usuarios', element: page(() => import('@/features/admin/pages/AdminUsersPage')) },
                { path: 'admin/parametros', element: page(() => import('@/features/admin/pages/AdminParamsPage')) },
                { path: 'admin/simulador', element: page(() => import('@/features/admin/pages/AdminSimulatorPage')) },
                { path: 'admin/supervision', element: page(() => import('@/features/admin/pages/AdminSupervisionPage')) },
                { path: 'admin/saga', element: page(() => import('@/features/admin/pages/AdminSagaPage')) },
                { path: 'admin/certificados', element: page(() => import('@/features/admin/pages/AdminCertificatesPage')) },
                { path: 'admin/finanzas', element: page(() => import('@/features/admin/pages/AdminFinancesPage')) },
                { path: 'admin/integraciones', element: page(() => import('@/features/admin/pages/AdminIntegrationsPage')) },
              ]},
            ],
          },
        ],
      },
    ],
  },
]);
