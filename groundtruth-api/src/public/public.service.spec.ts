import { describe, it, expect, vi } from 'vitest';
import type { DbService } from '@/db/db.service';
import { PublicService } from './public.service';

describe('PublicService', () => {
  describe('crearContacto', () => {
    const createService = () => {
      const mockDb = {
        queryOne: vi.fn().mockResolvedValue({ id: 'contacto-123' }),
      } as unknown as DbService;

      const service = new PublicService(mockDb);
      return { service, mockDb };
    };

    it('crea un contacto con nombre, email y mensaje válidos', async () => {
      const { service, mockDb } = createService();
      const result = await service.crearContacto({
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        mensaje: 'Me interesa conocer más sobre GroundTruth.',
      });

      expect(result.id).toBe('contacto-123');
      expect(mockDb.queryOne).toHaveBeenCalled();
    });

    it('valida que nombre no esté vacío', async () => {
      const { service } = createService();
      await expect(
        service.crearContacto({
          nombre: '',
          email: 'juan@example.com',
          mensaje: 'Mensaje',
        }),
      ).rejects.toThrow();
    });

    it('valida que email sea válido', async () => {
      const { service } = createService();
      await expect(
        service.crearContacto({
          nombre: 'Juan',
          email: 'not-an-email',
          mensaje: 'Mensaje',
        }),
      ).rejects.toThrow();
    });

    it('valida que mensaje no esté vacío', async () => {
      const { service } = createService();
      await expect(
        service.crearContacto({
          nombre: 'Juan',
          email: 'juan@example.com',
          mensaje: '',
        }),
      ).rejects.toThrow();
    });

    it('valida límite máximo de nombre (200 caracteres)', async () => {
      const { service } = createService();
      const longName = 'a'.repeat(201);
      await expect(
        service.crearContacto({
          nombre: longName,
          email: 'juan@example.com',
          mensaje: 'Mensaje',
        }),
      ).rejects.toThrow();
    });

    it('valida límite máximo de mensaje (5000 caracteres)', async () => {
      const { service } = createService();
      const longMessage = 'a'.repeat(5001);
      await expect(
        service.crearContacto({
          nombre: 'Juan',
          email: 'juan@example.com',
          mensaje: longMessage,
        }),
      ).rejects.toThrow();
    });

    it('inserta en la tabla contactos con parámetros correctos', async () => {
      const { service, mockDb } = createService();
      await service.crearContacto({
        nombre: 'Juan Pérez',
        email: 'juan@example.com',
        mensaje: 'Test message',
      });

      const call = (mockDb.queryOne as any).mock.calls[0];
      expect(call[0]).toContain('insert into contactos');
      expect(call[1]).toEqual(['Juan Pérez', 'juan@example.com', 'Test message']);
    });
  });
});
