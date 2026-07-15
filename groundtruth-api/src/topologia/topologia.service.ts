import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { DomainError, DomainErrors } from '@/common/domain-error';
import { poligonoAGeoJson } from './geo';

const M2_POR_HA = 10_000;

/** Punto del polígono tal como lo dibuja el mapa: [lat, lng] (orden de Leaflet). */
const puntoSchema = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);

const crearParcelaSchema = z.object({
  fincaId: z.string().uuid(),
  nombre: z.string().trim().min(1),
  cultivo: z.string().trim().min(1),
  poligono: z.array(puntoSchema).min(3),
  /** Identificadores de los nodos que se instalarán en la parcela. */
  nodos: z.array(z.string().trim().min(1)).default([]),
});

/** Fincas y parcelas de la unidad (O4/O6). Primer módulo de dominio real. */
@Injectable()
export class TopologiaService {
  constructor(private readonly db: DbService) {}

  /** Fincas de la unidad — el selector del alta de parcela. */
  async listFincas(operadorId: string) {
    const rows = await this.db.query<any>(
      `
      select f.id, f.nombre, u.nombre as agricultor,
             count(p.id) as parcelas
      from fincas f
      join usuarios u on u.id = f.agricultor_id
      left join parcelas p on p.finca_id = f.id
      where f.operador_id = $1
      group by f.id, f.nombre, u.nombre
      order by f.nombre
      `,
      [operadorId],
    );
    return rows.map((f) => ({
      id: f.id,
      nombre: f.nombre,
      agricultor: f.agricultor,
      parcelas: Number(f.parcelas),
    }));
  }

  /**
   * Alta de parcela (O4).
   *
   * El polígono se dibuja en el mapa, pero **el área la calcula PostGIS**, no el
   * navegador: de ella depende cuántos sensores exige la parcela, y esa regla no
   * puede vivir en el cliente. El gate de cobertura se impone **aquí** — la UI lo
   * refleja, pero quien lo hace cumplir es el servidor.
   *
   * Los nodos se crean CON la parcela: `nodos_sensores.parcela_id` es NOT NULL, así
   * que un nodo "libre" no existe en el modelo. Nacen SIMULADO; el hardware real se
   * asocia después por su `chirpstack_dev_eui` (mismo payload, cero cambios).
   *
   * NO abre ciclo de siembra: eso lo declara el agricultor desde su dApp. Una parcela
   * recién creada existe, pero no puede certificarse hasta que haya siembra.
   */
  async crearParcela(operadorId: string, body: unknown) {
    const { fincaId, nombre, cultivo, poligono, nodos } = crearParcelaSchema.parse(body);

    // La inversión [lat,lng]→[lng,lat] y el cierre del anillo viven en `geo.ts`,
    // con tests: confundir el orden no da error, muda la parcela de continente.
    const geojson = JSON.stringify(poligonoAGeoJson(poligono));

    return this.db.transaction(async (tx) => {
      const finca = await tx.queryOne<{ id: string }>(
        'select id from fincas where id = $1 and operador_id = $2',
        [fincaId, operadorId],
      );
      if (!finca) throw DomainErrors.notFound();

      const cul = await tx.queryOne<{ id: string }>('select id from cultivos where nombre = $1', [
        cultivo,
      ]);
      if (!cul) throw new DomainError('CROP_UNKNOWN', 'crop_required', 422);

      // Validez y área ANTES de insertar: un polígono que se cruza a sí mismo tiene
      // área, pero no describe ninguna parcela real.
      const geo = await tx.queryOne<{ valido: boolean; area_m2: string }>(
        `select st_isvalid(g) as valido,
                st_area(g::geography) as area_m2
         from (select st_setsrid(st_geomfromgeojson($1), 4326) as g) s`,
        [geojson],
      );
      if (!geo?.valido) throw new DomainError('INVALID_POLYGON', 'invalid_polygon', 422);

      const areaM2 = Number(geo.area_m2);
      if (areaM2 <= 0) throw new DomainError('INVALID_POLYGON', 'invalid_polygon', 422);

      // Cobertura de sensores: la densidad es un parámetro del sistema (lo edita el
      // Admin), no una constante del frontend.
      const p = await tx.queryOne<{ valor: string }>(
        `select valor from parametros_globales where clave = 'densidad_sensores_m2_default'`,
      );
      const densidad = Number(p?.valor ?? 20_000);
      const requeridos = Math.max(1, Math.ceil(areaM2 / densidad));
      if (nodos.length < requeridos) throw DomainErrors.sensorCoverageUnmet(requeridos);

      const parcela = await tx.queryOne<{ id: string; area_m2: string }>(
        `insert into parcelas (finca_id, cultivo_id, nombre, geom)
         values ($1, $2, $3, st_setsrid(st_geomfromgeojson($4), 4326))
         returning id, area_m2`,
        [fincaId, cul.id, nombre, geojson],
      );

      for (const externalId of nodos) {
        await tx.query(
          `insert into nodos_sensores (parcela_id, tipo_nodo, external_id, activo, instalado_en)
           values ($1, 'SIMULADO', $2, true, now())`,
          [parcela!.id, externalId],
        );
      }

      await tx.query(
        `insert into auditoria (operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, 'parcela.crear', 'parcelas', $2, $3)`,
        [
          operadorId,
          parcela!.id,
          JSON.stringify({ nombre, cultivo, areaHa: areaM2 / M2_POR_HA, nodos: nodos.length }),
        ],
      );

      return {
        id: parcela!.id,
        nombre,
        cultivo,
        areaHa: Number(parcela!.area_m2) / M2_POR_HA,
        sensores: nodos.length,
        sensoresRequeridos: requeridos,
      };
    });
  }

  listParcelas(operadorId: string) {
    return this.db.query(
      `
      select p.id,
             p.nombre,
             f.nombre                        as finca,
             f.agricultor_id                 as agricultor_id,
             c.nombre                        as cultivo,
             round(p.area_m2)                as area_m2,
             round(p.area_m2 / 10000.0, 2)   as area_ha,
             st_asgeojson(p.geom)::json      as geom,
             st_y(st_centroid(p.geom))       as centro_lat,
             st_x(st_centroid(p.geom))       as centro_lng,
             count(ns.id) filter (where ns.activo) as sensores,
             -- Antes: subconsulta correlacionada contra la tabla PARTICIONADA, una
             -- por parcela. Ahora es una columna que mantiene el disparador (0011).
             p.ultimo_estado
      from parcelas p
      join fincas f   on f.id = p.finca_id
      join cultivos c on c.id = p.cultivo_id
      left join nodos_sensores ns on ns.parcela_id = p.id
      where f.operador_id = $1
      group by p.id, f.nombre, f.agricultor_id, c.nombre
      order by p.nombre
      `,
      [operadorId],
    );
  }

  async getParcela(operadorId: string, parcelaId: string) {
    const parcela = await this.db.queryOne(
      `
      select p.id, p.nombre, f.nombre as finca, c.nombre as cultivo,
             round(p.area_m2 / 10000.0, 2) as area_ha,
             st_asgeojson(p.geom)::json as geom,
             st_y(st_centroid(p.geom)) as centro_lat,
             st_x(st_centroid(p.geom)) as centro_lng,
             (select count(*) from nodos_sensores ns where ns.parcela_id = p.id and ns.activo) as sensores
      from parcelas p
      join fincas f   on f.id = p.finca_id
      join cultivos c on c.id = p.cultivo_id
      where p.id = $2 and f.operador_id = $1
      `,
      [operadorId, parcelaId],
    );
    if (!parcela) throw DomainErrors.notFound();

    // Última lectura de telemetría (O6). Serie completa se agregará al conectar la gráfica.
    const telemetria = await this.db.queryOne(
      `
      select ph, ec_us_cm, humedad_suelo_pct, temp_suelo_prof1_c, temp_suelo_prof2_c, estado_evaluado
      from lecturas_telemetria
      where parcela_id = $1
      order by ts desc
      limit 1
      `,
      [parcelaId],
    );

    // Historial de ciclos; `certificado` = existe un certificado emitido en el ciclo.
    const ciclos = await this.db.query(
      `
      select cs.id, cs.fecha_inicio, cs.fecha_cierre,
             exists (
               select 1 from certificados c
               where c.ciclo_siembra_id = cs.id and c.estado <> 'DRAFT'
             ) as certificado
      from ciclos_siembra cs
      where cs.parcela_id = $1
      order by cs.fecha_inicio desc
      `,
      [parcelaId],
    );

    return { ...parcela, telemetria, ciclos };
  }
}
