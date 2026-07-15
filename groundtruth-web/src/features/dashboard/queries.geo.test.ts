import { describe, it, expect } from 'vitest';
import { anilloALeaflet } from './queries';
import { lat, lng, lngLat } from '@/types/geo';
import type { GeoJsonPolygon } from '@/types/api';

/** Punto en orden GeoJSON, tal como llega del backend. */
const g = (longitud: number, latitud: number) => lngLat(lng(longitud), lat(latitud));

/**
 * El intercambio [lng,lat] → [lat,lng] ya no compila (`types/geo.ts` marca latitud
 * y longitud como tipos distintos), pero el compilador solo protege el ORDEN. Que
 * la conversión además preserve los valores y los vértices lo comprueba esto.
 *
 * Marcala (Honduras): lat 14.16, lng -88.03. Invertido cae frente a Namibia — no
 * es un número raro, es otro continente.
 */
const MARCALA: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [
    [
      g(-88.033, 14.159),
      g(-88.024, 14.158),
      g(-88.025, 14.151),
      g(-88.032, 14.15),
      g(-88.033, 14.159),
    ],
  ],
};

describe('anilloALeaflet', () => {
  it('convierte GeoJSON [lng,lat] a Leaflet [lat,lng]', () => {
    const anillo = anilloALeaflet(MARCALA);

    expect(anillo[0]).toEqual([14.159, -88.033]);
    // La latitud de Honduras es positiva y su longitud negativa: si estuvieran
    // intercambiadas, el primer valor saldría negativo.
    for (const [latitud, longitud] of anillo) {
      expect(latitud).toBeGreaterThan(0);
      expect(longitud).toBeLessThan(0);
    }
  });

  it('conserva todos los vértices y su orden', () => {
    expect(anilloALeaflet(MARCALA)).toHaveLength(5);
    expect(anilloALeaflet(MARCALA)[2]).toEqual([14.151, -88.025]);
  });

  it('devuelve [] cuando la parcela no tiene polígono', () => {
    // El backend puede no mandar `geom`. Sin esto, el mapa recibiría undefined.
    expect(anilloALeaflet(null)).toEqual([]);
    expect(anilloALeaflet(undefined)).toEqual([]);
  });
});

describe('constructores de coordenadas', () => {
  it('rechazan valores fuera de rango en ejecución', () => {
    // Red contra datos corruptos del exterior: una longitud colocada como latitud
    // se detecta siempre que supere los 90 grados.
    expect(() => lat(-181)).toThrow(RangeError);
    expect(() => lng(200)).toThrow(RangeError);
    expect(() => lat(Number.NaN)).toThrow(RangeError);
  });

  it('aceptan los límites exactos', () => {
    expect(lat(-90)).toBe(-90);
    expect(lng(180)).toBe(180);
  });
});
