import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from './index';

/**
 * Ninguna cadena visible vive en el código: todas salen del diccionario. Si una
 * clave falta en un idioma, i18next cae al español —y una operadora en Kivu ve
 * media pantalla en un idioma que no habla— o peor, enseña la clave cruda.
 *
 * Estos tests convierten esa regla en algo que falla solo.
 */
type Nodo = Record<string, unknown>;

const diccionarios = import.meta.glob<{ default: Nodo }>('./locales/*/*.json', {
  eager: true,
});

/** { es: { common: {...}, dashboard: {...} }, en: {...} } */
const porIdioma: Record<string, Record<string, Nodo>> = {};
for (const [ruta, mod] of Object.entries(diccionarios)) {
  const m = ruta.match(/\.\/locales\/([^/]+)\/(.+)\.json$/);
  if (!m) continue;
  const [, locale, archivo] = m;
  (porIdioma[locale] ??= {})[archivo] = mod.default ?? (mod as unknown as Nodo);
}

/** Aplana { a: { b: 'x' } } → ['a.b'] */
function claves(obj: Nodo, prefijo = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const ruta = prefijo ? `${prefijo}.${k}` : k;
    return v && typeof v === 'object' ? claves(v as Nodo, ruta) : [ruta];
  });
}

const REFERENCIA = 'es';
const clavesDe = (locale: string): string[] =>
  Object.entries(porIdioma[locale])
    .flatMap(([archivo, contenido]) => claves(contenido).map((k) => `${archivo}:${k}`))
    .sort();

const esperadas = clavesDe(REFERENCIA);
const otros = SUPPORTED_LOCALES.filter((l) => l !== REFERENCIA && porIdioma[l]);

describe('diccionarios i18n', () => {
  it('el idioma de referencia tiene claves', () => {
    expect(esperadas.length).toBeGreaterThan(300);
  });

  it.each(otros)('%s tiene exactamente las mismas claves que es', (locale) => {
    const actuales = clavesDe(locale);
    const faltan = esperadas.filter((k) => !actuales.includes(k));
    const sobran = actuales.filter((k) => !esperadas.includes(k));

    expect({ faltan, sobran }).toEqual({ faltan: [], sobran: [] });
  });

  it.each(otros)('%s conserva las interpolaciones {{...}} de cada mensaje', (locale) => {
    const errores: string[] = [];
    for (const archivo of Object.keys(porIdioma[REFERENCIA])) {
      for (const clave of claves(porIdioma[REFERENCIA][archivo])) {
        const buscar = (raiz: Nodo): unknown =>
          clave.split('.').reduce<unknown>((o, k) => (o as Nodo | undefined)?.[k], raiz);
        const base = buscar(porIdioma[REFERENCIA][archivo]);
        const trad = buscar(porIdioma[locale][archivo]);
        if (typeof base !== 'string' || typeof trad !== 'string') continue;

        const vars = (s: string) => (s.match(/\{\{(\w+)\}\}/g) ?? []).sort().join(',');
        // Perder un {{n}} al traducir deja la frase sin el dato: "Necesitas
        // sensores" en vez de "Necesitas 6 sensores".
        if (vars(base) !== vars(trad)) {
          errores.push(`${archivo}:${clave} — es[${vars(base)}] vs ${locale}[${vars(trad)}]`);
        }
      }
    }
    expect(errores).toEqual([]);
  });
});
