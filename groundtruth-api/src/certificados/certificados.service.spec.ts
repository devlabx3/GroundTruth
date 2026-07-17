import { describe, it, expect, vi } from 'vitest';
import type { DbService } from '@/db/db.service';
import { CertificadosService } from './certificados.service';

describe('CertificadosService', () => {
  describe('expirarVencidos', () => {
    const createService = () => {
      const mockDb = {
        query: vi.fn().mockResolvedValue(undefined),
        queryOne: vi.fn(),
        transaction: vi.fn(),
      } as unknown as DbService;

      const service = new CertificadosService(mockDb);
      return { service, mockDb };
    };

    it('ejecuta una query UPDATE que pasa certificados ACTIVE vencidos a EXPIRED', async () => {
      const { service, mockDb } = createService();
      await service.expirarVencidos();

      expect(mockDb.query).toHaveBeenCalled();
      const callArgs = (mockDb.query as any).mock.calls[0];
      const sql = callArgs[0] as string;

      expect(sql).toContain("update certificados");
      expect(sql).toContain("set estado = 'EXPIRED'");
      expect(sql).toContain("where estado = 'ACTIVE'");
      expect(sql).toContain("vigente_hasta < now()");
    });

    it('solo afecta certificados en estado ACTIVE', async () => {
      const { service, mockDb } = createService();
      await service.expirarVencidos();

      const sql = (mockDb.query as any).mock.calls[0][0] as string;
      expect(sql).toContain("estado = 'ACTIVE'");
    });

    it('solo afecta certificados cuya vigencia ya pasó', async () => {
      const { service, mockDb } = createService();
      await service.expirarVencidos();

      const sql = (mockDb.query as any).mock.calls[0][0] as string;
      expect(sql).toContain("vigente_hasta < now()");
    });

    it('no lanza excepción si ningún certificado se expira', async () => {
      const { service, mockDb } = createService();
      (mockDb.query as any).mockResolvedValue(undefined);

      await expect(service.expirarVencidos()).resolves.toBeUndefined();
    });

    it('se ejecuta sin parámetros dinámicos', async () => {
      const { service, mockDb } = createService();
      await service.expirarVencidos();

      const callArgs = (mockDb.query as any).mock.calls[0];
      // callArgs[1] debe ser undefined (sin parámetros) o no pasarse
      expect(callArgs[1]).toBeUndefined();
    });
  });
});
