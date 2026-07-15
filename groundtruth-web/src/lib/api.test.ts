import { describe, it, expect } from 'vitest';
import { ApiError } from './api';

/**
 * Toda respuesta de error se normaliza a { code, messageKey, retryable, details }
 * (Gestion-de-Errores §6). El resto de la app nunca ve el error crudo.
 */
describe('ApiError', () => {
  it('conserva los `details` que manda el servidor', () => {
    // Bug real: se descartaban, y el alta de parcela mostraba los sensores que
    // estimaba el navegador (5) en vez de los que exige PostGIS (6).
    const e = new ApiError({
      code: 'SENSOR_COVERAGE_UNMET',
      messageKey: 'errors:sensor_coverage',
      status: 422,
      details: { n: 6 },
    });
    expect(e.details).toEqual({ n: 6 });
  });

  it('cae a un error genérico traducible cuando el servidor no dice nada', () => {
    const e = new ApiError({});
    expect(e.code).toBe('server');
    expect(e.messageKey).toBe('errors:server'); // nunca un texto en crudo
    expect(e.retryable).toBe(false);
    expect(e.details).toEqual({});
  });

  it('marca reintentable lo que el servidor marca reintentable', () => {
    const e = new ApiError({ code: 'TREASURY_INSUFFICIENT_FUNDS', retryable: true });
    expect(e.retryable).toBe(true);
  });

  it('el messageKey siempre lleva su namespace: la UI no debe adivinarlo', () => {
    const e = new ApiError({ messageKey: 'errors:no_privilege' });
    expect(e.messageKey.startsWith('errors:')).toBe(true);
  });
});
