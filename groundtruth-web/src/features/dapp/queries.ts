/**
 * Capa de datos del Agricultor (DApp lite). Backend real cuando Supabase está
 * configurado; fixtures en modo maqueta. Adapta la forma del API a las vistas.
 */
import { getSupabase } from '@/lib/supabase';
import { api, ApiError } from '@/lib/api';
import { demoQueryFn } from '@/lib/demo';
import { FARMER_ALERTS, FARMER_PARCELS } from './fixtures';
import type {
  AlertaAgricultor,
  ParcelaAgricultor,
  ParcelaAgricultorDetalle,
} from '@/types/api';

const isDemo = () => getSupabase() === null;

export async function fetchAlertas(): Promise<AlertaAgricultor[]> {
  if (isDemo()) return demoQueryFn(FARMER_ALERTS)();
  const { data } = await api.get<AlertaAgricultor[]>('/farmer/alertas');
  return data;
}

export async function fetchParcelas(): Promise<ParcelaAgricultor[]> {
  if (isDemo()) return demoQueryFn(FARMER_PARCELS)();
  const { data } = await api.get<ParcelaAgricultor[]>('/farmer/parcelas');
  return data;
}

export async function fetchParcela(id: string): Promise<ParcelaAgricultorDetalle | null> {
  if (isDemo()) {
    return (
      (FARMER_PARCELS.find((p) => p.id === id) as ParcelaAgricultorDetalle | undefined) ?? null
    );
  }
  try {
    const { data } = await api.get<ParcelaAgricultorDetalle>(`/farmer/parcelas/${id}`);
    return data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Cierra el ciclo activo y abre uno nuevo. Bloqueado si hay una certificación en curso. */
export async function declararNuevaSiembra(id: string): Promise<{ cicloId: string }> {
  const { data } = await api.post<{ cicloId: string }>(`/farmer/parcelas/${id}/nueva-siembra`);
  return data;
}
