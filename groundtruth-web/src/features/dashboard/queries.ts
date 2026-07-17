/**
 * Capa de datos del Operador: elige backend real (cuando Supabase está
 * configurado) o fixtures de maqueta, y adapta la forma del API a la que
 * consumen las vistas. Al conectar cada endpoint, solo se toca este archivo.
 *
 * Aquí vive la frontera de tipos: los `Api*` son lo que MANDA el backend
 * (snake_case, números como string, GeoJSON en [lng,lat]); lo que sale de estas
 * funciones ya es la forma que consumen las vistas.
 */
import { getSupabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { demoQueryFn } from '@/lib/demo';
import { useSession } from '@/stores/session';
import { PRIVILEGES } from '@/lib/privileges';
import {
  PARCELS,
  CERTIFICATES,
  TREASURY,
  SHIPMENTS,
  TEAM,
  FARMERS,
  UNIT_PROFILE,
  HA_POR_SENSOR,
} from './fixtures';
import type {
  Agricultor,
  CertificadoDetalle,
  CertificadoResumen,
  Ciclo,
  CrearAgricultorPayload,
  CrearParcelaPayload,
  EmbarqueDetalle,
  EmbarqueResumen,
  Equipo,
  EstadoEvaluado,
  EstadoParcela,
  Finca,
  GeoJsonPolygon,
  LatLng,
  Parcela,
  ParcelaDetalle,
  Privilege,
  ResultadoCertificacion,
  SubRol,
  Tesoreria,
  Unidad,
} from '@/types/api';
import { latLng, puntoDesdeCrudo } from '@/types/geo';

const isDemo = () => getSupabase() === null;

/** 404 del backend → `null` (la vista muestra "no encontrado"), lo demás se propaga. */
function nullSi404(e: unknown): null {
  if (e instanceof ApiError && e.status === 404) return null;
  throw e;
}

// ---- Formas crudas del backend (lo que llega por el cable) ----

interface ApiParcela {
  id: string;
  nombre: string;
  finca: string;
  cultivo: string;
  area_ha: string | number;
  sensores: string | number;
  ultimo_estado: EstadoEvaluado | null;
  centro_lat: string | number;
  centro_lng: string | number;
  fuente_simulada?: boolean | null;
  geom?: GeoJsonPolygon | null;
}

interface ApiTelemetria {
  estado_evaluado: EstadoEvaluado | null;
  ph: string | number;
  ec_us_cm: string | number;
  humedad_suelo_pct: string | number;
  temp_suelo_prof1_c: string | number;
  temp_suelo_prof2_c: string | number;
}

interface ApiCiclo {
  id: string;
  fecha_inicio: string;
  fecha_cierre: string | null;
  certificado: boolean;
}

interface ApiParcelaDetalle extends ApiParcela {
  telemetria: ApiTelemetria | null;
  ciclos?: ApiCiclo[];
  fuente_simulada?: boolean | null;
}

const estadoFrom = (evaluado: EstadoEvaluado | null | undefined): EstadoParcela =>
  evaluado === 'VERDE' ? 'conforme' : evaluado === 'ROJO' ? 'alerta' : 'pendiente';

/** GET /topologia/parcelas → forma de la tabla de Fincas y parcelas (O4). */
function mapParcela(r: ApiParcela): Parcela {
  const areaHa = Number(r.area_ha);
  return {
    id: r.id,
    nombre: r.nombre,
    finca: r.finca,
    cultivo: r.cultivo,
    areaHa,
    sensores: Number(r.sensores),
    sensoresRequeridos: Math.max(1, Math.ceil(areaHa / HA_POR_SENSOR)),
    estado: estadoFrom(r.ultimo_estado),
    // Sin pipeline de certificación aún: solo la etapa de telemetría se refleja.
    filled: r.ultimo_estado ? 1 : 0,
    certificada: false,
    fuenteSimulada: Boolean(r.fuente_simulada),
    centro: puntoDesdeCrudo({ lat: Number(r.centro_lat), lng: Number(r.centro_lng) }),
    geom: r.geom,
  };
}

export async function fetchParcelas(): Promise<Parcela[]> {
  if (isDemo()) return demoQueryFn(PARCELS)();
  const { data } = await api.get<ApiParcela[]>('/topologia/parcelas');
  return data.map(mapParcela);
}

/** Fincas de la unidad — selector del alta de parcela (O4). */
export async function fetchFincas(): Promise<Finca[]> {
  if (isDemo()) {
    const nombres = [...new Set(PARCELS.map((p) => p.finca))];
    return nombres.map((nombre, i) => ({
      id: `finca-${i}`,
      nombre,
      agricultor: '—',
      parcelas: 0,
    }));
  }
  const { data } = await api.get<Finca[]>('/topologia/fincas');
  return data;
}

/**
 * Alta de parcela. El área y el gate de cobertura los decide el SERVIDOR con
 * PostGIS: aquí solo se manda el polígono dibujado y los nodos declarados.
 */
export async function crearParcela(payload: CrearParcelaPayload): Promise<{ id: string }> {
  if (isDemo()) return { id: `par-${Date.now()}` };
  const { data } = await api.post<{ id: string }>('/topologia/parcelas', payload);
  return data;
}

export interface Overview {
  parcels: Parcela[];
  certsVigentes: number;
  treasury: { saldoUsdc: number } | null;
}

/**
 * Panel del operador (O2): una sola query arma el mapa, las métricas y el saldo.
 */
export async function fetchOverview(): Promise<Overview> {
  if (isDemo()) {
    const parcels = await demoQueryFn(PARCELS)();
    return {
      parcels,
      certsVigentes: CERTIFICATES.filter((c) => c.estado === 'vigente').length,
      treasury: TREASURY,
    };
  }
  const parcels = await fetchParcelas();
  // Saldo solo si el sub-rol puede ver tesorería (evita un 403 innecesario).
  let treasury: { saldoUsdc: number } | null = null;
  if (useSession.getState().can(PRIVILEGES.TREASURY_VIEW)) {
    const { data } = await api.get<{ saldoUsdc: number }>('/tesoreria/saldo');
    treasury = { saldoUsdc: data.saldoUsdc };
  }
  return {
    parcels,
    certsVigentes: parcels.filter((p) => p.certificada).length,
    treasury,
  };
}

/** Tesorería (O3): saldo, dirección e historial de movimientos. */
export async function fetchTesoreria(): Promise<Tesoreria> {
  if (isDemo()) return demoQueryFn(TREASURY as Tesoreria)();
  const { data } = await api.get<Tesoreria>('/tesoreria');
  return data;
}

/** Reconcilia contra la cadena (el operador acaba de depositar y no quiere esperar). */
export async function sincronizarTesoreria(): Promise<{ nuevos: number }> {
  if (isDemo()) return { nuevos: 0 };
  const { data } = await api.post<{ nuevos: number }>('/tesoreria/sincronizar');
  return data;
}

// ---- Embarques (O7) ----

export async function fetchEmbarques(): Promise<EmbarqueResumen[]> {
  if (isDemo()) {
    return SHIPMENTS.map((s) => ({
      id: s.id,
      cultivo: s.cultivo,
      estado: s.estado,
      fecha: s.fecha,
      numParcelas: s.parcelaIds.length,
    }));
  }
  const { data } = await api.get<EmbarqueResumen[]>('/embarques');
  return data;
}

/** El backend manda la parcela ya resuelta; aquí solo se deriva el sello. */
interface ApiEmbarqueDetalle extends Omit<EmbarqueDetalle, 'parcelas'> {
  parcelas: (Omit<Parcela, 'filled'> & { certificada: boolean })[];
}

export async function fetchEmbarque(id: string): Promise<EmbarqueDetalle | null> {
  if (isDemo()) {
    const s = SHIPMENTS.find((x) => x.id === id);
    if (!s) return null;
    return {
      id: s.id,
      cultivo: s.cultivo,
      estado: s.estado,
      fecha: s.fecha,
      parcelas: PARCELS.filter((p) => s.parcelaIds.includes(p.id)),
      certificados: CERTIFICATES.filter((c) => c.embarque === s.id).map((c) => ({
        id: c.id,
        numeroPublico: c.id,
        estado: c.estado,
        parcela: c.parcela,
      })),
    };
  }
  try {
    const { data } = await api.get<ApiEmbarqueDetalle>(`/embarques/${id}`);
    // Forma de la vista: filled/estado por parcela desde el backend.
    return {
      ...data,
      parcelas: data.parcelas.map((p) => ({ ...p, filled: p.certificada ? 4 : 0 })),
    };
  } catch (e) {
    return nullSi404(e);
  }
}

export async function createEmbarque(parcelaIds: string[]): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>('/embarques', { parcelaIds });
  return data;
}

export async function certificarEmbarque(id: string): Promise<ResultadoCertificacion> {
  const { data } = await api.post<ResultadoCertificacion>(`/embarques/${id}/certificar`);
  return data;
}

// ---- Certificados (O8) ----

export async function fetchCertificados(): Promise<CertificadoResumen[]> {
  if (isDemo()) {
    return CERTIFICATES.map((c) => ({
      id: c.id,
      numeroPublico: c.id,
      parcela: c.parcela,
      embarque: c.embarque,
      emitido: c.emitido,
      vigenciaHasta: c.vigenciaHasta,
      estado: c.estado,
    }));
  }
  const { data } = await api.get<CertificadoResumen[]>('/certificados');
  return data;
}

/** Lo que manda el backend: hashes sueltos, sin el par (onchain, computed). */
interface ApiCertificadoDetalle extends CertificadoResumen {
  cultivo: string;
  uriGeojson: string | null;
  revocadoEn: string | null;
  motivoRevocacion: string | null;
  assetId: string | null;
  hashPdf: string | null;
  hashImagen: string | null;
}

export async function fetchCertificado(id: string): Promise<CertificadoDetalle | null> {
  if (isDemo()) {
    const c = CERTIFICATES.find((x) => x.id === id);
    if (!c) return null;
    return {
      id: c.id,
      numeroPublico: c.id,
      parcela: c.parcela,
      embarque: c.embarque,
      emitido: c.emitido,
      vigenciaHasta: c.vigenciaHasta,
      estado: c.estado,
      cultivo: c.cultivo ?? '',
      uriGeojson: null,
      revocadoEn: c.revocado ?? null,
      motivoRevocacion: c.motivoRevocacion ?? null,
      assetId: c.assetId,
      tx: c.tx,
      hashes: { pdf: c.hashPdf, img: c.hashImg },
    };
  }
  try {
    const { data } = await api.get<ApiCertificadoDetalle>(`/certificados/${id}`);
    // Pre-Solana: sin hashes ni cNFT anclados aún → hashes = null (la vista lo indica).
    const hashes =
      data.hashPdf && data.hashImagen
        ? {
            pdf: { onchain: data.hashPdf, computed: data.hashPdf },
            img: { onchain: data.hashImagen, computed: data.hashImagen },
          }
        : null;
    return { ...data, tx: null, hashes };
  } catch (e) {
    return nullSi404(e);
  }
}

export async function revocarCertificado(id: string, motivo: string): Promise<{ id: string }> {
  const { data } = await api.post<{ id: string }>(`/certificados/${id}/revocar`, { motivo });
  return data;
}

// ---- Equipo y sub-roles (O9) ----

export async function fetchEquipo(): Promise<Equipo> {
  if (isDemo()) return { miembros: TEAM.members, subroles: TEAM.subroles };
  const { data } = await api.get<Equipo>('/equipo');
  return data;
}

export async function crearSubrol(nombre: string, privileges: Privilege[]): Promise<SubRol> {
  if (isDemo()) {
    const sr: SubRol = { id: `sr-${Date.now()}`, nombre, privileges, enUso: 0 };
    TEAM.subroles.push(sr);
    return sr;
  }
  const { data } = await api.post<SubRol>('/equipo/subroles', { nombre, privileges });
  return data;
}

export async function eliminarSubrol(id: string): Promise<{ id: string }> {
  if (isDemo()) {
    const i = TEAM.subroles.findIndex((s) => s.id === id);
    if (i >= 0) TEAM.subroles.splice(i, 1);
    return { id };
  }
  const { data } = await api.delete<{ id: string }>(`/equipo/subroles/${id}`);
  return data;
}

// ---- Agricultores (O5) ----

export async function fetchAgricultores(): Promise<Agricultor[]> {
  if (isDemo()) return FARMERS;
  const { data } = await api.get<Agricultor[]>('/agricultores');
  return data;
}

export async function crearAgricultor(payload: CrearAgricultorPayload): Promise<Agricultor> {
  if (isDemo()) {
    const a: Agricultor = {
      id: `agr-${Date.now()}`,
      nombre: payload.nombre,
      email: payload.email,
      finca: payload.fincaNombre,
      parcelas: 0,
    };
    FARMERS.push(a);
    return a;
  }
  const { data } = await api.post<Agricultor>('/agricultores', payload);
  return data;
}

// ---- Perfil de la unidad (O10) ----

export async function fetchUnidad(): Promise<Unidad> {
  if (isDemo()) {
    return {
      nombre: UNIT_PROFILE.nombre,
      pais: UNIT_PROFILE.pais,
      idiomaDefecto: UNIT_PROFILE.idiomaDefecto,
    };
  }
  const { data } = await api.get<Unidad>('/unidad');
  return data;
}

export async function actualizarUnidad(payload: Partial<Unidad>): Promise<Unidad> {
  if (isDemo()) return payload as Unidad;
  const { data } = await api.patch<Unidad>('/unidad', payload);
  return data;
}

/**
 * GeoJSON [lng,lat] → Leaflet [lat,lng], anillo exterior del polígono.
 *
 * Los tipos NO protegen aquí: `LatLng` y `LngLat` son ambos `[number, number]` y
 * TypeScript los considera el mismo tipo. Invertirlos manda el mapa al Golfo de
 * Guinea sin que nada se queje — por eso esta función está separada y **probada**
 * (`queries.geo.test.ts`). El test es la única red que existe contra ese error.
 */
export function anilloALeaflet(geom: GeoJsonPolygon | null | undefined): LatLng[] {
  // El destructurado de un `LngLat` da [Lng, Lat] POR POSICIÓN. Pasarlos a
  // `latLng(lat, lng)` en el orden equivocado ya no compila: son tipos distintos.
  return geom?.coordinates?.[0]?.map(([longitud, latitud]) => latLng(latitud, longitud)) ?? [];
}

/** GET /topologia/parcelas/:id → forma del detalle de parcela (O4/O6). */
export function mapParcelaDetalle(r: ApiParcelaDetalle): ParcelaDetalle {
  const areaHa = Number(r.area_ha);
  const ciclosRaw: ApiCiclo[] = r.ciclos ?? [];
  const certificada = ciclosRaw.some((c) => c.certificado);
  const tel = r.telemetria;
  const poligono: LatLng[] = anilloALeaflet(r.geom);
  const ciclos: Ciclo[] = ciclosRaw.map((c) => ({
    id: c.id,
    inicio: c.fecha_inicio,
    fin: c.fecha_cierre,
    certificado: c.certificado,
  }));
  return {
    id: r.id,
    nombre: r.nombre,
    finca: r.finca,
    cultivo: r.cultivo,
    areaHa,
    sensores: Number(r.sensores),
    sensoresRequeridos: Math.max(1, Math.ceil(areaHa / HA_POR_SENSOR)),
    estado: estadoFrom(tel?.estado_evaluado),
    certificada,
    filled: certificada ? 4 : tel ? 1 : 0,
    fuenteSimulada: Boolean(r.fuente_simulada),
    centro: puntoDesdeCrudo({ lat: Number(r.centro_lat), lng: Number(r.centro_lng) }),
    poligono,
    telemetria: tel
      ? {
          ph: Number(tel.ph),
          ec: Number(tel.ec_us_cm),
          humedad: Number(tel.humedad_suelo_pct),
          tempSup: Number(tel.temp_suelo_prof1_c),
          tempProf: Number(tel.temp_suelo_prof2_c),
        }
      : null,
    ciclos,
  };
}

export async function fetchParcela(id: string): Promise<ParcelaDetalle | null> {
  if (isDemo()) return (PARCELS.find((p) => p.id === id) as ParcelaDetalle | undefined) ?? null;
  try {
    const { data } = await api.get<ApiParcelaDetalle>(`/topologia/parcelas/${id}`);
    return mapParcelaDetalle(data);
  } catch (e) {
    return nullSi404(e);
  }
}
