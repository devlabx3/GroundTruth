import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DEFAULT_LOCALE } from '@/i18n';
import { RequireSession, RequireRole } from './guards';

import PublicShell from '@/shells/PublicShell';
import DAppLiteShell from '@/shells/DAppLiteShell';
import DashboardShell from '@/shells/DashboardShell';
import AdminShell from '@/shells/AdminShell';

import LandingPage from '@/features/public/pages/LandingPage';
import VerifierPage from '@/features/public/pages/VerifierPage';
import ContactPage from '@/features/public/pages/ContactPage';
import LoginPage from '@/features/public/pages/LoginPage';
import FarmerHome from '@/features/dapp/pages/FarmerHome';
import DashboardHome from '@/features/dashboard/pages/DashboardHome';
import PlaceholderPage from '@/features/dashboard/pages/PlaceholderPage';

// Vistas de dashboard/admin aún no implementadas → placeholder estructurado.
const P = (title) => <PlaceholderPage title={title} />;

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to={`/${DEFAULT_LOCALE}/`} replace /> },
  {
    path: '/:locale',
    children: [
      // ---- Público (sin guard) ----
      {
        element: <PublicShell />,
        children: [
          { index: true, element: <LandingPage /> },
          { path: 'verificar', element: <VerifierPage /> },
          { path: 'verificar/:certId', element: <VerifierPage /> },
          { path: 'contacto', element: <ContactPage /> },
          { path: 'login', element: <LoginPage /> },
        ],
      },
      // ---- Agricultor (sesión + rol FARMER) ----
      {
        element: <RequireSession />,
        children: [
          {
            element: <RequireRole role="farmer" />,
            children: [
              { element: <DAppLiteShell />, children: [
                { path: 'dapp', element: <FarmerHome /> },
                { path: 'dapp/parcelas', element: <FarmerHome /> },
              ]},
            ],
          },
          // ---- Operador (sesión + rol OPERATOR + privilegio por sub-ruta) ----
          {
            element: <RequireRole role="operator" />,
            children: [
              { element: <DashboardShell />, children: [
                { path: 'dashboard', element: <DashboardHome /> },
                { path: 'dashboard/topologia', element: P('Fincas y parcelas') },
                { path: 'dashboard/embarques', element: P('Embarques') },
                { path: 'dashboard/tesoreria', element: P('Tesorería') },
                { path: 'dashboard/certificados', element: P('Certificados') },
                { path: 'dashboard/agricultores', element: P('Agricultores') },
                { path: 'dashboard/equipo', element: P('Equipo y sub-roles') },
                { path: 'dashboard/configuracion', element: P('Configuración') },
              ]},
            ],
          },
          // ---- Admin (sesión + rol ADMIN) ----
          {
            element: <RequireRole role="admin" />,
            children: [
              { element: <AdminShell />, children: [
                { path: 'admin', element: P('Panel global') },
                { path: 'admin/unidades', element: P('Unidades de negocio') },
                { path: 'admin/privilegios', element: P('Catálogo de privilegios') },
                { path: 'admin/usuarios', element: P('Soporte de usuarios') },
                { path: 'admin/parametros', element: P('Parámetros del sistema') },
                { path: 'admin/simulador', element: P('Simulador IoT') },
                { path: 'admin/saga', element: P('Auditoría del saga') },
                { path: 'admin/integraciones', element: P('Salud de integraciones') },
              ]},
            ],
          },
        ],
      },
    ],
  },
]);
