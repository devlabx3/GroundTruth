/**
 * Conduce un OnchainProgressModal contra una acción real del backend: anima los
 * pasos mientras la llamada está en vuelo, y al resolver marca todos en check
 * (éxito) o pinta en lacre el paso donde falló con su clave de error (Errores §6).
 * Reemplaza a useSimulatedSaga cuando la acción ya pega contra el API.
 */
import { useRef, useState, useCallback, useEffect } from 'react';
import type { SagaStep, SagaStepDef } from '@/types/ui';
import { ApiError } from './api';

type SagaResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

export function useRealSaga<T = unknown>({ stepMs = 900 }: { stepMs?: number } = {}) {
  const [steps, setSteps] = useState<SagaStep[] | null>(null);
  const [result, setResult] = useState<SagaResult<T> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback(
    async (defs: SagaStepDef[], runFn: () => Promise<T>): Promise<T> => {
      stop();
      setResult(null);
      setSteps(defs.map((d, i) => ({ ...d, status: i === 0 ? 'active' : 'pending' })));

      // Avance visual, pero el último paso se retiene hasta que el API resuelva.
      timer.current = setInterval(() => {
        setSteps((prev) => {
          if (!prev) return prev;
          const i = prev.findIndex((s) => s.status === 'active');
          if (i === -1 || i >= prev.length - 1) return prev;
          return prev.map((s, j) =>
            j === i
              ? { ...s, status: 'done' as const }
              : j === i + 1
                ? { ...s, status: 'active' as const }
                : s,
          );
        });
      }, stepMs);

      try {
        const data = await runFn();
        stop();
        setSteps((prev) => (prev ? prev.map((s) => ({ ...s, status: 'done' as const })) : prev));
        setResult({ ok: true, data });
        return data;
      } catch (e) {
        stop();
        // Solo un ApiError trae clave i18n; cualquier otro error cae al genérico.
        const raw = e instanceof ApiError ? e.messageKey : 'errors:server';
        const errorKey = raw.replace(/^errors:/, '');
        setSteps((prev) => {
          if (!prev) return prev;
          let i = prev.findIndex((s) => s.status === 'active');
          if (i === -1) i = prev.length - 1;
          return prev.map((s, j) => (j === i ? { ...s, status: 'failed' as const, errorKey } : s));
        });
        setResult({ ok: false, error: e });
        throw e;
      }
    },
    [stepMs, stop],
  );

  const reset = useCallback(() => {
    stop();
    setSteps(null);
    setResult(null);
  }, [stop]);

  const open = steps !== null;
  const done = !!steps && steps.every((s) => s.status === 'done');
  const failed = !!steps && steps.some((s) => s.status === 'failed');
  return { open, steps: steps ?? [], start, reset, done, failed, result };
}
