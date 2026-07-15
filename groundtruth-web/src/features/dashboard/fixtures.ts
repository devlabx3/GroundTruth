/**
 * Fixtures del Operador (modo maqueta).
 *
 * Van ANOTADAS con los tipos del dominio a propósito: si la maqueta se desvía
 * de lo que el backend devuelve de verdad, el proyecto deja de compilar. Antes,
 * la demo podía mentir sin que nadie se enterara hasta ver la pantalla.
 */
import type {
  Agricultor,
  CertificadoResumen,
  EstadoCertificadoUi,
  EstadoEmbarque,
  Miembro,
  ParcelaDetalle,
  SubRol,
  Tesoreria,
  Unidad,
} from '@/types/api';
import { puntoDesdeCrudo, puntos } from '@/types/geo';

// Serie temporal determinística de 24 h para las mini-gráficas de telemetría
// (con backend: Realtime + query histórica). `base` = último valor del fixture.
export interface SeriePunto {
  t: string;
  v: number;
}

export function genTelemetrySeries(base: number, amplitude = 0.06, points = 24): SeriePunto[] {
  return Array.from({ length: points }, (_, i) => {
    const wobble = Math.sin(i / 3.1) * amplitude + Math.sin(i / 7.7) * amplitude * 0.5;
    const hour = String(i).padStart(2, '0');
    return { t: `${hour}:00`, v: Number((base * (1 + wobble)).toFixed(2)) };
  });
}

// Parcelas de Coop. Sierra Verde (op-1) — zona cafetera de Marcala, Honduras.
// `filled` = segmentos del núcleo: telemetría → satélite → tesorería → certificado.
// `poligono` = [lat, lng][]; el GeoJSON real vivirá en Arweave (Arquitectura §11).
export const PARCELS: (ParcelaDetalle & { agricultor: string })[] = [
  {
    id: 'par-01',
    centro: puntoDesdeCrudo({ lat: 14.1552, lng: -88.029 }),
    poligono: puntos([[14.1597, -88.03305], [14.15835, -88.0245], [14.1516, -88.0254], [14.1507, -88.03215]]),
    nombre: 'La Esperanza · 03',
    finca: 'La Esperanza',
    agricultor: 'Pedro Ayala',
    cultivo: 'cafe',
    areaHa: 4.2,
    sensores: 2,
    sensoresRequeridos: 2,
    estado: 'conforme',
    filled: 4,
    certificada: true,
    ciclos: [
      { id: 'c-011', inicio: '2025-11-02', fin: null, certificado: true },
      { id: 'c-010', inicio: '2025-03-10', fin: '2025-10-28', certificado: true },
    ],
    telemetria: { ph: 6.4, ec: 1.2, humedad: 41, tempSup: 24.1, tempProf: 22.8 },
  },
  {
    id: 'par-02',
    centro: puntoDesdeCrudo({ lat: 14.1495, lng: -88.0412 }),
    poligono: puntos([[14.15333, -88.04464], [14.15218, -88.03737], [14.14644, -88.03814], [14.14567, -88.04388]]),
    nombre: 'El Mirador · 07',
    finca: 'El Mirador',
    agricultor: 'Rosa Méndez',
    cultivo: 'cafe',
    areaHa: 3.1,
    sensores: 1,
    sensoresRequeridos: 2,
    estado: 'pendiente',
    filled: 2,
    certificada: false,
    ciclos: [{ id: 'c-021', inicio: '2026-01-15', fin: null, certificado: false }],
    telemetria: { ph: 6.1, ec: 1.0, humedad: 38, tempSup: 23.4, tempProf: 22.1 },
  },
  {
    id: 'par-03',
    centro: puntoDesdeCrudo({ lat: 14.1638, lng: -88.0203 }),
    poligono: puntos([[14.16897, -88.02496], [14.16742, -88.01513], [14.15966, -88.01616], [14.15863, -88.02392]]),
    nombre: 'Alto Verde · 01',
    finca: 'Alto Verde',
    agricultor: 'Elías Cruz',
    cultivo: 'cacao',
    areaHa: 5.6,
    sensores: 3,
    sensoresRequeridos: 3,
    estado: 'alerta',
    filled: 1,
    certificada: false,
    ciclos: [{ id: 'c-031', inicio: '2025-12-01', fin: null, certificado: false }],
    telemetria: { ph: 4.9, ec: 2.4, humedad: 22, tempSup: 27.9, tempProf: 25.3 },
  },
  {
    id: 'par-04',
    centro: puntoDesdeCrudo({ lat: 14.1571, lng: -88.0335 }),
    poligono: puntos([[14.16047, -88.03654], [14.15946, -88.03012], [14.1544, -88.0308], [14.15372, -88.03586]]),
    nombre: 'La Esperanza · 04',
    finca: 'La Esperanza',
    agricultor: 'Pedro Ayala',
    cultivo: 'cafe',
    areaHa: 2.8,
    sensores: 2,
    sensoresRequeridos: 2,
    estado: 'conforme',
    filled: 3,
    certificada: false,
    ciclos: [{ id: 'c-041', inicio: '2025-11-20', fin: null, certificado: false }],
    telemetria: { ph: 6.2, ec: 1.1, humedad: 44, tempSup: 23.8, tempProf: 22.5 },
  },
  {
    id: 'par-05',
    centro: puntoDesdeCrudo({ lat: 14.1449, lng: -88.0188 }),
    poligono: puntos([[14.1503, -88.02366], [14.14868, -88.0134], [14.14058, -88.01448], [14.1395, -88.02258]]),
    nombre: 'Santa Rita · 02',
    finca: 'Santa Rita',
    agricultor: 'Marta Solís',
    cultivo: 'cacao',
    areaHa: 6.0,
    sensores: 3,
    sensoresRequeridos: 3,
    estado: 'conforme',
    filled: 3,
    certificada: false,
    ciclos: [{ id: 'c-051', inicio: '2026-02-05', fin: null, certificado: false }],
    telemetria: { ph: 6.6, ec: 1.4, humedad: 47, tempSup: 25.2, tempProf: 23.9 },
  },
];

export const TREASURY: Tesoreria = {
  address: 'Gt7hKQz3vXk1mP9dW2sYbUcE5rJ8aNfL4qTgHxRmD2Vu',
  saldoUsdc: 1250.5,
  movimientos: [
    { id: 'mv-6', fecha: '2026-07-08', tipo: 'deposit', monto: 500, tx: '5KqW8zX1cR4vN7pL2mB9aY3dF6gH0jT4uS8eI1oQ7wEr' },
    { id: 'mv-5', fecha: '2026-07-02', tipo: 'debit_manifest', monto: -2, tx: '3JmN5xV9bQ2wE7rT1yU4iO8pA6sD0fG3hK5lZ9cX2vBn' },
    { id: 'mv-4', fecha: '2026-07-02', tipo: 'debit_cert', monto: -10, tx: '8HgF2dS6aP0oI4uY7tR1eW5qZ9xC3vB6nM8kJ2lQ4wEt' },
    { id: 'mv-3', fecha: '2026-06-24', tipo: 'deposit', monto: 750, tx: '2WeR6tY0uI3oP7aS1dF5gH9jK4lZ8xC2vB6nM0qA3sDf' },
    { id: 'mv-2', fecha: '2026-06-12', tipo: 'debit_cert', monto: -5, tx: '9QaZ3wS7xE1dC5rF8vT2gB6yH0nU4jM7kI1lO5pP9aSd' },
    { id: 'mv-1', fecha: '2026-06-01', tipo: 'deposit', monto: 100, tx: '4TyU8iO2pA6sD0fG3hJ7kL1zX5cV9bN2mQ6wE0rT4yUi' },
  ],
};

export const SHIPMENTS: { id: string; cultivo: string; estado: EstadoEmbarque; fecha: string; parcelaIds: string[] }[] = [
  { id: 'emb-2026-018', cultivo: 'cafe', parcelaIds: ['par-01', 'par-04'], estado: 'emitido', fecha: '2026-07-02' },
  { id: 'emb-2026-019', cultivo: 'cacao', parcelaIds: ['par-05'], estado: 'listo', fecha: '2026-07-09' },
  { id: 'emb-2026-020', cultivo: 'cafe', parcelaIds: ['par-02'], estado: 'borrador', fecha: '2026-07-11' },
];

const HASH_PDF = 'a3f1c9e27b40d8156ef2384c0a9d7b615f3e8a2c4d901b7e6f5a8c3d2e1b0f49';
const HASH_IMG = '7c2e94b1f8a35d60c4e17f92a8b5d3061e9c4f7a2b8d5e30f1a6c9b4d7e2a815';

// Sin `numeroPublico`: en la maqueta el número público ES el id (lo derivan las queries).
export const CERTIFICATES: (Omit<CertificadoResumen, 'numeroPublico'> & {
  parcelaId?: string;
  cultivo?: string;
  estado: EstadoCertificadoUi;
  revocado?: string | null;
  motivoRevocacion?: string | null;
  assetId: string | null;
  tx: string | null;
  hashPdf: { onchain: string; computed: string };
  hashImg: { onchain: string; computed: string };
})[] = [
  {
    id: 'GT-2026-000341',
    parcelaId: 'par-01',
    parcela: 'La Esperanza · 03',
    embarque: 'emb-2026-018',
    emitido: '2026-07-02',
    vigenciaHasta: '2027-04-02',
    estado: 'vigente',
    assetId: 'AsT4vN8pL1mB5aY9dF2gH6jK0uS3eI7oQ1wErX5cVzBq',
    tx: '8HgF2dS6aP0oI4uY7tR1eW5qZ9xC3vB6nM8kJ2lQ4wEt',
    hashPdf: { onchain: HASH_PDF, computed: HASH_PDF },
    hashImg: { onchain: HASH_IMG, computed: HASH_IMG },
  },
  {
    id: 'GT-2026-000342',
    parcelaId: 'par-04',
    parcela: 'La Esperanza · 04',
    embarque: 'emb-2026-018',
    emitido: '2026-07-02',
    vigenciaHasta: '2027-04-02',
    estado: 'vigente',
    assetId: 'BuU5wO9qM2nC6bZ0eG3hI7kL1vT4fJ8pR2xSdY6aWcNr',
    tx: '8HgF2dS6aP0oI4uY7tR1eW5qZ9xC3vB6nM8kJ2lQ4wEt',
    hashPdf: { onchain: HASH_PDF, computed: HASH_PDF },
    hashImg: { onchain: HASH_IMG, computed: HASH_IMG },
  },
  {
    id: 'GT-2025-000287',
    parcelaId: 'par-03',
    parcela: 'Alto Verde · 01',
    embarque: 'emb-2025-011',
    emitido: '2025-10-14',
    vigenciaHasta: '2026-07-14',
    estado: 'revocado',
    revocado: '2026-01-20',
    motivoRevocacion: 'Anomalía de telemetría confirmada en inspección',
    assetId: 'CvV6xP0rN3oD7cA1fH4iJ8lM2wU5gK9qS3ySeZ7bXdOt',
    tx: '9QaZ3wS7xE1dC5rF8vT2gB6yH0nU4jM7kI1lO5pP9aSd',
    hashPdf: { onchain: HASH_PDF, computed: HASH_PDF },
    hashImg: { onchain: HASH_IMG, computed: HASH_IMG },
  },
];

export const TEAM: { members: Miembro[]; subroles: SubRol[] } = {
  members: [
    { id: 'u-demo-lucia', nombre: 'Lucía Fernández', email: 'lucia@sierraverde.coop', subRol: 'Dirección' },
    { id: 'u-demo-tomas', nombre: 'Tomás Rivas', email: 'tomas@sierraverde.coop', subRol: 'Logística' },
    { id: 'u-demo-ines', nombre: 'Inés Castillo', email: 'ines@sierraverde.coop', subRol: 'Campo' },
  ],
  subroles: [
    {
      id: 'sr-1',
      nombre: 'Dirección',
      privileges: [
        'unidad.configurar', 'equipo.gestionar', 'agricultores.gestionar', 'topologia.gestionar',
        'telemetria.ver', 'tesoreria.ver', 'embarques.preparar', 'certificados.emitir',
        'certificados.revocar', 'certificados.ver',
      ],
      enUso: 1,
    },
    {
      id: 'sr-2',
      nombre: 'Logística',
      privileges: ['embarques.preparar', 'certificados.ver', 'topologia.gestionar', 'telemetria.ver'],
      enUso: 1,
    },
    {
      id: 'sr-3',
      nombre: 'Campo',
      privileges: ['topologia.gestionar', 'telemetria.ver', 'agricultores.gestionar'],
      enUso: 1,
    },
  ],
};

export const FARMERS: Agricultor[] = [
  { id: 'agr-1', nombre: 'Pedro Ayala', email: 'pedro.ayala@correo.hn', finca: 'La Esperanza', parcelas: 2 },
  { id: 'agr-2', nombre: 'Rosa Méndez', email: 'rosa.mendez@correo.hn', finca: 'El Mirador', parcelas: 1 },
  { id: 'agr-3', nombre: 'Elías Cruz', email: 'elias.cruz@correo.hn', finca: 'Alto Verde', parcelas: 1 },
  { id: 'agr-4', nombre: 'Marta Solís', email: 'marta.solis@correo.hn', finca: 'Santa Rita', parcelas: 1 },
];

// Parámetros vigentes del sistema (los define el ADMIN; el operador solo los consume).
export const PRICING = { certificacionUsdc: 5, manifiestoUsdc: 2 };

// Regla provisional de cobertura: 1 sonda por cada 2 ha (parámetro del ADMIN).
export const HA_POR_SENSOR = 2;

export const CROPS = ['cafe', 'cacao', 'aguacate'];

export const UNIT_PROFILE: Unidad & Record<string, unknown> = {
  nombre: 'Coop. Sierra Verde',
  pais: 'Honduras',
  idiomaDefecto: 'es',
};
