/**
 * El contrato con el backend, en un solo sitio.
 *
 * Hay DOS familias de tipos y conviene no mezclarlas:
 *
 *  - `Api*`  → lo que el backend devuelve TAL CUAL (snake_case, números como
 *              string por venir de Postgres, GeoJSON en [lng,lat]).
 *  - el resto → la forma que consumen las vistas (camelCase, números ya
 *              convertidos, coordenadas ya en [lat,lng] para Leaflet).
 *
 * La frontera entre ambas son los `queries.ts` de cada superficie, y ese es el sitio
 * donde antes se colaban los errores: `Number(r.area_ha)` sobre un campo que el
 * backend había dejado de enviar no fallaba, daba `NaN`.
 */

// ---- Primitivas ----

/**
 * Leaflet usa [lat, lng]; GeoJSON usa [lng, lat]. NO son alias del mismo tipo: la
 * latitud y la longitud están marcadas como tipos distintos (ver `types/geo.ts`),
 * así que intercambiarlas **no compila**.
 */
export type { Lat, Lng, LatLng, LngLat } from './geo';
import type { LatLng, LngLat } from './geo';

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: LngLat[][];
}

/** Semáforo de la parcela en la UI. Deriva de `estado_evaluado` de la telemetría. */
export type EstadoParcela = 'conforme' | 'alerta' | 'pendiente';

/** Lo que evalúa el backend a partir de los umbrales EUDR. */
export type EstadoEvaluado = 'VERDE' | 'ROJO';

/**
 * Estado del certificado **como lo emite la BD**. Solo llega crudo por el
 * verificador público; el resto de superficies lo reciben ya traducido.
 */
export type EstadoCertificado = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED' | 'EXPIRED' | 'REVOKED';

/**
 * Estado del certificado **como lo manda el backend a la UI** (`ESTADO_UI`).
 * No es el enum de la BD: el backend ya lo mapea, y el StatusBadge espera esto.
 */
export type EstadoCertificadoUi =
  | 'pendiente'
  | 'vigente'
  | 'sustituido'
  | 'expirado'
  | 'revocado';

/**
 * Estado del embarque ya mapeado por el backend. El enum de la BD es
 * `BORRADOR | LISTO_APROBACION | PROCESANDO | EMITIDO | FALLIDO`.
 */
export type EstadoEmbarque = 'borrador' | 'listo' | 'procesando' | 'emitido' | 'fallido';

// ---- Sesión y privilegios ----

export type Privilege =
  | 'unidad.configurar'
  | 'equipo.gestionar'
  | 'agricultores.gestionar'
  | 'topologia.gestionar'
  | 'telemetria.ver'
  | 'tesoreria.ver'
  | 'embarques.preparar'
  | 'certificados.emitir'
  | 'certificados.revocar'
  | 'certificados.ver';

export interface Membership {
  operadorId: string;
  operadorNombre: string;
  subRolNombre: string;
  privileges: Privilege[];
}

/**
 * "Rol ≠ persona" (Modelo-de-Datos §1): NO hay campo `rol`. El rol se DERIVA de
 * tener membresías (operador) o fincas propias (agricultor) — y se puede ser ambos.
 */
export interface Profile {
  id: string;
  nombre: string;
  email: string;
  esAdmin: boolean;
  memberships: Membership[];
  fincasPropias: string[];
}

export type ActiveContext =
  | { type: 'operator'; operadorId: string; operadorNombre: string }
  | { type: 'farmer' };

// ---- Topología ----

export interface Parcela {
  id: string;
  nombre: string;
  finca: string;
  cultivo: string;
  areaHa: number;
  sensores: number;
  sensoresRequeridos: number;
  estado: EstadoParcela;
  /** Etapas completas del sello (0–4). Alimenta el SealProgress. */
  filled: number;
  certificada: boolean;
  fuenteSimulada?: boolean;
  centro: LatLng;
  geom?: GeoJsonPolygon | null;
}

export interface Telemetria {
  ph: number;
  ec: number;
  humedad: number;
  tempSup: number;
  tempProf: number;
}

export interface Ciclo {
  id: string;
  inicio: string;
  fin: string | null;
  certificado: boolean;
}

export interface ParcelaDetalle extends Omit<Parcela, 'geom'> {
  /** Ya convertido a [lat,lng]: listo para Leaflet, no para GeoJSON. */
  poligono: LatLng[];
  telemetria: Telemetria | null;
  ciclos: Ciclo[];
  fuenteSimulada?: boolean;
}

export interface Finca {
  id: string;
  nombre: string;
  agricultor: string;
  parcelas: number;
}

export interface CrearParcelaPayload {
  fincaId: string;
  nombre: string;
  cultivo: string;
  /** Anillo exterior en [lat,lng] (orden de Leaflet). El backend lo pasa a GeoJSON. */
  poligono: LatLng[];
  /**
   * Identificadores de los nodos que se instalarán. Los nodos se crean CON la
   * parcela (`nodos_sensores.parcela_id` es NOT NULL): un nodo suelto no existe.
   */
  nodos: string[];
}

// ---- Tesorería ----

/** Clave i18n del tipo de movimiento (el backend ya traduce `TIPO_UI`). */
export type TipoMovimiento = 'deposit' | 'debit_cert' | 'debit_manifest' | string;

export interface Movimiento {
  id: string;
  tipo: TipoMovimiento;
  /** Ya en USDC (el backend divide los micro-USDC). Negativo = débito. */
  monto: number;
  fecha: string;
  tx: string | null;
}

export interface Tesoreria {
  saldoUsdc: number;
  /**
   * Dirección de depósito: es el **ATA**, no la Treasury PDA. La PDA está fuera
   * de la curva y varias wallets se niegan a enviarle tokens — enseñarla como
   * destino sería invitar a que un depósito se pierda.
   */
  address: string;
  treasuryPda?: string;
  red?: string;
  movimientos: Movimiento[];
}

// ---- Embarques y certificados ----

export interface EmbarqueResumen {
  id: string;
  cultivo: string;
  estado: EstadoEmbarque;
  fecha: string;
  numParcelas: number;
}

export interface EmbarqueDetalle {
  id: string;
  cultivo: string;
  estado: EstadoEmbarque;
  fecha: string;
  parcelas: Parcela[];
  certificados: CertificadoResumen[];
}

export interface CertificadoResumen {
  id: string;
  numeroPublico: string;
  parcela: string;
  embarque?: string;
  emitido?: string;
  vigenciaHasta?: string;
  estado: EstadoCertificadoUi;
}

/** Par (anclado en cadena, recalculado por el cliente). Si difieren, el documento miente. */
export interface HashPar {
  onchain: string;
  computed: string;
}

export interface CertificadoDetalle extends CertificadoResumen {
  cultivo: string;
  revocadoEn: string | null;
  motivoRevocacion: string | null;
  assetId: string | null;
  /** URI `ar://…` del GeoJSON. `null` mientras no se haya subido a Arweave. */
  uriGeojson: string | null;
  tx: string | null;
  /** `null` mientras no haya anclaje on-chain: la vista lo dice, no lo inventa. */
  hashes: { pdf: HashPar; img: HashPar } | null;
}

export interface ResultadoCertificacion {
  certificados: CertificadoResumen[];
  saldoUsdc: number;
}

// ---- Equipo ----

export interface Miembro {
  id: string;
  nombre: string;
  email: string;
  subRol: string;
  subRolId?: string;
}

export interface SubRol {
  id: string;
  nombre: string;
  privileges: Privilege[];
  /** Cuántas membresías lo usan: si es > 0, no se puede borrar. */
  enUso: number;
  /** Sub-rol creado por la plataforma al dar de alta la unidad. */
  esAutogenerado?: boolean;
}

export interface Equipo {
  miembros: Miembro[];
  subroles: SubRol[];
}

// ---- Agricultores y unidad ----

export interface Agricultor {
  id: string;
  nombre: string;
  email: string;
  finca: string;
  parcelas: number;
}

export interface CrearAgricultorPayload {
  nombre: string;
  email: string;
  fincaNombre: string;
}

export interface Unidad {
  nombre: string;
  pais: string;
  idiomaDefecto: string;
}

// ---- Verificador público (sin login) ----

export interface CertificadoPublico {
  numeroPublico: string;
  estado: EstadoCertificado;
  cultivo: string;
  pais: string;
  emitidoEn: string;
  vigenteHasta: string;
  hashPdf: string | null;
  hashImagen: string | null;
  assetId: string | null;
  uriGeojson: string | null;
  revocadoEn: string | null;
}

// =====================================================================
// Superficie del Admin de plataforma. Ninguna de estas llamadas manda
// `x-operador-id`: el admin no pertenece a una unidad, las cruza todas.
// =====================================================================

export type EstadoUnidad = 'activa' | 'suspendida' | 'pendiente';
export type EstadoCuenta = 'activa' | 'inactiva';

export interface UnidadResumen {
  id: string;
  nombre: string;
  pais: string;
  parcelas: number;
  saldoUsdc: number;
  estado: EstadoUnidad;
}

export interface UnidadDetalle {
  id: string;
  nombre: string;
  pais: string;
  estado: EstadoUnidad;
  /** La Treasury PDA. `null` mientras la unidad sigue `PENDIENTE_ONCHAIN`. */
  treasury: string | null;
  saldoUsdc: number | null;
  miembros: Miembro[];
}

export interface CrearUnidadPayload {
  nombre: string;
  pais: string;
  adminNombre: string;
  adminEmail: string;
}

export interface UsuarioAdmin {
  id: string;
  nombre: string;
  email: string;
  membresias: string;
  estado: EstadoCuenta;
}

export interface PrivilegioCatalogo {
  id: string;
  clave: string;
  nombre: string;
  sensible: boolean;
  estado: 'activo' | 'deprecado';
  enSubroles: number;
}

export interface UmbralesCultivo {
  vigenciaDias: number;
  phMin: number;
  phMax: number;
  humedadMin: number;
  [k: string]: number;
}

export interface Parametros {
  tarifas: { certificacionUsdc: number; manifiestoUsdc: number };
  haPorSensor: number;
  cultivos: Record<string, UmbralesCultivo>;
}

export interface CambioAuditado {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface EntradaAuditoria {
  id: string;
  fecha: string;
  quien: string;
  cambios: CambioAuditado[];
}

export interface MetricasGlobales {
  unidades: number;
  certificados30d: number;
  sagasPendientes: number;
  alertasAbiertas: number;
}

/** Finanzas de plataforma (A-finanzas): dinero de LA PLATAFORMA, no de cada operador. */
export interface Finanzas {
  /** Si es `false`, los valores on-chain (`plataformaUsdc`, `gas.solBackend`) van `null`. */
  solanaActiva: boolean;
  ingresos: {
    /** Saldo real acumulado on-chain en la cuenta de ingresos, o `null` sin cadena. */
    plataformaUsdc: number | null;
    /** Total cobrado según la BD (histórico, existe con o sin cadena). */
    cobradoTotalUsdc: number;
    porCertificacionUsdc: number;
    porManifiestoUsdc: number;
  };
  gas: {
    /** Saldo SOL del firmante del backend (el fondo de gas), o `null` sin cadena. */
    solBackend: number | null;
    /** `true` si el fondo de gas está por debajo del umbral de alerta. */
    bajo: boolean;
  };
  agregados: {
    /** Suma de los saldos de todas las tesorerías (fondos de los operadores). */
    tesoreriasUsdc: number;
    certificadosEmitidos: number;
    manifiestosEmitidos: number;
  };
}

export interface ParcelaGlobal {
  id: string;
  nombre: string;
  unidad: string;
  cultivo: string;
  estado: EstadoParcela;
  certificada: boolean;
  centro?: LatLng;
}

export interface SagaEntry {
  id: string;
  embarque: string;
  unidad: string;
  paso: string;
  estado: string;
  retryable: boolean;
  intentos: number;
  /** `error_detalle` guarda una CLAVE i18n, no texto libre: el idioma lo pone el front. */
  motivoKey: string | null;
  fecha: string;
}

export interface CertificadoGlobal {
  id: string;
  numeroPublico: string;
  parcela: string;
  unidad: string;
  emitido?: string;
  estado: string;
}

export type EstadoIntegracion = 'ok' | 'warn' | 'down' | 'no_configurado';

export interface Integracion {
  key: string;
  nombre: string;
  estado: EstadoIntegracion;
  latenciaMs: number | null;
}

export type PerfilSimulacion = 'sano' | 'degradado';

export interface NodoSimulado {
  id: string;
  externalId: string;
  parcelaId: string;
  parcela: string;
  unidad: string;
  activo: boolean;
  /** Última lectura recibida. `null` = el nodo nunca ha reportado. */
  ultimaLectura: string | null;
}


// ---- Superficie del Agricultor (DApp lite) ----

/** Alerta de umbral EUDR. `valor` y `umbral` ya vienen con su unidad desde el backend. */
export interface AlertaAgricultor {
  id: string;
  parcelaId: string;
  parcela: string;
  /** CLAVE i18n de la variable — es lo que manda el backend real. */
  variableKey?: string;
  /** Etiqueta ya localizada: solo la maqueta. La vista acepta ambas. */
  variable?: string;
  valor: string;
  umbral: string;
  fecha: string;
}

export interface ParcelaAgricultor {
  id: string;
  nombre: string;
  cultivo: string;
  areaHa: number;
  estado: EstadoParcela;
  certificada: boolean;
  filled: number;
}

export interface ParcelaAgricultorDetalle extends ParcelaAgricultor {
  ciclos: Ciclo[];
}
