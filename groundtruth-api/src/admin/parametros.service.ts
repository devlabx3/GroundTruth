import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService, Tx } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';

const M2_POR_HA = 10_000;

const cultivoSchema = z.object({
  vigenciaDias: z.coerce.number().int().positive(),
  phMin: z.coerce.number(),
  phMax: z.coerce.number(),
  humedadMin: z.coerce.number(),
  humedadMax: z.coerce.number(),
});

const patchSchema = z.object({
  tarifas: z.object({
    certificacionUsdc: z.coerce.number().nonnegative(),
    manifiestoUsdc: z.coerce.number().nonnegative(),
  }),
  haPorSensor: z.coerce.number().positive(),
  cultivos: z.record(z.string(), cultivoSchema),
});

/**
 * Parámetros del sistema (A4): tarifas, densidad de sensores, vigencia y umbrales.
 *
 * Nada de esto vive on-chain ni se hardcodea: `embarques.certificar` lee estas
 * mismas filas al cobrar y al fijar la vigencia, así que editarlas aquí cambia
 * el negocio de verdad. Los umbrales son provisionales por diseño (a calibrar
 * en terreno), y por eso son configurables.
 */
@Injectable()
export class AdminParametrosService {
  constructor(private readonly db: DbService) {}

  async get() {
    const globales = await this.db.query<{ clave: string; valor: string }>(
      'select clave, valor from parametros_globales',
    );
    const g = Object.fromEntries(globales.map((r) => [r.clave, Number(r.valor)]));

    const cultivos = await this.db.query<any>(
      `
      select c.id, c.nombre,
             (select valor from parametros_cultivo pc
               where pc.cultivo_id = c.id and pc.clave = 'vigencia_max_dias') as vigencia_dias,
             (select valor_min from umbrales_eudr u where u.cultivo_id = c.id and u.variable = 'ph') as ph_min,
             (select valor_max from umbrales_eudr u where u.cultivo_id = c.id and u.variable = 'ph') as ph_max,
             (select valor_min from umbrales_eudr u where u.cultivo_id = c.id and u.variable = 'humedad_suelo_pct') as hum_min,
             (select valor_max from umbrales_eudr u where u.cultivo_id = c.id and u.variable = 'humedad_suelo_pct') as hum_max
      from cultivos c
      order by c.nombre
      `,
    );

    return {
      tarifas: {
        certificacionUsdc: g['tarifa_certificacion_usdc'] ?? 0,
        manifiestoUsdc: g['tarifa_manifiesto_usdc'] ?? 0,
      },
      haPorSensor: (g['densidad_sensores_m2_default'] ?? 0) / M2_POR_HA,
      cultivos: Object.fromEntries(
        cultivos.map((c) => [
          c.nombre,
          {
            vigenciaDias: Number(c.vigencia_dias ?? 0),
            phMin: Number(c.ph_min ?? 0),
            phMax: Number(c.ph_max ?? 0),
            humedadMin: Number(c.hum_min ?? 0),
            humedadMax: Number(c.hum_max ?? 0),
          },
        ]),
      ),
    };
  }

  async update(actorId: string, body: unknown) {
    const next = patchSchema.parse(body);

    // Rangos: min < max y valores plausibles (el check de la tabla también lo
    // exige, pero preferimos el 422 de dominio a un error crudo de Postgres).
    for (const u of Object.values(next.cultivos)) {
      if (u.phMin >= u.phMax || u.humedadMin >= u.humedadMax) {
        throw DomainErrors.paramOutOfRange();
      }
      if (u.phMin < 0 || u.phMax > 14 || u.humedadMin < 0 || u.humedadMax > 100) {
        throw DomainErrors.paramOutOfRange();
      }
    }

    const prev = await this.get();

    return this.db.transaction(async (tx) => {
      await this.setGlobal(tx, 'tarifa_certificacion_usdc', next.tarifas.certificacionUsdc, actorId);
      await this.setGlobal(tx, 'tarifa_manifiesto_usdc', next.tarifas.manifiestoUsdc, actorId);
      await this.setGlobal(
        tx,
        'densidad_sensores_m2_default',
        next.haPorSensor * M2_POR_HA,
        actorId,
      );

      for (const [cultivo, u] of Object.entries(next.cultivos)) {
        const c = await tx.queryOne<{ id: string }>(
          'select id from cultivos where nombre = $1',
          [cultivo],
        );
        if (!c) throw DomainErrors.notFound();

        await tx.query(
          `insert into parametros_cultivo (cultivo_id, clave, valor)
           values ($1, 'vigencia_max_dias', $2)
           on conflict (cultivo_id, clave) do update set valor = excluded.valor`,
          [c.id, u.vigenciaDias],
        );
        await this.setUmbral(tx, c.id, 'ph', u.phMin, u.phMax);
        await this.setUmbral(tx, c.id, 'humedad_suelo_pct', u.humedadMin, u.humedadMax);
      }

      // Una sola entrada de bitácora por guardado, con el antes/después completo:
      // el diff campo a campo lo hace quien lea la auditoría, no 20 filas sueltas.
      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, valor_anterior, valor_nuevo)
         values ($1, 'parametro.actualizar', 'parametros_globales', $2, $3)`,
        [actorId, JSON.stringify(prev), JSON.stringify(next)],
      );

      return next;
    });
  }

  /** Bitácora versionada (A4): todo cambio de parámetros, quién y cuándo. */
  async auditoria() {
    const rows = await this.db.query<any>(
      `
      select a.id, a.created_at, a.valor_anterior, a.valor_nuevo,
             coalesce(u.nombre, 'Sistema') as quien
      from auditoria a
      left join usuarios u on u.id = a.actor_id
      where a.accion = 'parametro.actualizar'
      order by a.created_at desc
      limit 50
      `,
    );
    return rows.map((r) => ({
      id: r.id,
      fecha: r.created_at,
      quien: r.quien,
      cambios: diff(r.valor_anterior, r.valor_nuevo),
    }));
  }

  private async setGlobal(tx: Tx, clave: string, valor: number, actorId: string) {
    await tx.query(
      `update parametros_globales
         set valor = $2, actualizado_por = $3, actualizado_en = now()
       where clave = $1`,
      [clave, valor, actorId],
    );
  }

  private async setUmbral(tx: Tx, cultivoId: string, variable: string, min: number, max: number) {
    await tx.query(
      `insert into umbrales_eudr (cultivo_id, variable, valor_min, valor_max)
       values ($1, $2, $3, $4)
       on conflict (cultivo_id, variable)
       do update set valor_min = excluded.valor_min, valor_max = excluded.valor_max`,
      [cultivoId, variable, min, max],
    );
  }
}

/** Aplana antes/después a una lista de campos que cambiaron (para la bitácora). */
function diff(antes: any, despues: any): { campo: string; antes: string; despues: string }[] {
  const out: { campo: string; antes: string; despues: string }[] = [];
  const walk = (a: any, b: any, path: string) => {
    if (b == null || typeof b !== 'object') {
      if (String(a) !== String(b)) out.push({ campo: path, antes: String(a), despues: String(b) });
      return;
    }
    for (const k of Object.keys(b)) walk(a?.[k], b[k], path ? `${path}.${k}` : k);
  };
  walk(antes, despues, '');
  return out;
}
