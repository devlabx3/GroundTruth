/**
 * Catálogo de privilegios — espejo de catalogo_privilegios (Modelo-de-Datos §1.1)
 * y de la sección 0.2 de los casos de uso. La plataforma define estas claves;
 * las unidades las combinan en sub-roles dinámicos.
 */
import type { Privilege } from '@/types/api';

export const PRIVILEGES = {
  UNIT_CONFIGURE: 'unidad.configurar',
  TEAM_MANAGE: 'equipo.gestionar',
  FARMERS_MANAGE: 'agricultores.gestionar',
  TOPOLOGY_MANAGE: 'topologia.gestionar',
  TELEMETRY_VIEW: 'telemetria.ver',
  TREASURY_VIEW: 'tesoreria.ver',
  SHIPMENTS_PREPARE: 'embarques.preparar',
  CERTS_ISSUE: 'certificados.emitir', // sensible ⚠⚠ — debita tesorería
  CERTS_REVOKE: 'certificados.revocar', // sensible ⚠⚠
  CERTS_VIEW: 'certificados.ver',
} as const satisfies Record<string, Privilege>;

// Privilegios sensibles: exigen confirmación explícita al asignarse a un sub-rol.
export const SENSITIVE_PRIVILEGES: ReadonlySet<Privilege> = new Set<Privilege>([
  PRIVILEGES.CERTS_ISSUE,
  PRIVILEGES.CERTS_REVOKE,
]);
