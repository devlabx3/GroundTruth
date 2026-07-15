import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService, Tx } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';

const activoSchema = z.object({ activo: z.boolean() });

const generarSchema = z.object({
  parcelaId: z.string().uuid(),
  perfil: z.enum(['sano', 'degradado']),
  horas: z.coerce.number().int().min(1).max(72).default(24),
});

interface Umbral {
  min: number;
  max: number;
}

/**
 * Simulador IoT (A5). Los nodos SIMULADO producen la misma telemetría firmada
 * que producirá el hardware LoRaWAN: se evalúa contra `umbrales_eudr` y, si sale
 * ROJO, levanta la alerta que verá el agricultor en su dApp. El simulador no es
 * un juguete de demo — es el generador de la evidencia de la que cuelga todo.
 */
@Injectable()
export class AdminSimuladorService {
  constructor(private readonly db: DbService) {}

  async nodos() {
    const rows = await this.db.query<any>(
      `
      select n.id, n.tipo_nodo, n.activo, n.external_id,
             p.id as parcela_id, p.nombre as parcela,
             o.nombre as unidad,
             (select max(lt.ts) from lecturas_telemetria lt where lt.nodo_id = n.id) as ultima_lectura
      from nodos_sensores n
      join parcelas p   on p.id = n.parcela_id
      join fincas f     on f.id = p.finca_id
      join operadores o on o.id = f.operador_id
      order by o.nombre, p.nombre, n.external_id nulls last
      `,
    );
    return rows.map((n) => ({
      id: n.id,
      externalId: n.external_id,
      parcelaId: n.parcela_id,
      parcela: n.parcela,
      unidad: n.unidad,
      tipo: n.tipo_nodo,
      activo: n.activo,
      ultimaLectura: n.ultima_lectura,
    }));
  }

  async setActivo(actorId: string, id: string, body: unknown) {
    const { activo } = activoSchema.parse(body);
    const n = await this.db.queryOne<{ id: string }>(
      'select id from nodos_sensores where id = $1',
      [id],
    );
    if (!n) throw DomainErrors.notFound();
    await this.db.query('update nodos_sensores set activo = $2 where id = $1', [id, activo]);
    await this.db.query(
      `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_nuevo)
       values ($1, 'nodo.activar', 'nodos_sensores', $2, $3)`,
      [actorId, id, JSON.stringify({ activo })],
    );
    return { id, activo };
  }

  /**
   * Genera `horas` lecturas horarias para cada nodo activo de la parcela.
   * `sano` cae dentro de los umbrales del cultivo; `degradado` se sale a propósito
   * (y por tanto produce ROJO + alerta). Los valores se derivan de los umbrales
   * reales de la base, no de constantes: si el Admin cambia los umbrales, el
   * simulador cambia con ellos.
   */
  async generar(actorId: string, body: unknown) {
    const { parcelaId, perfil, horas } = generarSchema.parse(body);

    return this.db.transaction(async (tx) => {
      const parcela = await tx.queryOne<any>(
        `select p.id, p.cultivo_id, f.agricultor_id
         from parcelas p join fincas f on f.id = p.finca_id
         where p.id = $1`,
        [parcelaId],
      );
      if (!parcela) throw DomainErrors.notFound();

      const nodos = await tx.query<{ id: string }>(
        'select id from nodos_sensores where parcela_id = $1 and activo',
        [parcelaId],
      );
      if (nodos.length === 0) throw DomainErrors.sensorCoverageUnmet(1);

      const umbrales = await this.umbrales(tx, parcela.cultivo_id);
      let rojas = 0;

      for (const nodo of nodos) {
        for (let h = horas - 1; h >= 0; h--) {
          const ph = valor(umbrales.ph, perfil);
          const humedad = valor(umbrales.humedad, perfil);
          const verde =
            dentro(ph, umbrales.ph) && dentro(humedad, umbrales.humedad);
          if (!verde) rojas++;

          await tx.query(
            `insert into lecturas_telemetria
               (nodo_id, parcela_id, ts, ph, ec_us_cm, humedad_suelo_pct,
                temp_suelo_prof1_c, temp_suelo_prof2_c, estado_evaluado)
             values ($1, $2, now() - ($3 || ' hours')::interval, $4, $5, $6, $7, $8, $9)`,
            [
              nodo.id,
              parcelaId,
              h,
              ph.toFixed(2),
              ruido(950, 80).toFixed(2),
              humedad.toFixed(2),
              ruido(22, 1.5).toFixed(2),
              ruido(20, 1).toFixed(2),
              verde ? 'VERDE' : 'ROJO',
            ],
          );
        }
      }

      // Una alerta por generación degradada (no una por lectura: la bandeja del
      // agricultor sirve para actuar, no para ahogarse en ruido).
      if (perfil === 'degradado' && rojas > 0) {
        const ph = umbrales.ph.min - 0.4;
        await tx.query(
          `insert into alertas (parcela_id, agricultor_id, tipo, severidad, variable, valor, umbral_referencia, mensaje)
           values ($1, $2, 'IOT', 'ALERTA', 'ph', $3, $4, 'alerts.out_of_range')`,
          [parcelaId, parcela.agricultor_id, ph.toFixed(2), umbrales.ph.min],
        );
      }

      await tx.query(
        `insert into auditoria (actor_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, 'simulador.generar', 'parcelas', $2, $3)`,
        [actorId, parcelaId, JSON.stringify({ perfil, horas, nodos: nodos.length })],
      );

      return {
        parcelaId,
        perfil,
        lecturas: nodos.length * horas,
        estado: rojas > 0 ? 'alerta' : 'conforme',
      };
    });
  }

  private async umbrales(tx: Tx, cultivoId: string): Promise<{ ph: Umbral; humedad: Umbral }> {
    const rows = await tx.query<any>(
      `select variable, valor_min, valor_max from umbrales_eudr where cultivo_id = $1`,
      [cultivoId],
    );
    const map = Object.fromEntries(
      rows.map((r) => [r.variable, { min: Number(r.valor_min), max: Number(r.valor_max) }]),
    );
    return {
      ph: map['ph'] ?? { min: 5.5, max: 6.8 },
      humedad: map['humedad_suelo_pct'] ?? { min: 35, max: 60 },
    };
  }
}

const dentro = (v: number, u: Umbral) => v >= u.min && v <= u.max;

/** Ruido gaussiano ligero alrededor de una media. */
function ruido(media: number, desv: number): number {
  return media + (Math.random() + Math.random() + Math.random() - 1.5) * desv;
}

/** Dentro del rango (sano) o claramente por debajo del mínimo (degradado). */
function valor(u: Umbral, perfil: 'sano' | 'degradado'): number {
  if (perfil === 'sano') {
    const centro = (u.min + u.max) / 2;
    const margen = (u.max - u.min) / 2;
    const v = ruido(centro, margen * 0.35);
    return Math.min(u.max, Math.max(u.min, v));
  }
  const caida = Math.max(0.3, (u.max - u.min) * 0.2);
  return u.min - caida - Math.random() * caida;
}
