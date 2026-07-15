import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import type { Profile } from '@/types/api';

/**
 * Rehidratación de sesión al cargar la app.
 *
 * La sesión de Supabase persiste en localStorage (`persistSession: true`), pero el
 * PERFIL (roles derivados) vive solo en memoria (Zustand, por diseño §5). Al recargar,
 * el perfil se perdía → el guard veía `profile === null` → te echaba a /login. Aquí,
 * si hay una sesión de Supabase válida, se vuelve a pedir `/me` y se restaura.
 *
 * Devuelve `ready`: hasta que sea `true`, la app NO monta el router, para que ningún
 * guard redirija antes de saber si hay sesión (esa carrera era la que cerraba sesión).
 */
export function useAuthBootstrap(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = getSupabase();
      // Modo maqueta (sin Supabase): no hay nada que rehidratar.
      if (!supabase) {
        setReady(true);
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // El token para /me lo pone el interceptor de axios leyendo la sesión viva.
          const { data: profile } = await api.get<Profile>('/me');
          if (!cancelled) useSession.getState().restoreSession(profile, session.access_token);
        }
      } catch {
        // Sesión inválida o backend que rechaza (cuenta desactivada, etc.): se queda
        // sin sesión y el guard llevará a /login con normalidad. No relanzamos.
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return ready;
}
