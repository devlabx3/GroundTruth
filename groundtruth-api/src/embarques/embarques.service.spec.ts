import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbService, Tx } from '@/db/db.service';
import { EmbarquesService } from './embarques.service';

describe('EmbarquesService', () => {
  describe('create', () => {
    const createService = () => {
      const mockDb = {
        transaction: vi.fn(),
      } as unknown as DbService;

      const service = new EmbarquesService(mockDb, null as any, null as any);
      return { service, mockDb };
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('crea embarque con estado BORRADOR si usuario tiene certificados.emitir', async () => {
      const { service, mockDb } = createService();

      const tx = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'parc-123',
            cultivo_id: 'cult-123',
            cultivo: 'Tomate',
            ciclo_id: 'ciclo-123',
            ultimo_estado: 'VERDE',
          },
        ]),
        queryOne: vi.fn().mockResolvedValue({ id: 'some-id' }),
      } as unknown as Tx;

      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      await service.create(
        'op-123',
        'user-123',
        {
          parcelaIds: ['550e8400-e29b-41d4-a716-446655440000'],
        },
        ['embarques.preparar', 'certificados.emitir'],
      );

      const insertCall = (tx.queryOne as any).mock.calls.find((call: any[]) =>
        call[0].includes('insert into embarques'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][2]).toBe('BORRADOR');
    });

    it('crea embarque con estado LISTO_APROBACION si usuario no tiene certificados.emitir', async () => {
      const { service, mockDb } = createService();

      const tx = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'parc-123',
            cultivo_id: 'cult-123',
            cultivo: 'Tomate',
            ciclo_id: 'ciclo-123',
            ultimo_estado: 'VERDE',
          },
        ]),
        queryOne: vi.fn().mockResolvedValue({ id: 'some-id' }),
      } as unknown as Tx;

      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      await service.create(
        'op-123',
        'user-123',
        {
          parcelaIds: ['550e8400-e29b-41d4-a716-446655440000'],
        },
        ['embarques.preparar'],
      );

      const insertCall = (tx.queryOne as any).mock.calls.find((call: any[]) =>
        call[0].includes('insert into embarques'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][2]).toBe('LISTO_APROBACION');
    });

    it('usa estado LISTO_APROBACION por defecto sin privileges', async () => {
      const { service, mockDb } = createService();

      const tx = {
        query: vi.fn().mockResolvedValue([
          {
            id: 'parc-123',
            cultivo_id: 'cult-123',
            cultivo: 'Tomate',
            ciclo_id: 'ciclo-123',
            ultimo_estado: 'VERDE',
          },
        ]),
        queryOne: vi.fn().mockResolvedValue({ id: 'some-id' }),
      } as unknown as Tx;

      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      await service.create('op-123', 'user-123', {
        parcelaIds: ['550e8400-e29b-41d4-a716-446655440000'],
      });

      const insertCall = (tx.queryOne as any).mock.calls.find((call: any[]) =>
        call[0].includes('insert into embarques'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall[1][2]).toBe('LISTO_APROBACION');
    });

    it('rechaza si no hay parcelas encontradas', async () => {
      const { service, mockDb } = createService();

      const tx = {
        query: vi.fn().mockResolvedValue([]),
      } as unknown as Tx;

      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      await expect(
        service.create(
          'op-123',
          'user-123',
          {
            parcelaIds: ['550e8400-e29b-41d4-a716-446655440000'],
          },
          ['embarques.preparar', 'certificados.emitir'],
        ),
      ).rejects.toThrow();
    });

    it('valida parcelaIds con UUIDs', async () => {
      const { service } = createService();

      await expect(
        service.create(
          'op-123',
          'user-123',
          {
            parcelaIds: ['not-a-uuid'],
          },
          ['embarques.preparar'],
        ),
      ).rejects.toThrow();
    });

    it('rechaza lista vacía de parcelaIds', async () => {
      const { service } = createService();

      await expect(
        service.create(
          'op-123',
          'user-123',
          {
            parcelaIds: [],
          },
          ['embarques.preparar'],
        ),
      ).rejects.toThrow();
    });
  });
});
