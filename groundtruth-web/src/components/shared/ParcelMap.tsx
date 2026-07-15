/**
 * ParcelMap — Leaflet (Índice §7): pines de estado (dashboard), polígono de
 * parcela (detalle) y modo dibujo (nueva parcela). Sin iconos de Marker (rotos
 * bajo bundlers): CircleMarker con anillo blanco de 2px.
 * Colores de estado = paleta cerrada del sistema de diseño.
 */
import { MapContainer, TileLayer, CircleMarker, Polygon, Tooltip, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { EstadoParcela, LatLng } from '@/types/api';
import { puntoDesdeCrudo } from '@/types/geo';

/**
 * Centro por defecto: Marcala (Honduras), la zona cafetera del piloto. Vivía
 * duplicado como literal en dos páginas.
 */
export const CENTRO_DEFECTO: LatLng = puntoDesdeCrudo({ lat: 14.1545, lng: -88.0285 });

const STATE_COLOR: Record<EstadoParcela, string> = {
  conforme: '#0C3C2D', // esmeralda
  alerta: '#6E1423', // lacre
  pendiente: '#6B6F6B', // grafito
};

/** Un pin del mapa. `centro` es [lat,lng] — Leaflet, NO GeoJSON. */
export interface MapPin {
  id: string;
  nombre: string;
  estado: EstadoParcela;
  centro: LatLng;
}

export interface ParcelMapProps {
  center: LatLng;
  zoom?: number;
  height?: number;
  pins?: MapPin[];
  onPinClick?: (pin: MapPin) => void;
  /** Polígono en solo lectura, en [lat,lng]. */
  polygon?: LatLng[] | null;
  /** Modo dibujo: activo cuando se pasa `onDrawChange`. */
  drawPoints?: LatLng[] | null;
  onDrawChange?: ((points: LatLng[]) => void) | null;
}

export default function ParcelMap({
  center,
  zoom = 14,
  height = 260,
  pins = [],
  onPinClick,
  polygon = null,
  drawPoints = null,
  onDrawChange = null,
}: ParcelMapProps) {
  const drawing = typeof onDrawChange === 'function';
  return (
    <div className="overflow-hidden rounded-card border border-porcelain-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {pins.map((p) => (
          <CircleMarker
            key={p.id}
            center={p.centro}
            radius={9}
            pathOptions={{
              color: '#FFFFFF',
              weight: 2,
              fillColor: STATE_COLOR[p.estado] ?? STATE_COLOR.pendiente,
              fillOpacity: 1,
            }}
            eventHandlers={onPinClick ? { click: () => onPinClick(p) } : undefined}
          >
            <Tooltip>{p.nombre}</Tooltip>
          </CircleMarker>
        ))}

        {polygon && (
          <Polygon
            positions={polygon}
            pathOptions={{ color: '#0C3C2D', weight: 2, fillColor: '#0C3C2D', fillOpacity: 0.12 }}
          />
        )}

        {drawing && (
          <>
            <DrawLayer points={drawPoints} onChange={onDrawChange} />
            {!!drawPoints?.length && (
              <Polygon
                positions={drawPoints}
                pathOptions={{
                  color: '#0C3C2D',
                  weight: 2,
                  dashArray: '6 4',
                  fillColor: '#0C3C2D',
                  fillOpacity: 0.1,
                }}
              />
            )}
            {drawPoints?.map((pt, i) => (
              <CircleMarker
                key={i}
                center={pt}
                radius={4}
                pathOptions={{ color: '#FFFFFF', weight: 1.5, fillColor: '#0C3C2D', fillOpacity: 1 }}
              />
            ))}
          </>
        )}
      </MapContainer>
    </div>
  );
}

function DrawLayer({
  points,
  onChange,
}: {
  points: LatLng[] | null;
  onChange: (points: LatLng[]) => void;
}) {
  useMapEvents({
    click(e) {
      onChange([...(points ?? []), puntoDesdeCrudo({ lat: e.latlng.lat, lng: e.latlng.lng })]);
    },
  });
  return null;
}

/**
 * Área geodésica aproximada del polígono en hectáreas (fórmula esférica,
 * equivalente a turf.area). Suficiente para el gate de sensores del MVP;
 * el backend recalcula con PostGIS al guardar.
 */
export function areaHaFromPoints(points: LatLng[] | null | undefined): number {
  if (!points || points.length < 3) return 0;
  const R = 6378137;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i];
    const [lat2, lng2] = points[(i + 1) % points.length];
    total += (rad(lng2) - rad(lng1)) * (2 + Math.sin(rad(lat1)) + Math.sin(rad(lat2)));
  }
  return Math.abs((total * R * R) / 2) / 10000;
}
