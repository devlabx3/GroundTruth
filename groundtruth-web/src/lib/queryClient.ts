/**
 * TanStack Query — única fuente de datos de servidor (Sistema-de-Diseno §5).
 * Zustand nunca duplica datos que ya viven aquí.
 */
import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // No reintentar errores de auth/privilegio; sí los reintentables (red, 5xx)
        if (error instanceof ApiError && !error.retryable) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false, // las mutaciones on-chain se reintentan por el saga, no aquí
    },
  },
});
