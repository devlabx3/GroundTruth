/**
 * Saga simulada para el modo maqueta: avanza los pasos de un
 * OnchainProgressModal con temporizador, sin backend ni cadena.
 * Cuando exista el backend NestJS, se sustituye por la suscripción
 * real al estado del saga (Realtime) — la interfaz del hook se mantiene.
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import type { SagaStep, SagaStepDef } from '@/types/ui';

export function useSimulatedSaga({ stepMs = 1400 }: { stepMs?: number } = {}) {
  const [steps, setSteps] = useState<SagaStep[] | null>(null); // null = modal cerrado
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (defs: SagaStepDef[]) => {
      stop();
      setSteps(defs.map((d, i) => ({ ...d, status: i === 0 ? 'active' : 'pending' })));
      timer.current = setInterval(() => {
        setSteps((prev) => {
          if (!prev) return prev;
          const i = prev.findIndex((s) => s.status === 'active');
          if (i === -1) return prev;
          const next = prev.map((s, j) =>
            j === i
              ? { ...s, status: 'done' as const }
              : j === i + 1
                ? { ...s, status: 'active' as const }
                : s,
          );
          if (i === prev.length - 1) stop();
          return next;
        });
      }, stepMs);
    },
    [stepMs, stop],
  );

  const reset = useCallback(() => {
    stop();
    setSteps(null);
  }, [stop]);

  const open = steps !== null;
  const done = !!steps && steps.every((s) => s.status === 'done');
  return { open, steps: steps ?? [], start, reset, done };
}
