/**
 * Realtime como CAMPANA, no como cartero.
 *
 * Supabase Realtime entrega la fila cambiada dentro del evento. Usar ese dato
 * sería leer negocio directamente de Postgres desde el navegador, que es justo lo
 * que prohíbe el Sistema de Diseño §5: **todo dato de negocio pasa por NestJS**.
 *
 * Así que el payload se IGNORA a propósito. Del evento solo se aprovecha el hecho
 * de que algo cambió, y la reacción es invalidar la caché de TanStack Query — que
 * vuelve a pedir el dato por el backend, con sus guards y sus privilegios. Se gana
 * la inmediatez sin abrir un segundo canal de datos.
 *
 * La privacidad la impone RLS, que Realtime evalúa por suscriptor: un operador solo
 * recibe eventos de las filas que sus políticas le dejan ver.
 */
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from './supabase';

export type EstadoRealtime = 'inactivo' | 'conectando' | 'conectado' | 'reintentando';

/** Ventana de agrupación. Ver `useRealtimeInvalidation`. */
const AGRUPAR_MS = 1500;

export interface OpcionesRealtime {
  /** Tabla publicada en `supabase_realtime` (migración 0010). */
  tabla: string;
  /** Query de TanStack a invalidar cuando la tabla cambie. */
  queryKey: QueryKey;
  /** Filtro de Postgres, p. ej. `operador_id=eq.<uuid>`. RLS ya acota; esto solo afina. */
  filtro?: string;
}

/**
 * Suscribe una tabla y refresca una query cuando cambia.
 *
 * Las invalidaciones se AGRUPAN: `lecturas_telemetria` recibe una fila por sensor y
 * por lectura — el simulador puede meter cientos de golpe. Invalidar en cada evento
 * dispararía un refetch por fila y convertiría la mejora en una tormenta de
 * peticiones. Con la ventana, mil inserciones seguidas cuestan **un** refetch.
 */
export function useRealtimeInvalidation({
  tabla,
  queryKey,
  filtro,
}: OpcionesRealtime): EstadoRealtime {
  const queryClient = useQueryClient();
  // El estado inicial se DERIVA, no se escribe desde el efecto: llamar a setState en
  // el cuerpo de un useEffect encadena un render de más en cada montaje. Sin Supabase
  // (modo maqueta) nace 'inactivo' y ahí se queda; con Supabase, nace 'conectando' y
  // solo el callback de la suscripción —que es asíncrono— lo mueve.
  const [estado, setEstado] = useState<EstadoRealtime>(() =>
    getSupabase() ? 'conectando' : 'inactivo',
  );
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La clave se serializa para no re-suscribir en cada render por identidad de array.
  const claveSerializada = JSON.stringify(queryKey);

  useEffect(() => {
    const supabase = getSupabase();
    // Modo maqueta (sin Supabase): no hay nada a lo que suscribirse y la app sigue
    // funcionando por refetch. Degradar, no romper (Gestión de Errores §7).
    if (!supabase) return undefined;

    let canal: RealtimeChannel | null = null;
    let vivo = true;

    const invalidarAgrupado = () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => {
        if (vivo) queryClient.invalidateQueries({ queryKey: JSON.parse(claveSerializada) });
      }, AGRUPAR_MS);
    };

    canal = supabase
      .channel(`gt:${tabla}:${claveSerializada}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla, ...(filtro ? { filter: filtro } : {}) },
        // El payload se ignora deliberadamente: la fila la vuelve a servir el backend.
        () => invalidarAgrupado(),
      )
      .subscribe((status) => {
        if (!vivo) return;
        if (status === 'SUBSCRIBED') setEstado('conectado');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setEstado('reintentando');
        else if (status === 'CLOSED') setEstado('inactivo');
      });

    return () => {
      vivo = false;
      if (temporizador.current) clearTimeout(temporizador.current);
      if (canal) supabase.removeChannel(canal);
    };
  }, [tabla, claveSerializada, filtro, queryClient]);

  return estado;
}
