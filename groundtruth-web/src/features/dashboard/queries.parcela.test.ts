import { describe, it, expect } from 'vitest';
import { mapParcelaDetalle } from './queries';
import type { ApiParcelaDetalle } from './queries';

describe('mapParcelaDetalle', () => {
  const baseApiParcela: Omit<ApiParcelaDetalle, 'fuente_simulada'> = {
    id: 'p1',
    nombre: 'Test Parcel',
    finca: 'Test Farm',
    cultivo: 'cafe',
    area_ha: '2.5',
    sensores: '3',
    ultimo_estado: 'VERDE',
    centro_lat: '14.5',
    centro_lng: '-88.0',
    telemetria: {
      estado_evaluado: 'VERDE',
      ph: '6.5',
      ec_us_cm: '150',
      humedad_suelo_pct: '45',
      temp_suelo_prof1_c: '22',
      temp_suelo_prof2_c: '20',
    },
    ciclos: [
      {
        id: 'c1',
        fecha_inicio: '2026-01-01',
        fecha_cierre: null,
        certificado: false,
      },
    ],
  };

  it('maps fuenteSimulada to true when fuente_simulada is true', () => {
    const apiData: ApiParcelaDetalle = {
      ...baseApiParcela,
      fuente_simulada: true,
    };
    const result = mapParcelaDetalle(apiData);
    expect(result.fuenteSimulada).toBe(true);
  });

  it('maps fuenteSimulada to false when fuente_simulada is false', () => {
    const apiData: ApiParcelaDetalle = {
      ...baseApiParcela,
      fuente_simulada: false,
    };
    const result = mapParcelaDetalle(apiData);
    expect(result.fuenteSimulada).toBe(false);
  });

  it('maps fuenteSimulada to false when fuente_simulada is absent', () => {
    const apiData: ApiParcelaDetalle = {
      ...baseApiParcela,
    };
    const result = mapParcelaDetalle(apiData);
    expect(result.fuenteSimulada).toBe(false);
  });

  it('maps fuenteSimulada to false when fuente_simulada is null', () => {
    const apiData: ApiParcelaDetalle = {
      ...baseApiParcela,
      fuente_simulada: null,
    };
    const result = mapParcelaDetalle(apiData);
    expect(result.fuenteSimulada).toBe(false);
  });

  it('preserves other parcela fields alongside fuenteSimulada', () => {
    const apiData: ApiParcelaDetalle = {
      ...baseApiParcela,
      fuente_simulada: true,
    };
    const result = mapParcelaDetalle(apiData);
    expect(result.id).toBe('p1');
    expect(result.nombre).toBe('Test Parcel');
    expect(result.finca).toBe('Test Farm');
    expect(result.cultivo).toBe('cafe');
    expect(result.areaHa).toBe(2.5);
    expect(result.sensores).toBe(3);
    expect(result.fuenteSimulada).toBe(true);
  });
});
