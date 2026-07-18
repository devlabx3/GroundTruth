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

  async list() {
    const rows = await this.db.query<any>(
      `
      select o.id, o.nombre, o.pais, o.estado,
             coalesce(t.saldo_cache, 0) as saldo_cache,
             (select count(*) from parcelas p
                join fincas f on f.id = p.finca_id
               where f.operador_id = o.id) as parcelas
      from operadores o
      left join tesorerias t on t.operador_id = o.id
      order by o.nombre
      `,
    );
    return rows.map((o) => ({
      id: o.id,
      nombre: o.nombre,
      pais: o.pais,
      parcelas: Number(o.parcelas),
      saldoUsdc: Number(o.saldo_cache) / MICRO,
      estado: ESTADO_UI[o.estado] ?? 'pendiente',
    }));
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
   */
  async create(actorId: string, body: unknown) {
    const { nombre, pais, adminNombre, adminEmail } = crearSchema.parse(body);

    return this.db.transaction(async (tx) => {
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

      const usuarioId = await this.upsertUsuario(tx, adminNombre, adminEmail);
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
  private async upsertUsuario(tx: Tx, nombre: string, email: string): Promise<string> {
    const existente = await tx.queryOne<{ id: string; activo: boolean }>(
      'select id, activo from usuarios where email = $1',
      [email.toLowerCase()],
    );
    if (existente) {
      if (!existente.activo) throw DomainErrors.accountInactive();
      return existente.id;
    }
    const authResult = await this.supabaseAuth.invitar(email, nombre);
    const authUserId = authResult?.authUserId ?? crypto.randomUUID();
    const nuevo = await tx.queryOne<{ id: string }>(
      `insert into usuarios (auth_user_id, nombre, email)
       values ($1, $2, $3) returning id`,
      [authUserId, nombre, email.toLowerCase()],
    );
    return nuevo!.id;
  }
}
