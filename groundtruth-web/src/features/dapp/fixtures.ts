/**
 * Fixtures del Agricultor (modo maqueta). Pedro Ayala (finca La Esperanza)
 * ve SOLO sus parcelas — coherente con features/dashboard/fixtures.js.
 * Al existir el backend: GET /farmer/parcelas + alertas por Supabase Realtime.
 */

import type { AlertaAgricultor, ParcelaAgricultorDetalle } from '@/types/api';

export const FARMER_ALERTS: AlertaAgricultor[] = [
  {
    id: 'al-101',
    parcelaId: 'par-01',
    parcela: 'La Esperanza · 03',
    variable: 'Humedad',
    valor: '28 %',
    umbral: '35–60 %',
    fecha: '2026-07-11T06:40:00Z',
  },
];

export const FARMER_PARCELS: ParcelaAgricultorDetalle[] = [
  {
    id: 'par-01',
    nombre: 'La Esperanza · 03',
    cultivo: 'cafe',
    areaHa: 4.2,
    estado: 'conforme',
    filled: 4,
    certificada: true,
    ciclos: [
      { id: 'c-011', inicio: '2025-11-02', fin: null, certificado: true },
      { id: 'c-010', inicio: '2025-03-10', fin: '2025-10-28', certificado: true },
    ],
  },
  {
    id: 'par-04',
    nombre: 'La Esperanza · 04',
    cultivo: 'cafe',
    areaHa: 2.8,
    estado: 'conforme',
    filled: 3,
    certificada: false,
    ciclos: [{ id: 'c-041', inicio: '2025-11-20', fin: null, certificado: false }],
  },
];
