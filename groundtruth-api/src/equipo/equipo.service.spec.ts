import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DbService } from '@/db/db.service';
import { SupabaseAuthService } from '@/auth/supabase-auth.service';
import { EquipoService } from './equipo.service';

describe('EquipoService', () => {
  describe('invitarMiembro', () => {
    const createService = () => {
      const mockDb = {
        transaction: vi.fn(),
      } as unknown as DbService;

      const mockSupabaseAuth = {
        invitar: vi.fn(),
      } as unknown as SupabaseAuthService;

      const service = new EquipoService(mockDb, mockSupabaseAuth);
      return { service, mockDb, mockSupabaseAuth };
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('rechaza si el subRol no existe', async () => {
      const { service, mockDb, mockSupabaseAuth } = createService();

      const tx = {
        queryOne: vi.fn().mockResolvedValue(null),
      };
      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      await expect(
        service.invitarMiembro('operador-123', 'actor-123', {
          nombre: 'Juan',
          email: 'juan@example.com',
          subRolId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      ).rejects.toThrow();

      expect(tx.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('select id from sub_roles'),
        ['550e8400-e29b-41d4-a716-446655440000', 'operador-123'],
      );
    });

    it('invita con SupabaseAuthService si está habilitado', async () => {
      const { service, mockDb, mockSupabaseAuth } = createService();

      const tx = {
        queryOne: vi
          .fn()
          .mockResolvedValueOnce({ id: 'subrol-123' })
          .mockResolvedValueOnce({ id: 'user-123' })
          .mockResolvedValueOnce({ id: 'membr-123' }),
        query: vi.fn().mockResolvedValue(undefined),
      };
      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      (mockSupabaseAuth.invitar as any).mockResolvedValue({
        authUserId: 'auth-user-456',
      });

      const result = await service.invitarMiembro('operador-123', 'actor-123', {
        nombre: 'Juan',
        email: 'juan@example.com',
        subRolId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(mockSupabaseAuth.invitar).toHaveBeenCalledWith('juan@example.com', 'Juan');
      expect(result.membresiaId).toBe('membr-123');
      expect(result.usuarioId).toBe('user-123');
      expect(result.email).toBe('juan@example.com');
    });

    it('genera UUID placeholder si SupabaseAuthService retorna null', async () => {
      const { service, mockDb, mockSupabaseAuth } = createService();

      const tx = {
        queryOne: vi
          .fn()
          .mockResolvedValueOnce({ id: 'subrol-123' })
          .mockResolvedValueOnce({ id: 'user-123' })
          .mockResolvedValueOnce({ id: 'membr-123' }),
        query: vi.fn().mockResolvedValue(undefined),
      };
      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      (mockSupabaseAuth.invitar as any).mockResolvedValue(null);

      await service.invitarMiembro('operador-123', 'actor-123', {
        nombre: 'Juan',
        email: 'juan@example.com',
        subRolId: '550e8400-e29b-41d4-a716-446655440000',
      });

      const insertCall = tx.queryOne.mock.calls[1];
      expect(insertCall[0]).toContain('insert into usuarios');
      const authUserId = insertCall[1][2];
      expect(typeof authUserId).toBe('string');
      expect(authUserId.length).toBeGreaterThan(0);
    });

    it('inserta en membresias con invitado_en = now()', async () => {
      const { service, mockDb, mockSupabaseAuth } = createService();

      const tx = {
        queryOne: vi
          .fn()
          .mockResolvedValueOnce({ id: 'subrol-123' })
          .mockResolvedValueOnce({ id: 'user-123' })
          .mockResolvedValueOnce({ id: 'membr-123' }),
        query: vi.fn().mockResolvedValue(undefined),
      };
      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      (mockSupabaseAuth.invitar as any).mockResolvedValue({ authUserId: 'auth-123' });

      await service.invitarMiembro('operador-123', 'actor-123', {
        nombre: 'Juan',
        email: 'juan@example.com',
        subRolId: '550e8400-e29b-41d4-a716-446655440000',
      });

      const membresiaCall = tx.queryOne.mock.calls[2];
      expect(membresiaCall[0]).toContain('insert into membresias');
      expect(membresiaCall[0]).toContain('invitado_en');
      expect(membresiaCall[1]).toEqual(['operador-123', 'user-123', '550e8400-e29b-41d4-a716-446655440000']);
    });

    it('registra auditoría con acción equipo.invitar', async () => {
      const { service, mockDb, mockSupabaseAuth } = createService();

      const tx = {
        queryOne: vi
          .fn()
          .mockResolvedValueOnce({ id: 'subrol-123' })
          .mockResolvedValueOnce({ id: 'user-123' })
          .mockResolvedValueOnce({ id: 'membr-123' }),
        query: vi.fn().mockResolvedValue(undefined),
      };
      (mockDb.transaction as any).mockImplementation((cb: any) => cb(tx));

      (mockSupabaseAuth.invitar as any).mockResolvedValue({ authUserId: 'auth-123' });

      await service.invitarMiembro('operador-123', 'actor-123', {
        nombre: 'Juan',
        email: 'juan@example.com',
        subRolId: '550e8400-e29b-41d4-a716-446655440000',
      });

      const auditCall = tx.query.mock.calls[0];
      expect(auditCall[0]).toContain('insert into auditoria');
      expect(auditCall[1][0]).toBe('operador-123');
      expect(auditCall[1][1]).toBe('actor-123');
      expect(auditCall[1][2]).toBe('equipo.invitar');
    });

    it('valida email con zod', async () => {
      const { service } = createService();

      await expect(
        service.invitarMiembro('operador-123', 'actor-123', {
          nombre: 'Juan',
          email: 'not-an-email',
          subRolId: '550e8400-e29b-41d4-a716-446655440000',
        }),
      ).rejects.toThrow();
    });

    it('valida subRolId con UUID', async () => {
      const { service } = createService();

      await expect(
        service.invitarMiembro('operador-123', 'actor-123', {
          nombre: 'Juan',
          email: 'juan@example.com',
          subRolId: 'not-a-uuid',
        }),
      ).rejects.toThrow();
    });
  });
});
