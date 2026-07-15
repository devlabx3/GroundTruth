import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

/**
 * Lo que se prueba aquí NO es que Supabase funcione (eso es de Supabase), sino las
 * dos decisiones nuestras:
 *
 *  1. El payload del evento se IGNORA: solo se invalida la query. Si algún día
 *     alguien "optimiza" leyendo la fila del evento, se salta el backend y sus
 *     privilegios — y este test deja de pasar.
 *  2. Las invalidaciones se AGRUPAN. `lecturas_telemetria` mete una fila por sensor
 *     y por lectura: sin agrupar, cada inserción dispararía un refetch.
 */

// Canal falso: guarda el callback de `postgres_changes` para dispararlo a mano.
let alCambiar: ((payload: unknown) => void) | null = null;
const removeChannel = vi.fn();

vi.mock('./supabase', () => ({
  getSupabase: () => ({
    channel: () => ({
      on: (_evento: string, _filtro: unknown, cb: (p: unknown) => void) => {
        alCambiar = cb;
        return {
          subscribe: (cb2: (status: string) => void) => {
            cb2('SUBSCRIBED');
            return { unsubscribe: vi.fn() };
          },
        };
      },
    }),
    removeChannel,
  }),
}));

const { useRealtimeInvalidation } = await import('./useRealtime');

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => {
  vi.useFakeTimers();
  alCambiar = null;
  queryClient = new QueryClient();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRealtimeInvalidation', () => {
  it('se declara conectado cuando la suscripción prospera', () => {
    const { result } = renderHook(
      () => useRealtimeInvalidation({ tabla: 'alertas', queryKey: ['farmer', 'alerts'] }),
      { wrapper },
    );
    expect(result.current).toBe('conectado');
  });

  it('agrupa una ráfaga de eventos en UNA sola invalidación', () => {
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(
      () =>
        useRealtimeInvalidation({
          tabla: 'lecturas_telemetria',
          queryKey: ['dashboard', 'overview'],
        }),
      { wrapper },
    );

    // 200 lecturas de golpe, como las que mete el simulador IoT.
    act(() => {
      for (let i = 0; i < 200; i++) alCambiar?.({ new: { id: i } });
    });
    expect(invalidar).not.toHaveBeenCalled(); // aún dentro de la ventana

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['dashboard', 'overview'] });
  });

  it('invalida la query — no usa el contenido del evento', () => {
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    renderHook(
      () => useRealtimeInvalidation({ tabla: 'tesorerias', queryKey: ['dashboard', 'treasury'] }),
      { wrapper },
    );

    // Un evento con datos envenenados: si el hook los usara, acabarían en pantalla.
    act(() => {
      alCambiar?.({ new: { saldo_cache: 999999999 } });
      vi.advanceTimersByTime(1500);
    });

    // La única reacción es pedirle el dato al backend.
    expect(invalidar).toHaveBeenCalledExactlyOnceWith({ queryKey: ['dashboard', 'treasury'] });
    expect(queryClient.getQueryData(['dashboard', 'treasury'])).toBeUndefined();
  });

  it('cierra el canal al desmontar (sin fugas de suscripciones)', () => {
    const { unmount } = renderHook(
      () => useRealtimeInvalidation({ tabla: 'alertas', queryKey: ['farmer', 'alerts'] }),
      { wrapper },
    );
    unmount();
    expect(removeChannel).toHaveBeenCalled();
  });
});
