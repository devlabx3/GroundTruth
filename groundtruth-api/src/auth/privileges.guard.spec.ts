import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { DbService } from '@/db/db.service';
import { PrivilegesGuard, type OperadorRequest } from './privileges.guard';
import { NEEDS_PRIVILEGE } from './needs-privilege.decorator';

describe('PrivilegesGuard', () => {
  const createGuard = (mockDb: Partial<DbService> = {}) => {
    const reflector = {
      getAllAndOverride: vi.fn(),
    } as unknown as Reflector;

    const db = {
      queryOne: vi.fn(),
      ...mockDb,
    } as unknown as DbService;

    const guard = new PrivilegesGuard(reflector, db);
    return { guard, reflector, db };
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('permite acceso si no hay privilegios requeridos', async () => {
    const { guard, reflector } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(undefined);

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({}),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('rechaza si no hay x-operador-id header', async () => {
    const { guard, reflector } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(['test.privilege']);

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          headers: {},
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('rechaza si el usuario no existe', async () => {
    const { guard, reflector, db } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(['test.privilege']);
    (db.queryOne as any).mockResolvedValue(null);

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          headers: { 'x-operador-id': 'op-123' },
          authUserId: 'auth-123',
        } as Partial<OperadorRequest>),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('rechaza si el usuario no tiene el privilegio requerido', async () => {
    const { guard, reflector, db } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(['test.privilege']);
    (db.queryOne as any).mockResolvedValue({
      usuario_id: 'user-123',
      es_admin: false,
      privileges: ['other.privilege'],
      tiene_requerido: false,
    });

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          headers: { 'x-operador-id': 'op-123' },
          authUserId: 'auth-123',
        } as Partial<OperadorRequest>),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('permite acceso si el usuario tiene el privilegio', async () => {
    const { guard, reflector, db } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(['test.privilege']);

    const req = {
      headers: { 'x-operador-id': 'op-123' },
      authUserId: 'auth-123',
    } as Partial<OperadorRequest>;

    (db.queryOne as any).mockResolvedValue({
      usuario_id: 'user-123',
      es_admin: false,
      privileges: ['test.privilege', 'other.privilege'],
      tiene_requerido: true,
    });

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(req),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(req.operadorId).toBe('op-123');
    expect(req.usuarioId).toBe('user-123');
    expect(req.privileges).toContain('test.privilege');
  });

  it('asigna todos los privilegios si el usuario es admin', async () => {
    const { guard, reflector, db } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(['test.privilege']);

    const req = {
      headers: { 'x-operador-id': 'op-123' },
      authUserId: 'auth-123',
    } as Partial<OperadorRequest>;

    (db.queryOne as any).mockResolvedValue({
      usuario_id: 'user-123',
      es_admin: true,
      privileges: ['test.privilege'],
      tiene_requerido: true,
    });

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(req),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
    expect(req.privileges).toContain('test.privilege');
  });

  it('permite múltiples privilegios requeridos si el usuario tiene al menos uno', async () => {
    const { guard, reflector, db } = createGuard();
    (reflector.getAllAndOverride as any).mockReturnValue(['privs.a', 'privs.b']);

    const req = {
      headers: { 'x-operador-id': 'op-123' },
      authUserId: 'auth-123',
    } as Partial<OperadorRequest>;

    (db.queryOne as any).mockResolvedValue({
      usuario_id: 'user-123',
      es_admin: false,
      privileges: ['privs.a'],
      tiene_requerido: true,
    });

    const context = {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue(req),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
