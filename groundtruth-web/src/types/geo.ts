/**
 * Latitud y longitud como tipos DISTINTOS.
 *
 * El problema: Leaflet quiere `[lat, lng]` y GeoJSON `[lng, lat]`. Si ambos son
 * `[number, number]`, invertirlos compila sin una queja y el polígono de una finca
 * de Honduras acaba dibujado frente a Namibia. Un alias (`type LatLng = [number,
 * number]`) NO arregla nada: TypeScript compara por estructura, no por nombre.
 *
 * Marcar la TUPLA tampoco basta — `latLng(lng, lat)` seguiría siendo válido, porque
 * los dos argumentos serían `number`. Lo que hay que separar son los ESCALARES:
 *
 *   type Lat = number & marca_de_latitud
 *   type Lng = number & marca_de_longitud
 *
 * A partir de ahí una latitud deja de ser intercambiable con una longitud, y como
 * las tuplas se destructuran POR POSICIÓN, el compilador propaga la distinción:
 * al desestructurar un `LngLat` obtienes `[Lng, Lat]` y no hay forma de colocarlos
 * en el orden equivocado sin que falle.
 *
 * Coste: las coordenadas hay que construirlas con `lat()` / `lng()`. Son cuatro
 * sitios en todo el proyecto y es justo donde uno quiere mirar dos veces.
 */

declare const esLatitud: unique symbol;
declare const esLongitud: unique symbol;

export type Lat = number & { readonly [esLatitud]: true };
export type Lng = number & { readonly [esLongitud]: true };

/** Orden de Leaflet. */
export type LatLng = [Lat, Lng];
/** Orden de GeoJSON. */
export type LngLat = [Lng, Lat];

/**
 * Los constructores validan el rango, así que además del tipo hay una red en
 * ejecución para lo que venga del exterior (un JSON corrupto, una API que cambió).
 * No detecta un intercambio entre valores que caen en ambos rangos —para eso está
 * el tipo—, pero sí cualquier longitud mayor de 90 colocada como latitud.
 */
export function lat(v: number): Lat {
  if (!Number.isFinite(v) || v < -90 || v > 90) {
    throw new RangeError(`Latitud fuera de rango: ${v}`);
  }
  return v as Lat;
}

export function lng(v: number): Lng {
  if (!Number.isFinite(v) || v < -180 || v > 180) {
    throw new RangeError(`Longitud fuera de rango: ${v}`);
  }
  return v as Lng;
}

/** Punto en orden Leaflet. Los tipos de los argumentos impiden el intercambio. */
export function latLng(a: Lat, b: Lng): LatLng {
  return [a, b];
}

/** Punto en orden GeoJSON. */
export function lngLat(a: Lng, b: Lat): LngLat {
  return [a, b];
}

/**
 * Frontera de entrada: números crudos (de la base, de un evento del mapa) → punto.
 *
 * Es el único punto donde el intercambio sigue siendo posible: dos `number` son
 * dos `number` y ningún tipo puede distinguirlos. Por eso recibe un OBJETO con
 * claves nombradas en vez de dos posiciones — invertirlos deja de ser un descuido
 * posicional (`f(b, a)`) y pasa a ser una afirmación falsa y visible en la
 * revisión (`{ lat: fila.longitud }`). Más estrecho no se puede hacer.
 */
export function puntoDesdeCrudo({ lat: latitud, lng: longitud }: { lat: number; lng: number }): LatLng {
  return latLng(lat(latitud), lng(longitud));
}

/** Lista de puntos en orden Leaflet — para fixtures y datos literales. */
export function puntos(crudos: readonly (readonly [number, number])[]): LatLng[] {
  return crudos.map(([latitud, longitud]) => puntoDesdeCrudo({ lat: latitud, lng: longitud }));
}
