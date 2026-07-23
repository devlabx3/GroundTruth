import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService, Tx } from '@/db/db.service';
import { SupabaseAuthService } from '@/auth/supabase-auth.service';
import { DomainErrors } from '@/common/domain-error';

const MICRO = 1_000_000;

/** operador_estado (DB) → estado que pinta la UI. */
const ESTADO_UI: Record<string, string> = {
  ACTIVO: 'activa',
  SUSPENDIDO: 'suspendida',
  PENDIENTE_ONCHAIN: 'pendiente',
};

const crearSchema = z.object({
  nombre: z.string().trim().min(1),
  pais: z.string().trim().length(2),
  adminNombre: z.string().trim().min(1),
  adminEmail: z.string().trim().email(),
});

const estadoSchema = z.object({
  estado: z.enum(['activa', 'suspendida']),
});

/** estado UI → operador_estado (DB). Inverso de ESTADO_UI, para filtrar. */
const ESTADO_DB: Record<string, string> = {
  activa: 'ACTIVO',
  suspendida: 'SUSPENDIDO',
  pendiente: 'PENDIENTE_ONCHAIN',
};

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['nombre', 'pais', 'parcelas', 'saldoUsdc', 'estado']).default('nombre'),
  sortDir: z.enum(['asc', 'desc']).default('asc'),
  nombre: z.string().trim().optional(),
  pais: z.string().trim().optional(),
  estado: z.enum(['activa', 'suspendida', 'pendiente']).optional(),
});

/**
 * Unidades de negocio (A1). El admin las ve todas; ninguna consulta filtra por
 * `x-operador-id` — es la superficie transversal de la plataforma.
 */
@Injectable()
export class AdminUnidadesService {
  constructor(
    private readonly db: DbService,
    private readonly supabaseAuth: SupabaseAuthService,
  ) {}

  async list(params: unknown) {
    const { page, pageSize, sortBy, sortDir, nombre, pais, estado } = listQuerySchema.parse(params);
    const offset = (page - 1) * pageSize;

    // Mapeo seguro de columnas de sort (validado por schema Zod, nunca interpolado del usuario).
    const sortColMap: Record<string, string> = {
      nombre: 'nombre',
      pais: 'pais',
      parcelas: 'parcelas',
      saldoUsdc: 'saldo_cache',
      estado: 'estado',
    };
    const sortCol = sortColMap[sortBy];
    const orderDir = sortDir.toUpperCase();

    const nombreFilter = nombre ? `%${nombre}%` : null;
    const paisFilter = pais ? `%${pais}%` : null;
    const estadoFilter = estado ? ESTADO_DB[estado] : null;

    const sql = `
      with operadores_agg as (
        select o.id, o.nombre, o.pais, o.estado,
               coalesce(t.saldo_cache, 0) as saldo_cache,
               (select count(*) from parcelas p
                  join fincas f on f.id = p.finca_id
                 where f.operador_id = o.id) as parcelas
        from operadores o
        left join tesorerias t on t.operador_id = o.id
      )
      select id, nombre, pais, estado, saldo_cache, parcelas,
             count(*) over() as total
      from operadores_agg
      where
        ($1::text is null or nombre ilike $1)
        and ($2::text is null or pais ilike $2)
        and ($3::text is null or estado::text = $3)
      order by ${sortCol} ${orderDir}
      limit $4 offset $5
    `;

    const rows = await this.db.query<any>(sql, [nombreFilter, paisFilter, estadoFilter, pageSize, offset]);
    const total = rows.length > 0 ? Number(rows[0].total) : 0;

    return {
      items: rows.map((o) => ({
        id: o.id,
        nombre: o.nombre,
        pais: o.pais,
        parcelas: Number(o.parcelas),
        saldoUsdc: Number(o.saldo_cache) / MICRO,
        estado: ESTADO_UI[o.estado] ?? 'pendiente',
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async detail(id: string) {
    const o = await this.db.queryOne<any>(
      `
      select o.id, o.nombre, o.pais, o.estado,
             t.treasury_pda, t.saldo_cache
      from operadores o
      left join tesorerias t on t.operador_id = o.id
      where o.id = $1
      `,
      [id],
    );
    if (!o) throw DomainErrors.notFound();

    const miembros = await this.db.query<any>(
      `
      select u.id, u.nombre, u.email, sr.nombre as sub_rol
      from membresias m
      join usuarios u  on u.id = m.usuario_id
      join sub_roles sr on sr.id = m.sub_rol_id
      where m.operador_id = $1 and m.activo
      order by u.nombre
      `,
      [id],
    );

    return {
      id: o.id,
      nombre: o.nombre,
      pais: o.pais,
      estado: ESTADO_UI[o.estado] ?? 'pendiente',
      // Sin programa Anchor todavía: una unidad recién creada no tiene Treasury
      // PDA. La UI muestra el hueco en vez de inventar una dirección.
      treasury: o.treasury_pda ?? null,
      saldoUsdc: o.saldo_cache != null ? Number(o.saldo_cache) / MICRO : null,
      miembros: miembros.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        email: m.email,
        subRol: m.sub_rol,
      })),
    };
  }

  /**
   * Alta de unidad (A1). Crea la unidad, su sub-rol de dirección (con TODOS los
   * privilegios vigentes — si no, nacería sin timón) y siembra a su administrador.
   *
   * Nace en PENDIENTE_ONCHAIN a propósito: la tesorería es una cuenta on-chain
   * (`init_operator_treasury`) y ese programa Anchor todavía no existe. Mientras
   * no exista, la unidad no puede certificar (lo impide `embarques.certificar`).
   * Preferimos ese estado honesto a fabricar una Treasury PDA falsa.
   *
   * Tras el commit: si el admin es nuevo, dispara un email de recuperación de
   * contraseña para que pueda darse de alta y elegir su contraseña inicial.
   */
  async create(actorId: string, body: unknown) {
    const { nombre, pais, adminNombre, adminEmail } = crearSchema.parse(body);

    let adminEsNuevo = false;
    const resultado = await this.db.transaction(async (tx) => {
      const op = await tx.queryOne<{ id: string }>(
        `insert into operadores (nombre, pais, estado)
         values ($1, $2, 'PENDIENTE_ONCHAIN') returning id`,
        [nombre, pais.toUpperCase()],
      );
      const operadorId = op!.id;

      const subRol = await tx.queryOne<{ id: string }>(
        `insert into sub_roles (operador_id, nombre, es_autogenerado)
         values ($1, 'Dirección', true) returning id`,
        [operadorId],
      );
      await tx.query(
        `insert into sub_rol_privilegios (sub_rol_id, privilegio_id)
         select $1, id from catalogo_privilegios where deprecado_en is null`,
        [subRol!.id],
      );

      const { id: usuarioId, esNuevo } = await this.upsertUsuario(tx, adminNombre, adminEmail);
      adminEsNuevo = esNuevo;
      await tx.query(
        `insert into membresias (usuario_id, operador_id, sub_rol_id, aceptado_en)
         values ($1, $2, $3, now())`,
        [usuarioId, operadorId, subRol!.id],
      );

      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, $2, 'unidad.crear', 'operadores', $2, $3)`,
        [actorId, operadorId, JSON.stringify({ nombre, pais, adminEmail })],
      );

      return { id: operadorId, estado: 'pendiente', treasuryPendiente: true };
    });

    if (adminEsNuevo) {
      await this.supabaseAuth.enviarResetPassword(adminEmail);
    }

    return resultado;
  }

  /** Suspender / reactivar (auditado). Una unidad PENDIENTE_ONCHAIN no se toca. */
  async setEstado(actorId: string, id: string, body: unknown) {
    const { estado } = estadoSchema.parse(body);
    const nuevo = estado === 'activa' ? 'ACTIVO' : 'SUSPENDIDO';

    return this.db.transaction(async (tx) => {
      const prev = await tx.queryOne<{ estado: string }>(
        'select estado from operadores where id = $1 for update',
        [id],
      );
      if (!prev) throw DomainErrors.notFound();
      if (prev.estado === 'PENDIENTE_ONCHAIN') throw DomainErrors.unitNotActive();

      await tx.query('update operadores set estado = $2 where id = $1', [id, nuevo]);
      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_anterior, valor_nuevo)
         values ($1, $2, 'unidad.estado', 'operadores', $2, $3, $4)`,
        [
          actorId,
          id,
          JSON.stringify({ estado: prev.estado }),
          JSON.stringify({ estado: nuevo }),
        ],
      );
      return { id, estado: ESTADO_UI[nuevo] };
    });
  }

  /** Reutiliza el usuario si el email ya existe; si no, lo crea e invita de verdad. */
  private async upsertUsuario(tx: Tx, nombre: string, email: string): Promise<{ id: string; esNuevo: boolean }> {
    const existente = await tx.queryOne<{ id: string; activo: boolean }>(
      'select id, activo from usuarios where email = $1',
      [email.toLowerCase()],
    );
    if (existente) {
      if (!existente.activo) throw DomainErrors.accountInactive();
      return { id: existente.id, esNuevo: false };
    }
    const authResult = await this.supabaseAuth.invitar(email, nombre);
    const authUserId = authResult?.authUserId ?? crypto.randomUUID();
    const nuevo = await tx.queryOne<{ id: string }>(
      `insert into usuarios (auth_user_id, nombre, email)
       values ($1, $2, $3) returning id`,
      [authUserId, nombre, email.toLowerCase()],
    );
    return { id: nuevo!.id, esNuevo: true };
  }
}
