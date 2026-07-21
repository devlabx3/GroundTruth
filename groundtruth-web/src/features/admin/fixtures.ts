/**
 * Fixtures del Admin GroundTruth (modo maqueta) — visión multi-unidad.
 * op-1 coincide con la unidad de features/dashboard/fixtures.js.
 */

import type {
  Finanzas,
  Integracion,
  MetricasGlobales,
  Miembro,
  NodoSimulado,
  ParcelaGlobal,
  PerfilSimulacion,
  SagaEntry,
  UnidadResumen,
  UsuarioAdmin,
} from '@/types/api';

export const GLOBAL_METRICS: MetricasGlobales = {
  unidades: 3,
  certificados30d: 87,
  sagasPendientes: 2,
  alertasAbiertas: 4,
};

// Modo maqueta: sin cadena, así que los valores on-chain van null. El resto es coherente
// (87 certificados × 5 + 29 manifiestos × 2 ≈ lo cobrado).
export const FINANZAS: Finanzas = {
  solanaActiva: false,
  ingresos: {
    plataformaUsdc: null,
    cobradoTotalUsdc: 493,
    porCertificacionUsdc: 435,
    porManifiestoUsdc: 58,
  },
  gas: { solBackend: null, bajo: false },
  agregados: {
    tesoreriasUsdc: 3120,
    certificadosEmitidos: 87,
    manifiestosEmitidos: 29,
  },
};

export const UNITS: (UnidadResumen & { treasury: string | null; miembros: Miembro[] })[] = [
  {
    id: 'op-1',
    nombre: 'Coop. Sierra Verde',
    pais: 'Honduras',
    parcelas: 5,
    saldoUsdc: 1250.5,
    estado: 'activa',
    treasury: 'Gt7hKQz3vXk1mP9dW2sYbUcE5rJ8aNfL4qTgHxRmD2Vu',
    miembros: [
      { id: 'u-demo-lucia', nombre: 'Lucía Fernández', email: 'lucia@sierraverde.coop', subRol: 'Dirección' },
      { id: 'u-demo-tomas', nombre: 'Tomás Rivas', email: 'tomas@sierraverde.coop', subRol: 'Logística' },
      { id: 'u-demo-ines', nombre: 'Inés Castillo', email: 'ines@sierraverde.coop', subRol: 'Campo' },
    ],
  },
  {
    id: 'op-2',
    nombre: 'AgroExport Kivu',
    pais: 'RD Congo',
    parcelas: 12,
    saldoUsdc: 310,
    estado: 'activa',
    treasury: 'Hx2mNQw8rTk5vB1pY7dL3sJcE9uF4aZg6qWiOxKmC3Vt',
    miembros: [
      { id: 'u-kivu-1', nombre: 'Aline Mukamana', email: 'aline@agrokivu.cd', subRol: 'Dirección' },
    ],
  },
  {
    id: 'op-3',
    nombre: 'Cacao del Darién',
    pais: 'Colombia',
    parcelas: 7,
    saldoUsdc: 0,
    estado: 'suspendida',
    treasury: 'Jz4pOQx0tUk7wC3rA9fN5uLdG1vH6bXi8sYkQzMoE5Wu',
    miembros: [
      { id: 'u-dar-1', nombre: 'Camilo Restrepo', email: 'camilo@cacaodarien.co', subRol: 'Dirección' },
    ],
  },
];

export const USERS: UsuarioAdmin[] = [
  { id: 'u-demo-lucia', nombre: 'Lucía Fernández', email: 'lucia@sierraverde.coop', membresias: 'Coop. Sierra Verde', rol: 'Dirección', estado: 'activa' },
  { id: 'u-demo-tomas', nombre: 'Tomás Rivas', email: 'tomas@sierraverde.coop', membresias: 'Coop. Sierra Verde', rol: 'Logística', estado: 'activa' },
  { id: 'u-demo-pedro', nombre: 'Pedro Ayala', email: 'pedro.ayala@correo.hn', membresias: '', rol: 'Agricultor', estado: 'activa' },
  { id: 'u-kivu-1', nombre: 'Aline Mukamana', email: 'aline@agrokivu.cd', membresias: 'AgroExport Kivu', rol: 'Dirección', estado: 'activa' },
  { id: 'u-dar-1', nombre: 'Camilo Restrepo', email: 'camilo@cacaodarien.co', membresias: 'Cacao del Darién', rol: 'Dirección', estado: 'inactiva' },
];

// Parámetros versionados (A4): tarifas / umbrales / vigencia / sensores.
export const SYSTEM_PARAMS = {
  tarifas: { certificacionUsdc: 5, manifiestoUsdc: 2 },
  vigenciaMeses: 9,
  haPorSensor: 2,
  umbrales: {
    cafe: { phMin: 5.5, phMax: 6.8, humedadMin: 35, humedadMax: 60 },
    cacao: { phMin: 5.0, phMax: 7.0, humedadMin: 40, humedadMax: 65 },
    aguacate: { phMin: 5.5, phMax: 7.0, humedadMin: 30, humedadMax: 55 },
  },
};

export const PARAMS_AUDIT_LOG = [
  { id: 'aud-3', fecha: '2026-06-18', parametro: 'tarifas.certificacionUsdc', antes: '4', despues: '5', quien: 'Soporte GroundTruth' },
  { id: 'aud-2', fecha: '2026-05-02', parametro: 'umbrales.cafe.humedadMin', antes: '30', despues: '35', quien: 'Soporte GroundTruth' },
  { id: 'aud-1', fecha: '2026-03-15', parametro: 'vigenciaMeses', antes: '12', despues: '9', quien: 'Soporte GroundTruth' },
];

// Cola del saga de certificación (A7): CERT_PENDING = reintento programado.
export const SAGA_QUEUE: SagaEntry[] = [
  {
    id: 'saga-771',
    embarque: 'emb-2026-021',
    unidad: 'AgroExport Kivu',
    paso: 'satellite',
    estado: 'FAILED',
    retryable: true,
    intentos: 2,
    motivoKey: 'sentinel_down',
    fecha: '2026-07-11T22:10:00Z',
  },
  {
    id: 'saga-769',
    embarque: 'emb-2026-019',
    unidad: 'Coop. Sierra Verde',
    paso: 'arweave',
    estado: 'CERT_PENDING',
    retryable: true,
    intentos: 1,
    motivoKey: 'arweave_retry',
    fecha: '2026-07-12T03:35:00Z',
  },
];

// Salud de integraciones (A9) — las 5 del stack.
// Mismas 6 integraciones (y orden) que devuelve el backend real, para que el modo
// maqueta no discrepe. "Activas" (ok o warn) = 4; caída + no configurada = 2 → badge 4/6.
export const INTEGRATIONS: (Integracion & { alertaKey?: string })[] = [
  { key: 'sentinel', nombre: 'Sentinel Hub', estado: 'no_configurado', latenciaMs: null },
  { key: 'helius', nombre: 'Helius (webhooks)', estado: 'warn', latenciaMs: null },
  { key: 'irys', nombre: 'Irys / Arweave (devnet)', estado: 'ok', latenciaMs: 210 },
  { key: 'rpc', nombre: 'RPC Solana', estado: 'down', latenciaMs: null, alertaKey: 'rpc_down' },
  { key: 'storage', nombre: 'Supabase Storage (evidencia)', estado: 'ok', latenciaMs: 70 },
  { key: 'supabase', nombre: 'Supabase (Postgres)', estado: 'ok', latenciaMs: 55 },
];

// Nodos del simulador IoT (A5).
// `parcelaId` NO es decorativo: la vista construye con él el selector de parcelas
// (`AdminSimulatorPage`). Sin él, la maqueta generaba lecturas contra `undefined`.
export const SIM_NODES: (NodoSimulado & { perfil: PerfilSimulacion })[] = [
  { id: 'nodo-A1', externalId: 'GT-A1', parcelaId: 'par-01', parcela: 'La Esperanza · 03', unidad: 'Coop. Sierra Verde', perfil: 'sano', activo: true, ultimaLectura: '2026-07-12T04:00:00Z' },
  { id: 'nodo-A2', externalId: 'GT-A2', parcelaId: 'par-01', parcela: 'La Esperanza · 03', unidad: 'Coop. Sierra Verde', perfil: 'sano', activo: true, ultimaLectura: '2026-07-12T04:00:00Z' },
  { id: 'nodo-B1', externalId: 'GT-B1', parcelaId: 'par-02', parcela: 'El Mirador · 07', unidad: 'Coop. Sierra Verde', perfil: 'sano', activo: true, ultimaLectura: '2026-07-12T04:00:00Z' },
  { id: 'nodo-C1', externalId: 'GT-C1', parcelaId: 'par-03', parcela: 'Alto Verde · 01', unidad: 'Coop. Sierra Verde', perfil: 'degradado', activo: true, ultimaLectura: '2026-07-12T04:00:00Z' },
  { id: 'nodo-K1', externalId: 'GT-K1', parcelaId: 'par-k2', parcela: 'Kivu Norte · 02', unidad: 'AgroExport Kivu', perfil: 'sano', activo: false, ultimaLectura: null },
];

// Supervisión global (A6): parcelas de todas las unidades.
export const GLOBAL_PARCELS: ParcelaGlobal[] = [
  { id: 'par-01', nombre: 'La Esperanza · 03', unidad: 'Coop. Sierra Verde', cultivo: 'cafe', estado: 'conforme', certificada: true },
  { id: 'par-02', nombre: 'El Mirador · 07', unidad: 'Coop. Sierra Verde', cultivo: 'cafe', estado: 'pendiente', certificada: false },
  { id: 'par-03', nombre: 'Alto Verde · 01', unidad: 'Coop. Sierra Verde', cultivo: 'cacao', estado: 'alerta', certificada: false },
  { id: 'par-04', nombre: 'La Esperanza · 04', unidad: 'Coop. Sierra Verde', cultivo: 'cafe', estado: 'conforme', certificada: false },
  { id: 'par-05', nombre: 'Santa Rita · 02', unidad: 'Coop. Sierra Verde', cultivo: 'cacao', estado: 'conforme', certificada: false },
  { id: 'par-k1', nombre: 'Kivu Norte · 01', unidad: 'AgroExport Kivu', cultivo: 'cafe', estado: 'conforme', certificada: true },
  { id: 'par-k2', nombre: 'Kivu Norte · 02', unidad: 'AgroExport Kivu', cultivo: 'cafe', estado: 'pendiente', certificada: false },
  { id: 'par-d1', nombre: 'Darién Alto · 01', unidad: 'Cacao del Darién', cultivo: 'cacao', estado: 'alerta', certificada: false },
];
