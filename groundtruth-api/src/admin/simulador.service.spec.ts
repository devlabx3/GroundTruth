import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbService, Tx } from '@/db/db.service';
import type { TelemetriaIngestionService } from '@/telemetria/telemetria-ingestion.service';
import { AdminSimuladorService } from './simulador.service';

describe('AdminSimuladorService.generar', () => {
  const createService = () => {
    const mockDb = { transaction: vi.fn() } as unknown as DbService;
    const mockIngesta = { ingestarEnTx: vi.fn() } as unknown as TelemetriaIngestionService;
    const service = new AdminSimuladorService(mockDb, mockIngesta);
    return { service, mockDb, mockIngesta };
  };

  const makeTx = (nodos: Array<{ id: string }>) => {
    const tx = {
      queryOne: vi.fn().mockResolvedValue({ cultivo_id: 'cult-1' }),
      query: vi.fn(async (sql: string) => {
        if (sql.includes('from nodos_sensores')) return nodos;
        if (sql.includes('from umbrales_eudr')) {
          return [
            { variable: 'ph', valor_min: 5.5, valor_max: 6.8 },
            { variable: 'humedad_suelo_pct', valor_min: 35, valor_max: 60 },
          ];
        }
        return [];
      }),
    } as unknown as Tx;
    return tx;
  };

  beforeEach(() => vi.clearAllMocks());

  it('delega la persistencia en ingestarEnTx (ya no hace INSERT crudo de lecturas)', async () => {
    const { service, mockDb, mockIngesta } = createService();
    const tx = makeTx([{ id: 'nodo-1' }]);
    (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));
    (mockIngesta.ingestarEnTx as any).mockResolvedValue({
      resultados: Array.from({ length: 24 }, (_, i) => ({ id: `l${i}`, parcelaId: 'p', estado: 'VERDE' })),
      rojas: 0,
    });

    await service.generar('actor-1', {
      parcelaId: '550e8400-e29b-41d4-a716-446655440000',
      perfil: 'sano',
      horas: 24,
    });

    // No hay INSERT directo en lecturas_telemetria dentro del simulador.
    const insertLecturas = (tx.query as any).mock.calls.filter((c: any[]) =>
      c[0].includes('insert into lecturas_telemetria'),
    );
    expect(insertLecturas).toHaveLength(0);
    expect(mockIngesta.ingestarEnTx).toHaveBeenCalledTimes(1);
  });

  it('genera nodos×horas lecturas y las pasa a ingestarEnTx', async () => {
    const { service, mockDb, mockIngesta } = createService();
    const tx = makeTx([{ id: 'nodo-1' }, { id: 'nodo-2' }]);
    (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));
    (mockIngesta.ingestarEnTx as any).mockResolvedValue({ resultados: [], rojas: 0 });

    await service.generar('actor-1', {
      parcelaId: '550e8400-e29b-41d4-a716-446655440000',
      perfil: 'sano',
      horas: 3,
    });

    const readings = (mockIngesta.ingestarEnTx as any).mock.calls[0][1];
    expect(readings).toHaveLength(2 * 3); // 2 nodos × 3 horas
    // Todas las lecturas simuladas llegan sin firmar.
    expect(readings.every((r: any) => r.firma === null)).toBe(true);
    expect(readings.every((r: any) => r.valores.ph != null)).toBe(true);
  });

  it('solo consulta nodos SIMULADO activos', async () => {
    const { service, mockDb, mockIngesta } = createService();
    const tx = makeTx([{ id: 'nodo-1' }]);
    (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));
    (mockIngesta.ingestarEnTx as any).mockResolvedValue({ resultados: [], rojas: 0 });

    await service.generar('actor-1', {
      parcelaId: '550e8400-e29b-41d4-a716-446655440000',
      perfil: 'sano',
      horas: 1,
    });

    const nodosQuery = (tx.query as any).mock.calls.find((c: any[]) =>
      c[0].includes('from nodos_sensores'),
    );
    expect(nodosQuery[0]).toContain("tipo_nodo = 'SIMULADO'");
  });

  it('preserva el retorno { parcelaId, perfil, lecturas, estado }', async () => {
    const { service, mockDb, mockIngesta } = createService();
    const tx = makeTx([{ id: 'nodo-1' }]);
    (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));
    (mockIngesta.ingestarEnTx as any).mockResolvedValue({
      resultados: [{ id: 'l1', parcelaId: 'p', estado: 'ROJO' }],
      rojas: 1,
    });

    const res = await service.generar('actor-1', {
      parcelaId: '550e8400-e29b-41d4-a716-446655440000',
      perfil: 'degradado',
      horas: 1,
    });

    expect(res).toEqual({
      parcelaId: '550e8400-e29b-41d4-a716-446655440000',
      perfil: 'degradado',
      lecturas: 1,
      estado: 'alerta',
    });
  });

  it('escribe auditoría simulador.generar', async () => {
    const { service, mockDb, mockIngesta } = createService();
    const tx = makeTx([{ id: 'nodo-1' }]);
    (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));
    (mockIngesta.ingestarEnTx as any).mockResolvedValue({ resultados: [], rojas: 0 });

    await service.generar('actor-1', {
      parcelaId: '550e8400-e29b-41d4-a716-446655440000',
      perfil: 'sano',
      horas: 1,
    });

    const audit = (tx.query as any).mock.calls.find((c: any[]) =>
      c[0].includes('insert into auditoria'),
    );
    expect(audit[0]).toContain("'simulador.generar'");
    expect(audit[1][0]).toBe('actor-1');
  });

  it('sin nodos SIMULADO activos → sensorCoverageUnmet', async () => {
    const { service, mockDb } = createService();
    const tx = makeTx([]); // ningún nodo
    (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

    await expect(
      service.generar('actor-1', {
        parcelaId: '550e8400-e29b-41d4-a716-446655440000',
        perfil: 'sano',
        horas: 1,
      }),
    ).rejects.toThrow();
  });
});
