/**
 * Cliente Supabase — SOLO Auth, Storage y Realtime.
 * Prohibido usarlo para consultar tablas de negocio: eso es responsabilidad
 * exclusiva del backend NestJS vía `api` (Modelo-de-Datos §7, Sistema-de-Diseno §5).
 *
 * El paquete @supabase/supabase-js se instala cuando se implemente el login real;
 * por ahora se exporta un stub para no acoplar el arranque a credenciales.
 */
let client = null;

export function getSupabase() {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Sin credenciales aún: la app corre en modo maqueta (sin auth real).
    return null;
  }
  // Cuando se instale supabase-js:
  //   import { createClient } from '@supabase/supabase-js';
  //   client = createClient(url, key, { auth: { persistSession: true } });
  return client;
}
