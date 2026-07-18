import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { SupabaseAuthService } from '@/auth/supabase-auth.service';
import { DomainError, DomainErrors } from '@/common/domain-error';

const crearSchema = z.object({
  nombre: z.string().trim().min(1),
  privileges: z.array(z.string()).min(1),
});
const cambiarSchema = z.object({ subRolId: z.string().uuid() });
const invitarSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
  subRolId: z.string().uuid(),
});

/** Equipo y sub-roles (O9). RBAC dinámico: la unidad compone sus sub-roles. */
@Injectable()
export class EquipoService {
  constructor(
    private readonly db: DbService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  async overview(operadorId: string) {
    const miembros = await this.db.query<any>(
      `
      select m.id, u.nombre, u.email, m.sub_rol_id, sr.nombre as sub_rol
      from membresias m
      join usuarios u  on u.id = m.usuario_id
      join sub_roles sr on sr.id = m.sub_rol_id
      where m.operador_id = $1 and m.activo
      order by u.nombre
      `,
      [operadorId],
    );

    const subroles = await this.db.query<any>(
      `
      select sr.id, sr.nombre, sr.es_autogenerado,
             coalesce(array_agg(cp.clave) filter (where cp.clave is not null), '{}') as privileges,
             (select count(*) from membresias m where m.sub_rol_id = sr.id and m.activo) as en_uso
      from sub_roles sr
      left join sub_rol_privilegios srp on srp.sub_rol_id = sr.id
      left join catalogo_privilegios cp on cp.id = srp.privilegio_id
      where sr.operador_id = $1
      group by sr.id
      order by sr.nombre
      `,
      [operadorId],
    );

    return {
      miembros: miembros.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        email: m.email,
        subRol: m.sub_rol,
        subRolId: m.sub_rol_id,
      })),
      subroles: subroles.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        esAutogenerado: s.es_autogenerado,
        privileges: s.privileges,
        enUso: Number(s.en_uso),
      })),
    };
  }

  async crearSubrol(operadorId: string, body: unknown) {
    const { nombre, privileges } = crearSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const existe = await tx.queryOne(
        'select 1 from sub_roles where operador_id = $1 and nombre = $2',
        [operadorId, nombre],
      );
      if (existe) throw new DomainError('SUBROLE_EXISTS', 'subrole_exists', 409);

      // Un privilegio deprecado (Admin §A2) ya no se puede ASIGNAR — los sub-roles
      // que lo tuvieran lo conservan hasta que se editen, pero no nacen nuevos con él.
      const deprecados = await tx.query<{ clave: string }>(
        `select clave from catalogo_privilegios
         where clave = any($1) and deprecado_en is not null`,
        [privileges],
      );
      if (deprecados.length > 0) {
        throw new DomainError('PRIVILEGE_DEPRECATED', 'privilege_deprecated', 409);
      }

      const sr = await tx.queryOne<{ id: string }>(
        'insert into sub_roles (operador_id, nombre) values ($1, $2) returning id',
        [operadorId, nombre],
      );
      await tx.query(
        `insert into sub_rol_privilegios (sub_rol_id, privilegio_id)
         select $1, id from catalogo_privilegios where clave = any($2)`,
        [sr!.id, privileges],
      );
      return { id: sr!.id, nombre, privileges, enUso: 0 };
    });
  }

  async eliminarSubrol(operadorId: string, subRolId: string) {
    return this.db.transaction(async (tx) => {
      const sr = await tx.queryOne<{ en_uso: string }>(
        `select (select count(*) from membresias m where m.sub_rol_id = sr.id and m.activo) as en_uso
         from sub_roles sr where sr.id = $1 and sr.operador_id = $2`,
        [subRolId, operadorId],
      );
      if (!sr) throw DomainErrors.notFound();
      if (Number(sr.en_uso) > 0) {
        throw new DomainError('SUBROLE_IN_USE', 'subrole_in_use', 409);
      }
      await tx.query('delete from sub_rol_privilegios where sub_rol_id = $1', [subRolId]);
      await tx.query('delete from sub_roles where id = $1', [subRolId]);
      return { id: subRolId };
    });
  }

  /**
   * Cambia el sub-rol de un miembro. El guardarraíl "nunca sin timón"
   * (trigger en `membresias`) bloquea dejar la unidad sin `equipo.gestionar`;
   * el error llega como LAST_TEAM_ADMIN y el filtro lo traduce.
   */
  async cambiarSubrol(operadorId: string, membresiaId: string, body: unknown) {
    const { subRolId } = cambiarSchema.parse(body);
    const updated = await this.db.queryOne<{ id: string }>(
      `update membresias set sub_rol_id = $3
       where id = $1 and operador_id = $2
       returning id`,
      [membresiaId, operadorId, subRolId],
    );
    if (!updated) throw DomainErrors.notFound();
    return { id: membresiaId, subRolId };
  }

  async invitarMiembro(operadorId: string, actorId: string, body: unknown) {
    const { nombre, email, subRolId } = invitarSchema.parse(body);

    return this.db.transaction(async (tx) => {
      const sr = await tx.queryOne<{ id: string }>(
        'select id from sub_roles where id = $1 and operador_id = $2',
        [subRolId, operadorId],
      );
      if (!sr) throw DomainErrors.notFound();

      const authResult = await this.supabaseAuth.invitar(email, nombre);
      const authUserId = authResult?.authUserId || this.generatePlaceholderId();

      const usuario = await tx.queryOne<{ id: string }>(
        `insert into usuarios (nombre, email, auth_user_id)
         values ($1, $2, $3)
         returning id`,
        [nombre, email, authUserId],
      );

      const membresiaId = await tx.queryOne<{ id: string }>(
        `insert into membresias (operador_id, usuario_id, sub_rol_id, invitado_en)
         values ($1, $2, $3, now())
         returning id`,
        [operadorId, usuario!.id, subRolId],
      );

      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, $2, 'equipo.invitar', 'usuarios', $3, $4)`,
        [actorId, operadorId, usuario!.id, JSON.stringify({ email, nombre })],
      );

      return {
        membresiaId: membresiaId!.id,
        usuarioId: usuario!.id,
        email,
      };
    });
  }

  private generatePlaceholderId(): string {
    return crypto.randomUUID();
  }
}
