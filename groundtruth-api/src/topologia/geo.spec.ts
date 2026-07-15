import { describe, it, expect } from 'vitest';
import { poligonoAGeoJson } from './geo';

// Una parcela real de Marcala, Honduras (lat ~14.15 N, lng ~-88.03 W).
const MARCALA: [number, number][] = [
  [14.156, -88.03],
  [14.156, -88.027],
  [14.153, -88.027],
  [14.153, -88.03],
];

describe('poligonoAGeoJson', () => {
  it('invierte [lat,lng] de Leaflet a [lng,lat] de GeoJSON', () => {
    const { coordinates } = poligonoAGeoJson(MARCALA);
    const [lng, lat] = coordinates[0][0];

    // Si algún día alguien "simplifica" esto y quita la inversión, la parcela
    // se muda al océano Índico sin que nada falle. Este test lo impide.
    expect(lng).toBe(-88.03); // longitud: negativa, oeste
    expect(lat).toBe(14.156); // latitud: positiva, norte
    expect(Math.abs(lat)).toBeLessThanOrEqual(90);
  });

  it('cierra el anillo repitiendo el primer vértice', () => {
    const anillo = poligonoAGeoJson(MARCALA).coordinates[0];
    expect(anillo).toHaveLength(MARCALA.length + 1);
    expect(anillo[anillo.length - 1]).toEqual(anillo[0]);
  });

  it('no duplica el cierre si el anillo ya venía cerrado', () => {
    const yaCerrado: [number, number][] = [...MARCALA, MARCALA[0]];
    const anillo = poligonoAGeoJson(yaCerrado).coordinates[0];
    expect(anillo).toHaveLength(yaCerrado.length); // no añade un 6.º punto
    expect(anillo[anillo.length - 1]).toEqual(anillo[0]);
  });

  it('rechaza menos de 3 vértices: una línea no es una parcela', () => {
    expect(() => poligonoAGeoJson([[14.1, -88.0], [14.2, -88.0]])).toThrow();
  });
});
