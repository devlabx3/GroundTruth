/**
 * Cliente Supabase — SOLO Auth, Storage y Realtime.
 * Prohibido usarlo para consultar tablas de negocio: eso es responsabilidad
 * exclusiva del backend NestJS vía `api` (Modelo-de-Datos §7, Sistema-de-Diseno §5).
 *
 * Sin `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` devuelve null y la app corre
 * en modo maqueta (perfiles demo). Con credenciales, login/sesión son reales.
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** `null` = modo maqueta. Es el interruptor que decide si la app habla con el backend real. */
export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // modo maqueta
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
