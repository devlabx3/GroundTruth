/**
 * Estado de sesión — Zustand guarda SOLO estado efímero de interacción
 * (sesión activa, contexto seleccionado). Nunca duplica datos de servidor
 * que ya viven en TanStack Query (Sistema-de-Diseno §5).
 *
 * "rol ≠ persona" (Modelo-de-Datos §1): los roles se DERIVAN del perfil,
 * no se almacenan como un campo `rol`.
 */
import { create } from 'zustand';

export const useSession = create((set, get) => ({
  // Perfil que devuelve el backend tras login: { id, nombre, email, esAdmin,
  // memberships: [{ operadorId, operadorNombre, subRolNombre, privileges: [] }],
  // fincasPropias: [ids] }
  profile: null,
  accessToken: null,

  // Contexto activo cuando el usuario tiene varias membresías o es agricultor-operador.
  activeContext: null, // { type: 'operator'|'farmer', operadorId?, operadorNombre? }

  setSession: (profile, accessToken) =>
    set({ profile, accessToken, activeContext: deriveDefaultContext(profile) }),
  setActiveContext: (activeContext) => set({ activeContext }),
  clear: () => set({ profile: null, accessToken: null, activeContext: null }),

  // ---- Selectores de rol derivados (no almacenados) ----
  isAdmin: () => !!get().profile?.esAdmin,
  isOperator: () => (get().profile?.memberships?.length ?? 0) > 0,
  isFarmer: () => (get().profile?.fincasPropias?.length ?? 0) > 0,

  // Membresía del contexto activo (para resolver privilegios efectivos).
  activeMembership: () => {
    const { profile, activeContext } = get();
    if (!profile || activeContext?.type !== 'operator') return null;
    return (
      profile.memberships?.find((m) => m.operadorId === activeContext.operadorId) ?? null
    );
  },

  // ¿El usuario tiene este privilegio en el contexto activo?
  can: (privilege) => {
    const membership = get().activeMembership();
    if (get().isAdmin()) return true; // Admin: soporte global
    return !!membership?.privileges?.includes(privilege);
  },
}));

function deriveDefaultContext(profile) {
  if (!profile) return null;
  const hasOperator = (profile.memberships?.length ?? 0) > 0;
  const hasFarmer = (profile.fincasPropias?.length ?? 0) > 0;
  // Un solo rol → entra directo. Varios → el ContextSwitcher decide.
  if (hasOperator && !hasFarmer) {
    const m = profile.memberships[0];
    return { type: 'operator', operadorId: m.operadorId, operadorNombre: m.operadorNombre };
  }
  if (hasFarmer && !hasOperator) return { type: 'farmer' };
  return null; // ambiguo → requiere selección explícita
}
