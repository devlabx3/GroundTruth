/**
 * Cliente HTTP hacia el backend NestJS.
 * Regla (Sistema-de-Diseno §5): TODA la lógica de negocio pasa por aquí.
 * Supabase JS se usa SOLO para Auth, Storage y Realtime — nunca para datos de negocio.
 */
import axios from 'axios';
import type { AxiosError } from 'axios';
import { getSupabase } from './supabase';
import { useSession } from '@/stores/session';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Cada request lleva (1) el JWT vigente de Supabase Auth — se lee de la sesión
 * persistida, así el token refrescado siempre está al día — y (2) el
 * `x-operador-id` del contexto activo, que el backend usa para autorizar por
 * privilegios de sub-rol (Modelo-de-Datos §7). Interceptor async para poder
 * esperar a `getSession()`.
 */
api.interceptors.request.use(async (config) => {
  const supabase = getSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  const ctx = useSession.getState().activeContext;
  if (ctx?.type === 'operator' && ctx.operadorId) {
    config.headers['x-operador-id'] = ctx.operadorId;
  }
  return config;
});

/** La forma estable de error que define Gestion-de-Errores §6. */
export interface ApiErrorShape {
  code?: string;
  messageKey?: string;
  retryable?: boolean;
  incidentId?: string | null;
  status?: number | null;
  /** Interpolaciones del mensaje (p. ej. el `n` de sensores exigidos). */
  details?: Record<string, unknown>;
}

/** Lo que llega en el cuerpo del error. Todo opcional: de la red no se fía nadie. */
type ErrorPayload = Partial<Omit<ApiErrorShape, 'status'>>;

/**
 * Normaliza toda respuesta de error a la forma estable que define
 * Gestion-de-Errores §6: { code, messageKey, retryable, incidentId }.
 * El resto de la app nunca ve el stack ni el error crudo.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly messageKey: string;
  readonly retryable: boolean;
  readonly incidentId: string | null;
  readonly status: number | null;
  readonly details: Record<string, unknown>;

  constructor({ code, messageKey, retryable, incidentId, status, details }: ApiErrorShape) {
    super(messageKey ?? code ?? 'server');
    this.name = 'ApiError';
    this.code = code ?? 'server';
    this.messageKey = messageKey ?? 'errors:server';
    this.retryable = retryable ?? false;
    this.incidentId = incidentId ?? null;
    this.status = status ?? null;
    // Interpolaciones del mensaje (p. ej. `n` sensores exigidos): las calcula el
    // servidor, así que el texto que lee la persona lleva SU número, no una
    // estimación del navegador que puede no coincidir.
    this.details = details ?? {};
  }
}

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<unknown>) => {
    // Sin respuesta del servidor → red u offline
    if (!error.response) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      return Promise.reject(
        new ApiError({
          code: offline ? 'OFFLINE' : 'TIMEOUT',
          messageKey: offline ? 'errors:offline' : 'errors:timeout',
          retryable: true,
        }),
      );
    }
    const { status, data } = error.response;
    // El backend ya envía { code, messageKey, retryable, incidentId }
    const payload: ErrorPayload = data && typeof data === 'object' ? (data as ErrorPayload) : {};
    const fallbackByStatus: Record<number, { code: string; messageKey: string }> = {
      401: { code: 'SESSION_EXPIRED', messageKey: 'errors:session_expired' },
      403: { code: 'NO_PRIVILEGE', messageKey: 'errors:no_privilege' },
      404: { code: 'NOT_FOUND', messageKey: 'errors:not_found' },
      429: { code: 'RATE_LIMITED', messageKey: 'errors:rate_limited' },
    };
    const fb = fallbackByStatus[status] ?? { code: 'SERVER', messageKey: 'errors:server' };
    return Promise.reject(
      new ApiError({
        code: payload.code ?? fb.code,
        messageKey: payload.messageKey ? `errors:${payload.messageKey}` : fb.messageKey,
        retryable: payload.retryable ?? status >= 500,
        incidentId: payload.incidentId ?? null,
        status,
        details: payload.details ?? {},
      }),
    );
  },
);

/**
 * Clave i18n de un error capturado. En `catch (e)` el error es `unknown`: solo un
 * ApiError trae clave, y cualquier otra cosa (un TypeError, un fallo del render)
 * cae al mensaje genérico en vez de enseñar un `undefined` al usuario.
 */
export function errorKey(e: unknown): string {
  return e instanceof ApiError ? e.messageKey : 'errors:server';
}

/** Interpolaciones del mensaje (p. ej. el `n` de sensores que exige el servidor). */
export function errorValues(e: unknown): Record<string, unknown> {
  return e instanceof ApiError ? e.details : {};
}
