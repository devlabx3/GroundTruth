import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DomainErrors } from './domain-error';

/**
 * El `messageKey` de cada error es un **contrato con el frontend**: allí se
 * traduce a texto en 7 idiomas. Si alguien renombra una clave aquí y no allí,
 * la interfaz enseña la clave cruda ("insufficient_funds") a un agricultor.
 *
 * Este test ata las dos puntas: todo error del backend tiene su traducción.
 */
const errores = JSON.parse(
  readFileSync(
    join(__dirname, '../../../groundtruth-web/src/i18n/locales/es/errors.json'),
    'utf8',
  ),
) as Record<string, string>;

describe('contrato de errores de dominio', () => {
  const todos = Object.entries(DomainErrors).map(([nombre, factory]) => {
    // Las factories con argumentos reciben un valor cualquiera: solo interesa
    // la forma del error, no el dato.
    const err = (factory as (...a: any[]) => any)(1);
    return { nombre, err };
  });

  it.each(todos)('$nombre tiene traducción en errors.json', ({ err }) => {
    expect(errores).toHaveProperty(err.messageKey);
  });

  it.each(todos)('$nombre expone la forma { code, messageKey, status }', ({ err }) => {
    expect(err.code).toMatch(/^[A-Z_]+$/); // el código es para máquinas
    expect(err.messageKey).toMatch(/^[a-z_]+$/); // la clave, para el diccionario
    expect(err.status).toBeGreaterThanOrEqual(400);
    expect(err.status).toBeLessThan(600);
  });

  it('los errores de negocio recuperables se marcan como reintentables', () => {
    // Fondos insuficientes se resuelve depositando: la UI ofrece reintentar.
    expect(DomainErrors.treasuryInsufficientFunds().retryable).toBe(true);
    // Un privilegio que falta no se arregla reintentando.
    expect(DomainErrors.noPrivilege().retryable).toBe(false);
  });

  it('la cobertura de sensores viaja con su número (la UI lo interpola)', () => {
    const err = DomainErrors.sensorCoverageUnmet(6);
    expect(err.details).toEqual({ n: 6 });
    // Y el texto en español espera esa interpolación.
    expect(errores[err.messageKey]).toContain('{{n}}');
  });
});
