import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { SupabaseAuthService } from '@/auth/supabase-auth.service';
import { DomainErrors } from '@/common/domain-error';

const crearSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
});

const reasignarSchema = z.object({
  agricultorId: z.string().uuid('agricultorId debe ser un UUID válido'),
});

/** Agricultores de la unidad (O5). Un agricultor = usuario dueño de finca(s). */
@Injectable()
export class AgricultoresService {
  constructor(
    private readonly db: DbService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  async list(
    operadorId: string,
    filters?: { nombre?: string; email?: string; finca?: string },
    page: number = 1,
    pageSize: number = 25,
    sortBy: 'nombre' | 'email' | 'finca' = 'nombre',
    sortDir: 'asc' | 'desc' = 'asc',
  ) {
    const offset = (page - 1) * pageSize;

    const whereClauses: string[] = [
      `exists (select 1 from fincas f2 where f2.agricultor_id = u.id and f2.operador_id = $1)`,
    ];
    const params: any[] = [operadorId];

    if (filters?.nombre) {
      params.push(`%${filters.nombre}%`);
      whereClauses.push(`lower(u.nombre) like lower($${params.length})`);
    }
    if (filters?.email) {
      params.push(`%${filters.email}%`);
      whereClauses.push(`lower(u.email) like lower($${params.length})`);
    }
    if (filters?.finca) {
      params.push(`%${filters.finca}%`);
      whereClauses.push(`lower(f.nombre) like lower($${params.length})`);
    }

    const where = whereClauses.join(' and ');
    const dir = sortDir === 'desc' ? 'desc' : 'asc';
    const orderColumn = sortBy === 'email' ? 'u.email' : sortBy === 'finca' ? 'finca_nombres' : 'u.nombre';

    const countResult = await this.db.queryOne<{ total: string }>(
      `
      select count(distinct u.id) as total
      from usuarios u
      left join fincas f on f.agricultor_id = u.id and f.operador_id = $1
      where ${where}
      `,
      params,
    );

    const total = Number(countResult?.total ?? 0);
    const totalPages = Math.ceil(total / pageSize);

    const limitParamIndex = params.length + 1;
    const offsetParamIndex = params.length + 2;
    const rows = await this.db.query<any>(
      `
      select u.id, u.nombre, u.email,
             count(distinct f.id) as fincas,
             count(distinct p.id) as parcelas,
             string_agg(distinct f.nombre, ', ') as finca_nombres
      from usuarios u
      left join fincas f on f.agricultor_id = u.id and f.operador_id = $1
      left join parcelas p on p.finca_id = f.id
      where ${where}
      group by u.id
      order by ${orderColumn} ${dir}
      limit $${limitParamIndex} offset $${offsetParamIndex}
      `,
      [...params, pageSize, offset],
    );

    return {
      items: rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        email: r.email,
        finca: r.finca_nombres,
        parcelas: Number(r.parcelas),
      })),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Alta de agricultor: crea solo el usuario, sin finca (la finca se crea
   * independientemente después, y se asigna el agricultor cuando se crea).
   * Invita de verdad vía Supabase Auth (recibe email para fijar contraseña);
   * si no está configurado, cae a un placeholder y el agricultor queda sin
   * poder iniciar sesión hasta que se invite de nuevo. Auditado.
   */
  async crear(operadorId: string, actorId: string, body: unknown) {
    const { nombre, email } = crearSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const existe = await tx.queryOne('select 1 from usuarios where email = $1', [email]);
      if (existe) throw DomainErrors.userExists();

      const authResult = await this.supabaseAuth.invitar(email, nombre);
      const authUserId = authResult?.authUserId ?? crypto.randomUUID();

      const usuario = await tx.queryOne<{ id: string }>(
        `insert into usuarios (auth_user_id, nombre, email, activo)
         values ($1, $2, $3, true) returning id`,
        [authUserId, nombre, email],
      );
      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, $2, 'agricultor.crear', 'usuarios', $3, $4)`,
        [actorId, operadorId, usuario!.id, JSON.stringify({ nombre, email })],
      );
      return { id: usuario!.id, nombre, email };
    });
  }

  /**
   * Asigna (o reasigna) un agricultor a una finca. Si es la primera vez que
   * ese agricultor tiene una finca en esa operadora, crea su membresía con
   * sub_rol "Agricultor" (usando el patrón ON CONFLICT de 0013). Auditado.
   */
  async reasignarFinca(operadorId: string, fincaId: string, actorId: string, body: unknown) {
    const { agricultorId } = reasignarSchema.parse(body);
    return this.db.transaction(async (tx) => {
      // Verificar que la finca existe y pertenece al operador
      const finca = await tx.queryOne<{ id: string }>(
        'select id from fincas where id = $1 and operador_id = $2',
        [fincaId, operadorId],
      );
      if (!finca) throw DomainErrors.notFound();

      // Verificar que el agricultor destino existe
      const usuario = await tx.queryOne<{ id: string }>(
        'select id from usuarios where id = $1 and activo',
        [agricultorId],
      );
      if (!usuario) throw DomainErrors.notFound();

      // Asignar
      await tx.query('update fincas set agricultor_id = $1 where id = $2', [agricultorId, fincaId]);

      // Crear membresía Agricultor si no existe (primera vez en la unidad)
      const sub_rol_agricultor = await tx.queryOne<{ id: string }>(
        `select id from sub_roles where operador_id = $1 and nombre = 'Agricultor' and es_autogenerado`,
        [operadorId],
      );
      if (sub_rol_agricultor) {
        await tx.query(
          `insert into membresias (usuario_id, operador_id, sub_rol_id, aceptado_en)
           values ($1, $2, $3, now())
           on conflict (usuario_id, operador_id) do nothing`,
          [agricultorId, operadorId, sub_rol_agricultor.id],
        );
      }

      // Auditoría
      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, $2, 'finca.asignar', 'fincas', $3, $4)`,
        [actorId, operadorId, fincaId, JSON.stringify({ agricultorId })],
      );

      return { id: fincaId, agricultorId };
    });
  }
}
