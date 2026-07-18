import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { SupabaseAuthService } from '@/auth/supabase-auth.service';
import { DomainErrors } from '@/common/domain-error';

const crearUsuarioSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
});

const editarUsuarioSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
});

const crearPrivilegioSchema = z.object({
  clave: z
    .string()
    .trim()
    .regex(/^[a-z]+\.[a-z]+$/, 'clave debe ser dominio.accion'),
  nombre: z.string().trim().min(1),
  sensible: z.boolean().optional().default(false),
});

/** Usuarios y membresías (A3) + catálogo de privilegios (A2). */
@Injectable()
export class AdminIdentidadService {
  constructor(
    private readonly db: DbService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  // ---- Usuarios (A3) ----

  async listUsuarios() {
    const rows = await this.db.query<any>(
      `
      select u.id, u.nombre, u.email, u.activo, u.es_admin,
             coalesce(
               (select string_agg(o.nombre, ', ' order by o.nombre)
                from membresias m
                join operadores o on o.id = m.operador_id
                where m.usuario_id = u.id and m.activo),
               ''
             ) as membresias,
             exists (select 1 from fincas f where f.agricultor_id = u.id) as es_agricultor
      from usuarios u
      order by u.nombre
      `,
    );
    return rows.map((u) => ({
      id: u.id,
      nombre: u.nombre,
      email: u.email,
      membresias: u.membresias,
      esAgricultor: u.es_agricultor,
      esAdmin: u.es_admin,
      estado: u.activo ? 'activa' : 'inactiva',
    }));
  }

  async crearUsuario(actorId: string, body: unknown) {
    const { nombre, email } = crearUsuarioSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const existe = await tx.queryOne<{ id: string }>(
        'select id from usuarios where email = $1',
        [email.toLowerCase()],
      );
      if (existe) throw DomainErrors.userExists();

      const authResult = await this.supabaseAuth.invitar(email, nombre);
      const authUserId = authResult?.authUserId ?? crypto.randomUUID();

      // Sin membresía ni finca: es un usuario de plataforma sin rol todavía
      // ("rol ≠ persona" — el rol lo dará una membresía o una finca después).
      const u = await tx.queryOne<{ id: string }>(
        `insert into usuarios (auth_user_id, nombre, email)
         values ($1, $2, $3) returning id`,
        [authUserId, nombre, email.toLowerCase()],
      );
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, 'usuario.crear', 'usuarios', $2, $3)`,
        [actorId, u!.id, JSON.stringify({ nombre, email })],
      );
      return { id: u!.id, nombre, email, membresias: '', estado: 'activa' };
    });
  }

  /**
   * Edita nombre/email. Si el email cambia, sincroniza PRIMERO el login real en
   * Supabase Auth (`actualizarEmail`) — si eso falla, no se toca el dominio, para
   * que ambos sistemas nunca queden desincronizados. Auditado con antes/después.
   */
  async editarUsuario(actorId: string, id: string, body: unknown) {
    const { nombre, email } = editarUsuarioSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const u = await tx.queryOne<{ nombre: string; email: string; auth_user_id: string }>(
        'select nombre, email, auth_user_id from usuarios where id = $1 for update',
        [id],
      );
      if (!u) throw DomainErrors.notFound();

      const nuevoEmail = email?.toLowerCase();
      if (nuevoEmail && nuevoEmail !== u.email) {
        const existe = await tx.queryOne<{ id: string }>(
          'select id from usuarios where email = $1 and id <> $2',
          [nuevoEmail, id],
        );
        if (existe) throw DomainErrors.userExists();

        const sincronizado = await this.supabaseAuth.actualizarEmail(u.auth_user_id, nuevoEmail);
        if (!sincronizado && this.supabaseAuth.isEnabled()) {
          throw DomainErrors.authSyncFailed();
        }
      }

      const actualizado = await tx.queryOne<{ nombre: string; email: string }>(
        `update usuarios set nombre = coalesce($2, nombre), email = coalesce($3, email)
         where id = $1 returning nombre, email`,
        [id, nombre ?? null, nuevoEmail ?? null],
      );
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
         values ($1, 'usuario.editar', 'usuarios', $2, $3, $4)`,
        [
          actorId,
          id,
          JSON.stringify({ nombre: u.nombre, email: u.email }),
          JSON.stringify({ nombre: actualizado!.nombre, email: actualizado!.email }),
        ],
      );
      return { id, nombre: actualizado!.nombre, email: actualizado!.email };
    });
  }

  /** Reactivar (auditado). Espejo de `desactivarUsuario`; nunca deja huérfana una unidad. */
  async reactivarUsuario(actorId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const u = await tx.queryOne<{ activo: boolean }>(
        'select activo from usuarios where id = $1 for update',
        [id],
      );
      if (!u) throw DomainErrors.notFound();
      if (u.activo) return { id, estado: 'activa' };

      await tx.query(
        'update usuarios set activo = true, desactivado_en = null where id = $1',
        [id],
      );
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
         values ($1, 'usuario.reactivar', 'usuarios', $2, '{"activo":false}', '{"activo":true}')`,
        [actorId, id],
      );
      return { id, estado: 'activa' };
    });
  }

  /**
   * Dispara el email de recuperación de contraseña. El Admin nunca ve ni fija
   * una contraseña ajena. Si Supabase Auth no está configurado, falla con un
   * error claro en vez de fingir éxito — el Admin necesita saber que no salió.
   */
  async enviarResetPassword(actorId: string, id: string) {
    const u = await this.db.queryOne<{ email: string }>(
      'select email from usuarios where id = $1',
      [id],
    );
    if (!u) throw DomainErrors.notFound();

    if (!this.supabaseAuth.isEnabled()) {
      throw DomainErrors.authNotConfigured();
    }
    const enviado = await this.supabaseAuth.enviarResetPassword(u.email);
    if (!enviado) throw DomainErrors.authSyncFailed();

    await this.db.query(
      `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_nuevo)
       values ($1, 'usuario.reset_password', 'usuarios', $2, $3)`,
      [actorId, id, JSON.stringify({ email: u.email })],
    );
    return { id, enviado: true };
  }

  /**
   * Desactivar un usuario (auditado). El trigger `guard_last_team_admin` protege
   * la baja de una MEMBRESÍA, pero desactivar al usuario no la toca — así que la
   * misma regla ("nunca sin timón") se comprueba aquí, o una unidad podría
   * quedarse sin nadie que gestione su equipo.
   */
  async desactivarUsuario(actorId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const u = await tx.queryOne<{ nombre: string; activo: boolean }>(
        'select nombre, activo from usuarios where id = $1 for update',
        [id],
      );
      if (!u) throw DomainErrors.notFound();
      if (!u.activo) return { id, estado: 'inactiva' };

      const huerfana = await tx.queryOne<{ operador_id: string }>(
        `
        -- Unidades donde este usuario es el ÚNICO con equipo.gestionar activo.
        select m.operador_id
        from membresias m
        join sub_rol_privilegios srp on srp.sub_rol_id = m.sub_rol_id
        join catalogo_privilegios cp on cp.id = srp.privilegio_id
        where m.usuario_id = $1 and m.activo
          and cp.clave = 'equipo.gestionar'
          and not exists (
            select 1 from membresias m2
            join sub_rol_privilegios srp2 on srp2.sub_rol_id = m2.sub_rol_id
            join catalogo_privilegios cp2 on cp2.id = srp2.privilegio_id
            where m2.operador_id = m.operador_id and m2.activo
              and m2.usuario_id <> $1
              and cp2.clave = 'equipo.gestionar'
          )
        limit 1
        `,
        [id],
      );
      if (huerfana) throw DomainErrors.lastTeamAdmin();

      await tx.query(
        'update usuarios set activo = false, desactivado_en = now() where id = $1',
        [id],
      );
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
         values ($1, 'usuario.desactivar', 'usuarios', $2, '{"activo":true}', '{"activo":false}')`,
        [actorId, id],
      );
      return { id, estado: 'inactiva' };
    });
  }

  // ---- Catálogo de privilegios (A2) ----

  async listPrivilegios() {
    const rows = await this.db.query<any>(
      `
      select cp.id, cp.clave, cp.nombre, cp.sensible, cp.deprecado_en,
             (select count(*) from sub_rol_privilegios srp where srp.privilegio_id = cp.id) as en_subroles
      from catalogo_privilegios cp
      order by cp.clave
      `,
    );
    return rows.map((p) => ({
      id: p.id,
      clave: p.clave,
      nombre: p.nombre,
      sensible: p.sensible,
      enSubroles: Number(p.en_subroles),
      estado: p.deprecado_en ? 'deprecado' : 'activo',
    }));
  }

  async crearPrivilegio(actorId: string, body: unknown) {
    const { clave, nombre, sensible } = crearPrivilegioSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const existe = await tx.queryOne<{ id: string }>(
        'select id from catalogo_privilegios where clave = $1',
        [clave],
      );
      if (existe) throw DomainErrors.privilegeExists();

      const p = await tx.queryOne<{ id: string }>(
        `insert into catalogo_privilegios (clave, nombre, sensible)
         values ($1, $2, $3) returning id`,
        [clave, nombre, sensible],
      );
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, 'privilegio.crear', 'catalogo_privilegios', $2, $3)`,
        [actorId, p!.id, JSON.stringify({ clave, nombre, sensible })],
      );
      return { id: p!.id, clave, nombre, sensible, enSubroles: 0, estado: 'activo' };
    });
  }

  /**
   * Deprecar (nunca borrar). Semántica del diseño (§A2, y así lo dice la copia de
   * la vista): el privilegio deja de poder ASIGNARSE — `equipo.crearSubrol` lo
   * rechaza —, pero los sub-roles que ya lo tienen lo conservan hasta que se
   * editen. No es una revocación retroactiva: no rompe a nadie en caliente.
   */
  async deprecarPrivilegio(actorId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const p = await tx.queryOne<{ clave: string; deprecado_en: Date | null }>(
        'select clave, deprecado_en from catalogo_privilegios where id = $1 for update',
        [id],
      );
      if (!p) throw DomainErrors.notFound();
      if (p.deprecado_en) return { id, estado: 'deprecado' };

      await tx.query(
        'update catalogo_privilegios set deprecado_en = now() where id = $1',
        [id],
      );
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, 'privilegio.deprecar', 'catalogo_privilegios', $2, $3)`,
        [actorId, id, JSON.stringify({ clave: p.clave, deprecado: true })],
      );
      return { id, estado: 'deprecado' };
    });
  }
}
