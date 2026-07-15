import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';
import { NEEDS_PRIVILEGE } from './needs-privilege.decorator';
import type { AuthedRequest } from './auth.guard';

export interface OperadorRequest extends AuthedRequest {
  operadorId: string;
  usuarioId: string; // usuarios.id (no el auth_user_id) — para FKs de dominio
}

/**
 * Autorización por acción (Modelo-de-Datos §7): RLS aísla filas; QUÉ se puede
 * hacer dentro de la unidad lo decide este guard consultando los privilegios
 * efectivos del sub-rol. El admin de plataforma pasa siempre (soporte global).
 */
@Injectable()
export class PrivilegesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const anyOf = this.reflector.getAllAndOverride<string[]>(NEEDS_PRIVILEGE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!anyOf?.length) return true;

    const req = context.switchToHttp().getRequest<OperadorRequest>();
    const operadorId = req.headers['x-operador-id'];
    if (typeof operadorId !== 'string' || !operadorId) throw DomainErrors.noPrivilege();

    const row = await this.db.queryOne<{ usuario_id: string; permitido: boolean }>(
      `
      select u.id as usuario_id,
        u.es_admin
        or exists (
          select 1
          from membresias m
          join sub_rol_privilegios srp on srp.sub_rol_id = m.sub_rol_id
          join catalogo_privilegios cp on cp.id = srp.privilegio_id
          where m.usuario_id = u.id and m.activo
            and m.operador_id = $2
            and cp.clave = any($3)
        ) as permitido
      from usuarios u
      where u.auth_user_id = $1 and u.activo
      `,
      [req.authUserId, operadorId, anyOf],
    );

    if (!row?.permitido) throw DomainErrors.noPrivilege();
    req.operadorId = operadorId;
    req.usuarioId = row.usuario_id;
    return true;
  }
}
