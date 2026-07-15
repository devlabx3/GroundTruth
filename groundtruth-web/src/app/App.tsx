import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { router } from '@/router';
import { useAuthBootstrap } from '@/app/useAuthBootstrap';

export default function App() {
  const ready = useAuthBootstrap();
  return (
    <QueryClientProvider client={queryClient}>
      {ready ? <RouterProvider router={router} /> : <SessionSplash />}
    </QueryClientProvider>
  );
}

/** Pantalla mínima mientras se rehidrata la sesión (una recarga autenticada, no un login). */
function SessionSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-porcelain">
      <div
        role="status"
        aria-label="Cargando"
        className="h-6 w-6 animate-spin rounded-full border-2 border-porcelain-border border-t-emerald"
      />
    </div>
  );
}
