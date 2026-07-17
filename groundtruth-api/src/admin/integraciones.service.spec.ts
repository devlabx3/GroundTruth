import { describe, it, expect, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { DbService } from '@/db/db.service';
import type { SolanaService } from '@/solana/solana.service';
import type { SentinelService } from '@/evidencia/sentinel.service';
import type { ArweaveService } from '@/evidencia/arweave.service';
import type { StorageService } from '@/evidencia/storage.service';
import { AdminIntegracionesService } from './integraciones.service';

describe('AdminIntegracionesService', () => {
  describe('checkIrys', () => {
    const createService = (opts: {
      arweaveEnabled: boolean;
      solanaBalance: number | null;
    }) => {
      const mockDb = {} as DbService;
      const mockConfig = { get: vi.fn() } as unknown as ConfigService;
      const mockSentinel = {} as SentinelService;
      const mockArweave = {
        isEnabled: vi.fn().mockReturnValue(opts.arweaveEnabled),
      } as unknown as ArweaveService;
      const mockStorage = {} as StorageService;
      const mockSolana = {
        saldoSolLamports: vi.fn().mockResolvedValue(opts.solanaBalance),
      } as unknown as SolanaService;

      const service = new AdminIntegracionesService(
        mockDb,
        mockConfig,
        mockSentinel,
        mockArweave,
        mockStorage,
        mockSolana,
      );

      return { service, mockArweave, mockSolana };
    };

    it('retorna no_configurado cuando Arweave no está habilitado', async () => {
      const { service } = createService({ arweaveEnabled: false, solanaBalance: 5_000_000_000 });
      const result = await (service as any).checkIrys();
      expect(result.estado).toBe('no_configurado');
    });

    it('retorna no_configurado cuando saldoSolLamports es null', async () => {
      const { service } = createService({ arweaveEnabled: true, solanaBalance: null });
      const result = await (service as any).checkIrys();
      expect(result.estado).toBe('no_configurado');
    });

    it('retorna warn cuando el balance está por debajo de 0.1 SOL', async () => {
      const { service } = createService({ arweaveEnabled: true, solanaBalance: 50_000_000 }); // 0.05 SOL
      const result = await (service as any).checkIrys();
      expect(result.estado).toBe('warn');
    });

    it('retorna ok cuando el balance está en 0.1 SOL o superior', async () => {
      const { service } = createService({ arweaveEnabled: true, solanaBalance: 100_000_000 }); // 0.1 SOL
      const result = await (service as any).checkIrys();
      expect(result.estado).toBe('ok');
    });

    it('retorna ok cuando el balance es alto', async () => {
      const { service } = createService({ arweaveEnabled: true, solanaBalance: 5_000_000_000 }); // 5 SOL
      const result = await (service as any).checkIrys();
      expect(result.estado).toBe('ok');
    });

    it('incluye el nombre correcto en la respuesta', async () => {
      const { service } = createService({ arweaveEnabled: true, solanaBalance: 100_000_000 });
      const result = await (service as any).checkIrys();
      expect(result.nombre).toContain('Irys');
      expect(result.nombre).toContain('Arweave');
    });

    it('retorna latenciaMs: null', async () => {
      const { service } = createService({ arweaveEnabled: true, solanaBalance: 100_000_000 });
      const result = await (service as any).checkIrys();
      expect(result.latenciaMs).toBeNull();
    });
  });
});
