/**
 * Modo maqueta: perfiles y utilidades de demo mientras no existe el backend.
 * Los perfiles imitan exactamente la forma que devolverá NestJS tras login
 * (stores/session.js). Al implementar Supabase Auth + backend, este archivo
 * deja de usarse en login y puede eliminarse.
 */
import { PRIVILEGES } from './privileges';
import type { Privilege, Profile } from '@/types/api';

const ALL_PRIVILEGES: Privilege[] = Object.values(PRIVILEGES);

interface DemoProfile {
  key: string;
  profile: Profile;
}

export const DEMO_PROFILES: DemoProfile[] = [
  {
    key: 'operator',
    profile: {
      id: 'u-demo-lucia',
      nombre: 'Lucía Fernández',
      email: 'lucia@sierraverde.coop',
      esAdmin: false,
      memberships: [
        {
          operadorId: 'op-1',
          operadorNombre: 'Coop. Sierra Verde',
          subRolNombre: 'Dirección',
          privileges: ALL_PRIVILEGES,
        },
      ],
      // También es agricultora → ejercita el selector de contexto (§2.2).
      fincasPropias: ['finca-9'],
    },
  },
  {
    key: 'logistics',
    profile: {
      id: 'u-demo-tomas',
      nombre: 'Tomás Rivas',
      email: 'tomas@sierraverde.coop',
      esAdmin: false,
      memberships: [
        {
          operadorId: 'op-1',
          operadorNombre: 'Coop. Sierra Verde',
          subRolNombre: 'Logística',
          // Sin certificados.emitir → demuestra el flujo "listo para aprobación".
          privileges: [
            PRIVILEGES.SHIPMENTS_PREPARE,
            PRIVILEGES.CERTS_VIEW,
            PRIVILEGES.TOPOLOGY_MANAGE,
            PRIVILEGES.TELEMETRY_VIEW,
          ],
        },
      ],
      fincasPropias: [],
    },
  },
  {
    key: 'farmer',
    profile: {
      id: 'u-demo-pedro',
      nombre: 'Pedro Ayala',
      email: 'pedro.ayala@correo.hn',
      esAdmin: false,
      memberships: [],
      fincasPropias: ['finca-1'],
    },
  },
  {
    key: 'admin',
    profile: {
      id: 'u-demo-admin',
      nombre: 'Soporte GroundTruth',
      email: 'soporte@groundtruth.io',
      esAdmin: true,
      memberships: [],
      fincasPropias: [],
    },
  },
];

/** queryFn de maqueta: resuelve el fixture tras una latencia breve (muestra skeletons). */
export function demoQueryFn<T>(data: T, ms = 350): () => Promise<T> {
  return () => new Promise<T>((resolve) => setTimeout(() => resolve(data), ms));
}
