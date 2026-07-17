import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { TelemetriaIngestionService } from './telemetria-ingestion.service';
import { TelemetriaController } from './telemetria.controller';

describe('TelemetriaController', () => {
  const createController = (secret?: string) => {
    const config = { get: vi.fn(() => secret) } as unknown as ConfigService;
    const ingesta = {
      ingest: vi.fn().mockResolvedValue({ id: 'lect-1', estado: 'VERDE' }),
    } as unknown as TelemetriaIngestionService;
    const controller = new TelemetriaController(config, ingesta);
    return { controller, ingesta };
  };

  const payload = { node_id: 'GT-NODO-0001', lecturas: { ph: 6.0 } };

  beforeEach(() => vi.clearAllMocks());

  it('sin TELEMETRIA_INGEST_SECRET configurado → endpoint cerrado (Forbidden)', async () => {
    const { controller } = createController(undefined);
    await expect(controller.ingest('cualquier-cosa', payload)).rejects.toThrow(ForbiddenException);
  });

  it('sin header authorization → Forbidden', async () => {
    const { controller } = createController('secreto');
    await expect(controller.ingest(undefined, payload)).rejects.toThrow(ForbiddenException);
  });

  it('secreto incorrecto → Forbidden', async () => {
    const { controller } = createController('secreto-correcto');
    await expect(controller.ingest('secreto-erroneo', payload)).rejects.toThrow(ForbiddenException);
  });

  it('secreto correcto → delega en ingest()', async () => {
    const { controller, ingesta } = createController('secreto-correcto');
    const res = await controller.ingest('secreto-correcto', payload);
    expect(ingesta.ingest).toHaveBeenCalledWith(payload);
    expect(res).toEqual({ id: 'lect-1', estado: 'VERDE' });
  });
});
