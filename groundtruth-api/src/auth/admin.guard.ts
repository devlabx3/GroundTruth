import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';
import type { AuthedRequest } from './auth.guard';

export interface AdminRequest extends AuthedRequest {
  usuarioId: string; // usuarios.id — actor de la auditoría
}

/**
 * Admin de plataforma ("Soporte GroundTruth": `usuarios.es_admin`).
 *
 * No es un privilegio de sub-rol: el admin NO pertenece a una unidad y por eso
 * no viaja con `x-operador-id`. Es la razón de que su superficie viva bajo
 * /admin con endpoints propios en vez de reutilizar los del operador — así
 * ningún endpoint queda con dos autorizaciones distintas según quién llame.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly db: DbService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const row = await this.db.queryOne<{ id: string }>(
      'select id from usuarios where auth_user_id = $1 and activo and es_admin',
      [req.authUserId],
    );
    if (!row) throw DomainErrors.noPrivilege();
    req.usuarioId = row.id;
    return true;
  }
}
