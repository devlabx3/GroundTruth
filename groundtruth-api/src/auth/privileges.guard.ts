import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';
import { NEEDS_PRIVILEGE } from './needs-privilege.decorator';
import type { AuthedRequest } from './auth.guard';

export interface OperadorRequest extends AuthedRequest {
  operadorId: string;
  usuarioId: string; // usuarios.id (no el auth_user_id) — para FKs de dominio
  privileges: string[]; // conjunto efectivo de privilegios en este operador
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

    const row = await this.db.queryOne<{
      usuario_id: string;
      es_admin: boolean;
      privileges: string[];
      tiene_requerido: boolean;
    }>(
      `
      with user_privs as (
        select u.id as usuario_id, u.es_admin,
          case
            when u.es_admin then array_agg(distinct cp.clave) filter (where cp.clave is not null)
            else coalesce(
              array_agg(distinct cp.clave) filter (where cp.clave is not null and m.activo),
              '{}'::text[]
            )
          end as all_privs
        from usuarios u
        left join membresias m on m.usuario_id = u.id and m.operador_id = $2
        left join sub_rol_privilegios srp on srp.sub_rol_id = m.sub_rol_id
        left join catalogo_privilegios cp on cp.id = srp.privilegio_id
        where u.auth_user_id = $1 and u.activo
        group by u.id, u.es_admin
      )
      select usuario_id, es_admin, all_privs as privileges,
        es_admin or (all_privs && $3::text[]) as tiene_requerido
      from user_privs
      `,
      [req.authUserId, operadorId, anyOf],
    );

    if (!row?.tiene_requerido) throw DomainErrors.noPrivilege();
    req.operadorId = operadorId;
    req.usuarioId = row.usuario_id;
    req.privileges = row.es_admin ? anyOf : row.privileges || [];
    return true;
  }
}
