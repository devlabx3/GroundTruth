import { describe, it, expect, vi } from 'vitest';
import type { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';
import { AgricultoresService } from './agricultores.service';

const UUID_AGRICULTORN = '550e8400-e29b-41d4-a716-446655440000';
const UUID_AGRICULTOR_INVALID = 'not-a-uuid';

describe('AgricultoresService', () => {
  describe('reasignarFinca', () => {
    const createService = (opts: { fincaExists?: boolean; usuarioExists?: boolean } = {}) => {
      const fincaExists = opts.fincaExists !== false;
      const usuarioExists = opts.usuarioExists !== false;

      const tx = {
        queryOne: vi.fn((sql: string) => {
          if (sql.includes('from fincas where')) {
            return Promise.resolve(fincaExists ? { id: '550e8400-e29b-41d4-a716-446655440001' } : null);
          }
          if (sql.includes('from usuarios where')) {
            return Promise.resolve(usuarioExists ? { id: UUID_AGRICULTORN } : null);
          }
          return Promise.resolve(null);
        }),
        query: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        transaction: vi.fn().mockImplementation(async (fn) => fn(tx)),
      } as unknown as DbService;

      const service = new AgricultoresService(mockDb);
      return { service, mockDb, tx };
    };

    it('lanza notFound si la finca no existe o no pertenece al operador', async () => {
      const { service } = createService({ fincaExists: false, usuarioExists: true });
      await expect(
        service.reasignarFinca('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', { agricultorId: UUID_AGRICULTORN }),
      ).rejects.toThrow();
    });

    it('lanza notFound si el agricultor destino no existe', async () => {
      const { service } = createService({ fincaExists: true, usuarioExists: false });
      await expect(
        service.reasignarFinca('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', { agricultorId: UUID_AGRICULTORN }),
      ).rejects.toThrow();
    });

    it('reasigna la finca al nuevo agricultor', async () => {
      const { service, tx } = createService();
      await service.reasignarFinca('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', {
        agricultorId: UUID_AGRICULTORN,
      });

      const updateCall = (tx.query as any).mock.calls.find((call: any) =>
        call[0].includes('update fincas'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall[0]).toContain("set agricultor_id = $1");
    });

    it('registra la acción en auditoría', async () => {
      const { service, tx } = createService();
      await service.reasignarFinca('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', {
        agricultorId: UUID_AGRICULTORN,
      });

      const auditCall = (tx.query as any).mock.calls.find((call: any) =>
        call[0].includes('insert into auditoria'),
      );
      expect(auditCall).toBeDefined();
      expect(auditCall[0]).toContain("'finca.reasignar'");
    });

    it('valida que agricultorId sea un UUID válido', async () => {
      const { service } = createService();
      await expect(
        service.reasignarFinca('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', { agricultorId: UUID_AGRICULTOR_INVALID }),
      ).rejects.toThrow();
    });

    it('devuelve el fincaId y agricultorId reasignado', async () => {
      const { service } = createService();
      const result = await service.reasignarFinca('550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', {
        agricultorId: UUID_AGRICULTORN,
      });

      expect(result.agricultorId).toEqual(UUID_AGRICULTORN);
    });
  });
});
