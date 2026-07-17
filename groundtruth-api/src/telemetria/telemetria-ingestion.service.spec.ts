import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbService, Tx } from '@/db/db.service';
import { TelemetriaIngestionService, type LecturaResuelta } from './telemetria-ingestion.service';

describe('TelemetriaIngestionService', () => {
  const createService = () => {
    const mockDb = {
      queryOne: vi.fn(),
      transaction: vi.fn(),
    } as unknown as DbService;
    const service = new TelemetriaIngestionService(mockDb);
    return { service, mockDb };
  };

  /**
   * Construye un Tx mock cuyas queries responden por contenido SQL:
   * - select parcelas → parcela (cultivo, agricultor, ultimo_estado)
   * - select umbrales_eudr → filas de umbrales
   * - insert lecturas_telemetria → { id }
   * - insert alertas → captura
   */
  const makeTx = (opts: {
    parcela?: { cultivo_id: string; agricultor_id: string; ultimo_estado: string | null } | null;
    umbrales?: Array<{ variable: string; valor_min: number; valor_max: number }>;
  }) => {
    const inserts: { lecturas: any[][]; alertas: any[][] } = { lecturas: [], alertas: [] };
    let lecturaSeq = 0;

    const tx = {
      queryOne: vi.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('from parcelas')) {
          return opts.parcela === undefined
            ? { cultivo_id: 'cult-1', agricultor_id: 'agri-1', ultimo_estado: null }
            : opts.parcela;
        }
        if (sql.includes('insert into lecturas_telemetria')) {
          inserts.lecturas.push(params as any[]);
          return { id: `lect-${++lecturaSeq}` };
        }
        return null;
      }),
      query: vi.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('from umbrales_eudr')) {
          return (
            opts.umbrales ?? [
              { variable: 'ph', valor_min: 5.5, valor_max: 6.8 },
              { variable: 'humedad_suelo_pct', valor_min: 35, valor_max: 60 },
            ]
          );
        }
        if (sql.includes('insert into alertas')) {
          inserts.alertas.push(params as any[]);
          return [];
        }
        return [];
      }),
    } as unknown as Tx;

    return { tx, inserts };
  };

  const lectura = (valores: LecturaResuelta['valores'], over: Partial<LecturaResuelta> = {}): LecturaResuelta => ({
    nodoId: 'nodo-1',
    parcelaId: 'parc-1',
    ts: new Date('2026-07-10T09:30:00Z'),
    firma: null,
    valores,
    ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  it('inserta en lecturas_telemetria con las columnas y firma_hex', async () => {
    const { service } = createService();
    const { tx, inserts } = makeTx({});

    await service.ingestarEnTx(tx, [
      lectura({ ph: 6.0, humedad_suelo_pct: 45, ec_us_cm: 950 }, { firma: 'deadbeef' }),
    ]);

    expect(inserts.lecturas).toHaveLength(1);
    const params = inserts.lecturas[0];
    // (nodo_id, parcela_id, ts, ph, ec, humedad, temp1, temp2, firma_hex, estado)
    expect(params[0]).toBe('nodo-1');
    expect(params[1]).toBe('parc-1');
    expect(params[3]).toBe('6.00'); // ph a 2 decimales
    expect(params[8]).toBe('deadbeef'); // firma_hex
    expect(params[9]).toBe('VERDE');
  });

  it('evalúa ROJO cuando ph sale del umbral', async () => {
    const { service } = createService();
    const { tx } = makeTx({});

    const { resultados, rojas } = await service.ingestarEnTx(tx, [
      lectura({ ph: 4.0, humedad_suelo_pct: 45 }), // ph < 5.5 → ROJO
    ]);

    expect(resultados[0].estado).toBe('ROJO');
    expect(rojas).toBe(1);
  });

  it('evalúa VERDE cuando ph y humedad están dentro', async () => {
    const { service } = createService();
    const { tx } = makeTx({});

    const { resultados, rojas } = await service.ingestarEnTx(tx, [
      lectura({ ph: 6.0, humedad_suelo_pct: 50 }),
    ]);

    expect(resultados[0].estado).toBe('VERDE');
    expect(rojas).toBe(0);
  });

  it('un valor ausente no dispara ROJO', async () => {
    const { service } = createService();
    const { tx } = makeTx({});

    const { resultados } = await service.ingestarEnTx(tx, [
      lectura({ ec_us_cm: 950 }), // sin ph ni humedad
    ]);

    expect(resultados[0].estado).toBe('VERDE');
  });

  it('levanta UNA alerta en la transición a ROJO (parcela estaba VERDE/null)', async () => {
    const { service } = createService();
    const { tx, inserts } = makeTx({
      parcela: { cultivo_id: 'cult-1', agricultor_id: 'agri-1', ultimo_estado: null },
    });

    await service.ingestarEnTx(tx, [
      lectura({ ph: 4.0, humedad_suelo_pct: 45 }),
      lectura({ ph: 4.1, humedad_suelo_pct: 44 }),
    ]);

    expect(inserts.alertas).toHaveLength(1);
    const alerta = inserts.alertas[0];
    expect(alerta[1]).toBe('agri-1');
    expect(alerta[2]).toBe('ph'); // variable de la brecha
  });

  it('NO levanta alerta si la parcela ya estaba ROJO (dedup)', async () => {
    const { service } = createService();
    const { tx, inserts } = makeTx({
      parcela: { cultivo_id: 'cult-1', agricultor_id: 'agri-1', ultimo_estado: 'ROJO' },
    });

    await service.ingestarEnTx(tx, [lectura({ ph: 4.0, humedad_suelo_pct: 45 })]);

    expect(inserts.alertas).toHaveLength(0);
  });

  it('NO levanta alerta si todo es VERDE', async () => {
    const { service } = createService();
    const { tx, inserts } = makeTx({});

    await service.ingestarEnTx(tx, [lectura({ ph: 6.0, humedad_suelo_pct: 50 })]);

    expect(inserts.alertas).toHaveLength(0);
  });

  it('parcela inexistente → notFound', async () => {
    const { service } = createService();
    const { tx } = makeTx({ parcela: null });

    await expect(service.ingestarEnTx(tx, [lectura({ ph: 6.0 })])).rejects.toThrow();
  });

  it('carga umbrales una sola vez por parcela en un lote', async () => {
    const { service } = createService();
    const { tx } = makeTx({});

    await service.ingestarEnTx(tx, [
      lectura({ ph: 6.0, humedad_suelo_pct: 50 }),
      lectura({ ph: 6.1, humedad_suelo_pct: 51 }),
      lectura({ ph: 6.2, humedad_suelo_pct: 52 }),
    ]);

    const umbralCalls = (tx.query as any).mock.calls.filter((c: any[]) =>
      c[0].includes('from umbrales_eudr'),
    );
    expect(umbralCalls).toHaveLength(1);
  });

  describe('ingest (camino público)', () => {
    it('resuelve el nodo por node_id y persiste', async () => {
      const { service, mockDb } = createService();
      const { tx } = makeTx({});

      (mockDb.queryOne as any).mockResolvedValue({ id: 'nodo-9', parcela_id: 'parc-9' });
      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      const res = await service.ingest({
        node_id: 'GT-NODO-0001',
        ts: '2026-07-10T09:30:00Z',
        lecturas: { ph: 6.0, humedad_suelo_pct: 50 },
      });

      expect(res.estado).toBe('VERDE');
      expect(res.id).toMatch(/^lect-/);
    });

    it('nodo inexistente → notFound', async () => {
      const { service, mockDb } = createService();
      (mockDb.queryOne as any).mockResolvedValue(null);

      await expect(
        service.ingest({ node_id: 'desconocido', lecturas: { ph: 6.0 } }),
      ).rejects.toThrow();
    });

    it('rechaza payload sin node_id', async () => {
      const { service } = createService();
      await expect(service.ingest({ lecturas: { ph: 6.0 } })).rejects.toThrow();
    });

    it('rechaza ph fuera de rango físico (>14)', async () => {
      const { service } = createService();
      await expect(
        service.ingest({ node_id: 'n', lecturas: { ph: 99 } }),
      ).rejects.toThrow();
    });
  });
});
