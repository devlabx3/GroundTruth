import { describe, it, expect, vi, afterEach } from 'vitest';
import { accesosRapidos } from './devLogins';

/**
 * Los accesos rápidos son un arma de doble filo: comodísimos para depurar roles, y una
 * fuga de credenciales si alguien los deja encendidos. Estos tests fijan las dos mitades:
 * que aparecen los CUATRO roles en desarrollo, y que NO existen en producción.
 */
afterEach(() => {
  vi.unstubAllEnvs();
});

function conCuentas() {
  vi.stubEnv('VITE_DEV_OPERADOR_EMAIL', 'qa-operador@gt-qa.dev');
  vi.stubEnv('VITE_DEV_OPERADOR_PASSWORD', 'x');
  vi.stubEnv('VITE_DEV_LOGISTICA_EMAIL', 'qa-logistica@gt-qa.dev');
  vi.stubEnv('VITE_DEV_LOGISTICA_PASSWORD', 'x');
  vi.stubEnv('VITE_DEV_AGRICULTOR_EMAIL', 'qa-agricultor@gt-qa.dev');
  vi.stubEnv('VITE_DEV_AGRICULTOR_PASSWORD', 'x');
  vi.stubEnv('VITE_DEV_ADMIN_EMAIL', 'qa-admin@gt-qa.dev');
  vi.stubEnv('VITE_DEV_ADMIN_PASSWORD', 'x');
}

describe('accesos rápidos del login', () => {
  it('ofrece los CUATRO roles cuando las cuentas están configuradas', () => {
    vi.stubEnv('DEV', true);
    conCuentas();

    const cuentas = accesosRapidos();
    expect(cuentas.map((c) => c.rol)).toEqual(['operator', 'logistics', 'farmer', 'admin']);
    // Las cuatro superficies del producto quedan cubiertas por un botón.
    expect(cuentas).toHaveLength(4);
  });

  it('en PRODUCCIÓN no existe ninguno, aunque las variables estén definidas', () => {
    vi.stubEnv('DEV', false);
    conCuentas();

    // Esta es la línea que impide que unas credenciales acaben en el bundle público.
    expect(accesosRapidos()).toEqual([]);
  });

  it('omite el rol cuya cuenta no esté completa', () => {
    vi.stubEnv('DEV', true);
    conCuentas();
    vi.stubEnv('VITE_DEV_ADMIN_PASSWORD', ''); // al admin le falta la contraseña

    const roles = accesosRapidos().map((c) => c.rol);
    expect(roles).not.toContain('admin');
    expect(roles).toHaveLength(3);
  });

  it('sin variables no aparece ningún botón (el login queda como siempre)', () => {
    vi.stubEnv('DEV', true);
    // Vaciadas explícitamente: vitest CARGA el .env real del proyecto, así que sin esto
    // el test estaría leyendo las credenciales de verdad y no probaría nada.
    for (const k of [
      'VITE_DEV_OPERADOR_EMAIL', 'VITE_DEV_OPERADOR_PASSWORD',
      'VITE_DEV_LOGISTICA_EMAIL', 'VITE_DEV_LOGISTICA_PASSWORD',
      'VITE_DEV_AGRICULTOR_EMAIL', 'VITE_DEV_AGRICULTOR_PASSWORD',
      'VITE_DEV_ADMIN_EMAIL', 'VITE_DEV_ADMIN_PASSWORD',
    ]) {
      vi.stubEnv(k, '');
    }

    expect(accesosRapidos()).toEqual([]);
  });
});
