import { describe, it, expect } from 'vitest';
import { esDuplicado } from './storage.service';

/**
 * El bucket ya existente es el camino de ÉXITO. Supabase lo comunica de forma
 * inconsistente y el código lo daba por fallo: cada arranque gritaba
 * "No se pudo crear el bucket" con todo funcionando.
 */
describe('esDuplicado', () => {
  it('acepta el 409 limpio', () => {
    expect(esDuplicado(409, '')).toBe(true);
  });

  it('acepta el 400 con el 409 escondido en el cuerpo (lo que Supabase manda de verdad)', () => {
    const real = '{"statusCode":"409","error":"Duplicate","message":"The resource already exists"}';
    expect(esDuplicado(400, real)).toBe(true);
  });

  it('NO se traga otros 400: un fallo real debe seguir avisando', () => {
    expect(esDuplicado(400, '{"statusCode":"400","error":"InvalidBucketName"}')).toBe(false);
    expect(esDuplicado(401, '{"error":"Unauthorized"}')).toBe(false);
    expect(esDuplicado(500, '')).toBe(false);
  });

  it('no asume nada si el cuerpo no es JSON', () => {
    expect(esDuplicado(400, '<html>502 Bad Gateway</html>')).toBe(false);
  });
});
