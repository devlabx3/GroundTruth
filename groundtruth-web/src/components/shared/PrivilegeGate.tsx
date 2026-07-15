/**
 * PrivilegeGate — envuelve ítems de navegación y botones; oculta el contenido
 * si el sub-rol activo no tiene el privilegio (Indice-de-Vistas §5, casos de uso §0).
 * La autorización real la impone el backend; esto es solo la capa de UI.
 */
import type { ReactNode } from 'react';
import { useSession } from '@/stores/session';
import type { Privilege } from '@/types/api';

export interface PrivilegeGateProps {
  privilege: Privilege;
  children: ReactNode;
  fallback?: ReactNode;
}

export default function PrivilegeGate({ privilege, children, fallback = null }: PrivilegeGateProps) {
  const can = useSession((s) => s.can);
  return can(privilege) ? children : fallback;
}
