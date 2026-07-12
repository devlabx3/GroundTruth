/**
 * Cliente HTTP hacia el backend NestJS.
 * Regla (Sistema-de-Diseno §5): TODA la lógica de negocio pasa por aquí.
 * Supabase JS se usa SOLO para Auth, Storage y Realtime — nunca para datos de negocio.
 */
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

// Inyecta el token de sesión (lo provee Supabase Auth) en cada request.
let getAccessToken = () => null;
export function registerTokenProvider(fn) {
  getAccessToken = fn;
}
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/**
 * Normaliza toda respuesta de error a la forma estable que define
 * Gestion-de-Errores §6: { code, messageKey, retryable, incidentId }.
 * El resto de la app nunca ve el stack ni el error crudo.
 */
export class ApiError extends Error {
  constructor({ code, messageKey, retryable, incidentId, status }) {
    super(messageKey ?? code ?? 'server');
    this.code = code ?? 'server';
    this.messageKey = messageKey ?? 'errors.server';
    this.retryable = retryable ?? false;
    this.incidentId = incidentId ?? null;
    this.status = status ?? null;
  }
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    // Sin respuesta del servidor → red u offline
    if (!error.response) {
      const offline = typeof navigator !== 'undefined' && !navigator.onLine;
      return Promise.reject(
        new ApiError({
          code: offline ? 'OFFLINE' : 'TIMEOUT',
          messageKey: offline ? 'errors.offline' : 'errors.timeout',
          retryable: true,
        }),
      );
    }
    const { status, data } = error.response;
    // El backend ya envía { code, messageKey, retryable, incidentId }
    const payload = data && typeof data === 'object' ? data : {};
    const fallbackByStatus = {
      401: { code: 'SESSION_EXPIRED', messageKey: 'errors.session_expired' },
      403: { code: 'NO_PRIVILEGE', messageKey: 'errors.no_privilege' },
      404: { code: 'NOT_FOUND', messageKey: 'errors.not_found' },
      429: { code: 'RATE_LIMITED', messageKey: 'errors.rate_limited' },
    };
    const fb = fallbackByStatus[status] ?? { code: 'SERVER', messageKey: 'errors.server' };
    return Promise.reject(
      new ApiError({
        code: payload.code ?? fb.code,
        messageKey: payload.messageKey ? `errors.${payload.messageKey}` : fb.messageKey,
        retryable: payload.retryable ?? (status >= 500),
        incidentId: payload.incidentId ?? null,
        status,
      }),
    );
  },
);
