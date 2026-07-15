/**
 * Conversión del polígono dibujado a GeoJSON.
 *
 * Aquí vive **la trampa clásica de SIG**: Leaflet usa `[lat, lng]` y GeoJSON usa
 * `[lng, lat]`. Invertirlos no da error — coloca la parcela en otro punto del
 * planeta (Marcala, Honduras acabaría en el océano Índico). Por eso esta función
 * es un módulo aparte con sus tests, y no tres líneas dentro de un servicio.
 */
export type PuntoLeaflet = [lat: number, lng: number];

export interface PoligonoGeoJson {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export function poligonoAGeoJson(puntos: PuntoLeaflet[]): PoligonoGeoJson {
  if (puntos.length < 3) {
    throw new Error('Un polígono necesita al menos 3 vértices');
  }

  // [lat, lng] → [lng, lat]
  const anillo: [number, number][] = puntos.map(([lat, lng]) => [lng, lat]);

  // GeoJSON exige el anillo cerrado: el último vértice repite el primero.
  const primero = anillo[0];
  const ultimo = anillo[anillo.length - 1];
  if (primero[0] !== ultimo[0] || primero[1] !== ultimo[1]) {
    anillo.push([primero[0], primero[1]]);
  }

  return { type: 'Polygon', coordinates: [anillo] };
}
