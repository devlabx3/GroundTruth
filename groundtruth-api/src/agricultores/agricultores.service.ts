import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';

const crearSchema = z.object({
  nombre: z.string().trim().min(1),
  email: z.string().trim().email(),
  fincaNombre: z.string().trim().min(1),
});

/** Agricultores de la unidad (O5). Un agricultor = usuario dueño de finca(s). */
@Injectable()
export class AgricultoresService {
  constructor(private readonly db: DbService) {}

  list(operadorId: string) {
    return this.db
      .query<any>(
        `
        select u.id, u.nombre, u.email,
               count(distinct f.id) as fincas,
               count(distinct p.id) as parcelas,
               string_agg(distinct f.nombre, ', ') as finca_nombres
        from fincas f
        join usuarios u on u.id = f.agricultor_id
        left join parcelas p on p.finca_id = f.id
        where f.operador_id = $1
        group by u.id
        order by u.nombre
        `,
        [operadorId],
      )
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          nombre: r.nombre,
          email: r.email,
          finca: r.finca_nombres,
          parcelas: Number(r.parcelas),
        })),
      );
  }

  /**
   * Alta de agricultor: crea el usuario y su finca en la unidad. El `auth_user_id`
   * es un placeholder hasta que exista el flujo de invitación (Supabase Auth):
   * el agricultor aún no puede iniciar sesión, pero el operador ya gestiona su
   * finca y parcelas. Auditado.
   */
  async crear(operadorId: string, actorId: string, body: unknown) {
    const { nombre, email, fincaNombre } = crearSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const existe = await tx.queryOne('select 1 from usuarios where email = $1', [email]);
      if (existe) throw DomainErrors.userExists();

      const pais = await tx.queryOne<{ pais: string }>('select pais from operadores where id = $1', [operadorId]);

      const usuario = await tx.queryOne<{ id: string }>(
        `insert into usuarios (auth_user_id, nombre, email, activo)
         values (gen_random_uuid(), $1, $2, true) returning id`,
        [nombre, email],
      );
      const finca = await tx.queryOne<{ id: string }>(
        `insert into fincas (operador_id, agricultor_id, nombre, pais)
         values ($1, $2, $3, $4) returning id`,
        [operadorId, usuario!.id, fincaNombre, pais?.pais ?? null],
      );
      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, $2, 'agricultor.crear', 'usuarios', $3, $4)`,
        [actorId, operadorId, usuario!.id, JSON.stringify({ nombre, email, finca: fincaNombre })],
      );
      return { id: usuario!.id, fincaId: finca!.id, nombre, email };
    });
  }
}
