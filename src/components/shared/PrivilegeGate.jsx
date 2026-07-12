/**
 * PrivilegeGate — envuelve ítems de navegación y botones; oculta el contenido
 * si el sub-rol activo no tiene el privilegio (Indice-de-Vistas §5, casos de uso §0).
 * La autorización real la impone el backend; esto es solo la capa de UI.
 */
import { useSession } from '@/stores/session';

export default function PrivilegeGate({ privilege, children, fallback = null }) {
  const can = useSession((s) => s.can);
  return can(privilege) ? children : fallback;
}
