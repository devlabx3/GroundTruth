/**
 * Estado de sesión — Zustand guarda SOLO estado efímero de interacción
 * (sesión activa, contexto seleccionado). Nunca duplica datos de servidor
 * que ya viven en TanStack Query (Sistema-de-Diseno §5).
 *
 * "rol ≠ persona" (Modelo-de-Datos §1): los roles se DERIVAN del perfil,
 * no se almacenan como un campo `rol`.
 */
import { create } from 'zustand';
import type { ActiveContext, Membership, Privilege, Profile } from '@/types/api';

interface SessionState {
  profile: Profile | null;
  accessToken: string | null;
  /** Contexto activo cuando el usuario tiene varias membresías o es agricultor-operador. */
  activeContext: ActiveContext | null;

  setSession: (profile: Profile | null, accessToken: string | null) => void;
  /**
   * Rehidrata la sesión al recargar la página: como `setSession`, pero prefiere
   * el contexto que el usuario tenía elegido (persistido y validado contra el
   * perfil real) en vez del derivado. Sin esto, recargar cerraba la sesión.
   */
  restoreSession: (profile: Profile, accessToken: string) => void;
  setActiveContext: (activeContext: ActiveContext | null) => void;
  clear: () => void;

  isAdmin: () => boolean;
  isOperator: () => boolean;
  isFarmer: () => boolean;
  activeMembership: () => Membership | null;
  can: (privilege: Privilege) => boolean;
}

export const useSession = create<SessionState>((set, get) => ({
  profile: null,
  accessToken: null,
  activeContext: null,

  setSession: (profile, accessToken) =>
    set({ profile, accessToken, activeContext: deriveDefaultContext(profile) }),
  restoreSession: (profile, accessToken) => {
    const saved = loadPersistedContext();
    const activeContext = isContextValid(saved, profile) ? saved : deriveDefaultContext(profile);
    persistContext(activeContext);
    set({ profile, accessToken, activeContext });
  },
  setActiveContext: (activeContext) => {
    persistContext(activeContext);
    set({ activeContext });
  },
  clear: () => {
    persistContext(null);
    set({ profile: null, accessToken: null, activeContext: null });
  },

  // ---- Selectores de rol derivados (no almacenados) ----
  isAdmin: () => !!get().profile?.esAdmin,
  isOperator: () => (get().profile?.memberships?.length ?? 0) > 0,
  isFarmer: () => (get().profile?.fincasPropias?.length ?? 0) > 0,

  // Membresía del contexto activo (para resolver privilegios efectivos).
  activeMembership: () => {
    const { profile, activeContext } = get();
    if (!profile || activeContext?.type !== 'operator') return null;
    return profile.memberships?.find((m) => m.operadorId === activeContext.operadorId) ?? null;
  },

  // ¿El usuario tiene este privilegio en el contexto activo?
  can: (privilege) => {
    const membership = get().activeMembership();
    if (get().isAdmin()) return true; // Admin: soporte global
    return !!membership?.privileges?.includes(privilege);
  },
}));

function deriveDefaultContext(profile: Profile | null): ActiveContext | null {
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

// El contexto activo es lo ÚNICO que se persiste (una elección de UI, no dato de
// servidor): sin él, un usuario multi-unidad caería en el selector al recargar. El
// perfil y el token NO se persisten — se rehidratan de /me y de la sesión de Supabase.
const CTX_KEY = 'gt.activeContext';

function persistContext(ctx: ActiveContext | null): void {
  try {
    if (ctx) localStorage.setItem(CTX_KEY, JSON.stringify(ctx));
    else localStorage.removeItem(CTX_KEY);
  } catch {
    /* almacenamiento no disponible (modo privado): no es crítico */
  }
}

function loadPersistedContext(): ActiveContext | null {
  try {
    const raw = localStorage.getItem(CTX_KEY);
    return raw ? (JSON.parse(raw) as ActiveContext) : null;
  } catch {
    return null;
  }
}

// Se valida SIEMPRE contra el perfil que devuelve /me (la autoridad): un contexto
// guardado que ya no corresponde a una membresía real —o de otro usuario— se descarta.
// No es un control de seguridad (el backend autoriza por membresía en cada llamada),
// pero evita dejar la UI en una unidad que el usuario ya no tiene.
function isContextValid(ctx: ActiveContext | null, profile: Profile | null): boolean {
  if (!ctx || !profile) return false;
  if (ctx.type === 'farmer') return (profile.fincasPropias?.length ?? 0) > 0;
  return !!profile.memberships?.some((m) => m.operadorId === ctx.operadorId);
}
