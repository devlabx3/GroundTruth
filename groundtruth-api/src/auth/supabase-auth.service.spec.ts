import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthService } from './supabase-auth.service';

describe('SupabaseAuthService', () => {
  const createService = (config: Partial<Record<string, any>> = {}) => {
    const mockConfig = {
      get: vi.fn((key: string) => config[key]),
    } as unknown as ConfigService;

    const service = new SupabaseAuthService(mockConfig);
    return { service, mockConfig };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('isEnabled', () => {
    it('retorna false sin SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY', () => {
      const { service } = createService({});
      expect(service.isEnabled()).toBe(false);
    });

    it('retorna false con solo SUPABASE_URL', () => {
      const { service } = createService({ SUPABASE_URL: 'https://abc.supabase.co' });
      expect(service.isEnabled()).toBe(false);
    });

    it('retorna true con ambas credenciales', () => {
      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('invitar', () => {
    it('retorna null si no está habilitado', async () => {
      const { service } = createService({});
      const result = await service.invitar('user@example.com', 'User Name');
      expect(result).toBeNull();
    });

    it('envía headers correctos en la request', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'auth-123' }),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      await service.invitar('user@example.com', 'User Name');

      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toBe('https://abc.supabase.co/auth/v1/admin/invite');
      expect(call[1].headers).toEqual({
        apikey: 'anon-key',
        authorization: 'Bearer service-role-key',
        'content-type': 'application/json',
      });
    });

    it('incluye nombre en el payload si es proporcionado', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'auth-123' }),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      await service.invitar('user@example.com', 'User Name');

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({
        email: 'user@example.com',
        data: { name: 'User Name' },
      });
    });

    it('omite data si no hay nombre', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'auth-123' }),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      await service.invitar('user@example.com');

      const call = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body).toEqual({
        email: 'user@example.com',
        data: {},
      });
    });

    it('retorna authUserId del response.id', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'auth-user-123' }),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      const result = await service.invitar('user@example.com');
      expect(result).toEqual({ authUserId: 'auth-user-123' });
    });

    it('retorna authUserId del response.user.id si id no existe', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ user: { id: 'auth-user-456' } }),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      const result = await service.invitar('user@example.com');
      expect(result).toEqual({ authUserId: 'auth-user-456' });
    });

    it('retorna null si response no es ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Bad request' }),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      const result = await service.invitar('user@example.com');
      expect(result).toBeNull();
    });

    it('retorna null si response no tiene user ID', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      const result = await service.invitar('user@example.com');
      expect(result).toBeNull();
    });

    it('retorna null en caso de error de red', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { service } = createService({
        SUPABASE_URL: 'https://abc.supabase.co',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      });

      const result = await service.invitar('user@example.com');
      expect(result).toBeNull();
    });
  });
});
