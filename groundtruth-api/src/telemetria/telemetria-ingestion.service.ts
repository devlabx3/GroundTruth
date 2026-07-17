import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService, Tx } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';

/**
 * Ingesta de telemetría (Bloque 2). **Un solo punto de entrada** para toda
 * lectura de sensor, venga del hardware LoRaWAN real (vía `POST /telemetria/ingest`)
 * o del simulador IoT (en proceso, vía `ingestarEnTx`). La evaluación contra
 * `umbrales_eudr`, la persistencia y el alertado son idénticos para ambos: así,
 * cuando llegue el hardware, solo se apaga el simulador — no se reescribe nada.
 *
 * La procedencia (simulado vs. físico) NO vive aquí: es el `tipo_nodo` del nodo
 * (`nodos_sensores`), ya expuesto como `fuente_simulada`. Una lectura simulada,
 * además, llega sin firmar (`firma_hex IS NULL`).
 *
 * No toca `parcelas.ultimo_estado`: lo hace el trigger `trg_parcela_semaforo`
 * al insertar cada lectura (migración 0011).
 */
const valoresSchema = z.object({
  ph: z.coerce.number().min(0).max(14).optional(),
  ec_us_cm: z.coerce.number().min(0).max(20_000).optional(),
  humedad_suelo_pct: z.coerce.number().min(0).max(100).optional(),
  temp_suelo_prof1_c: z.coerce.number().min(-20).max(80).optional(),
  temp_suelo_prof2_c: z.coerce.number().min(-20).max(80).optional(),
});

/** Payload público compatible con ChirpStack (Arquitectura-Tecnica-MVP §5.1). */
const ingestSchema = z.object({
  node_id: z.string().min(1),
  parcela_id: z.string().uuid().optional(),
  ts: z.string().datetime().optional(),
  firma: z.string().optional(),
  lecturas: valoresSchema,
});

export interface Umbral {
  min: number;
  max: number;
}

export interface LecturaValores {
  ph?: number;
  ec_us_cm?: number;
  humedad_suelo_pct?: number;
  temp_suelo_prof1_c?: number;
  temp_suelo_prof2_c?: number;
}

/** Lectura ya resuelta a IDs de dominio — lo que el core persiste. */
export interface LecturaResuelta {
  nodoId: string;
  parcelaId: string;
  ts: Date;
  valores: LecturaValores;
  firma?: string | null;
}

export interface ResultadoLectura {
  id: string;
  parcelaId: string;
  estado: 'VERDE' | 'ROJO';
}

export interface ResultadoIngesta {
  resultados: ResultadoLectura[];
  rojas: number;
}

const dentro = (v: number, u: Umbral) => v >= u.min && v <= u.max;

@Injectable()
export class TelemetriaIngestionService {
  constructor(private readonly db: DbService) {}

  /**
   * Ingesta una lectura suelta (camino del hardware real). Resuelve el nodo por
   * `external_id` / `chirpstack_dev_eui` / uuid, y persiste en su propia
   * transacción.
   */
  async ingest(payload: unknown): Promise<{ id: string; estado: 'VERDE' | 'ROJO' }> {
    const { node_id, parcela_id, ts, firma, lecturas } = ingestSchema.parse(payload);

    const nodo = await this.db.queryOne<{ id: string; parcela_id: string }>(
      `select id, parcela_id from nodos_sensores
       where activo and (external_id = $1 or chirpstack_dev_eui = $1 or id::text = $1)
       limit 1`,
      [node_id],
    );
    if (!nodo) throw DomainErrors.notFound();
    // Un payload puede afirmar una parcela; si no coincide con la del nodo, no se
    // acepta la afirmación (el nodo es la fuente de verdad de a qué parcela mide).
    if (parcela_id && parcela_id !== nodo.parcela_id) throw DomainErrors.notFound();

    const reading: LecturaResuelta = {
      nodoId: nodo.id,
      parcelaId: nodo.parcela_id,
      ts: ts ? new Date(ts) : new Date(),
      valores: lecturas,
      firma: firma ?? null,
    };

    const { resultados } = await this.db.transaction((tx) => this.ingestarEnTx(tx, [reading]));
    return { id: resultados[0].id, estado: resultados[0].estado };
  }

  /**
   * Core reutilizable: persiste N lecturas dentro de una transacción ya abierta.
   * El simulador lo llama en su propia transacción para poder añadir su auditoría
   * de forma atómica (este backend no soporta transacciones anidadas).
   *
   * Agrupa por parcela: carga `umbrales` una sola vez por parcela y aplica la
   * política de alerta (una alerta por parcela, solo en la transición a ROJO —
   * la bandeja del agricultor sirve para actuar, no para ahogarse en ruido).
   */
  async ingestarEnTx(tx: Tx, readings: LecturaResuelta[]): Promise<ResultadoIngesta> {
    const resultados: ResultadoLectura[] = [];
    let rojas = 0;

    const porParcela = new Map<string, LecturaResuelta[]>();
    for (const r of readings) {
      const lista = porParcela.get(r.parcelaId) ?? [];
      lista.push(r);
      porParcela.set(r.parcelaId, lista);
    }

    for (const [parcelaId, lecturas] of porParcela) {
      const parcela = await tx.queryOne<{
        cultivo_id: string;
        agricultor_id: string;
        ultimo_estado: string | null;
      }>(
        `select p.cultivo_id, f.agricultor_id, p.ultimo_estado
         from parcelas p join fincas f on f.id = p.finca_id
         where p.id = $1`,
        [parcelaId],
      );
      if (!parcela) throw DomainErrors.notFound();

      const umbrales = await this.umbrales(tx, parcela.cultivo_id);
      const estadoPrevio = parcela.ultimo_estado;
      let primeraBrecha: { variable: string; valor: number; umbral: number } | null = null;

      for (const l of lecturas) {
        const { estado, brecha } = this.evaluar(l.valores, umbrales);
        if (estado === 'ROJO') {
          rojas++;
          if (!primeraBrecha && brecha) primeraBrecha = brecha;
        }

        const fila = await tx.queryOne<{ id: string }>(
          `insert into lecturas_telemetria
             (nodo_id, parcela_id, ts, ph, ec_us_cm, humedad_suelo_pct,
              temp_suelo_prof1_c, temp_suelo_prof2_c, firma_hex, estado_evaluado)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           returning id`,
          [
            l.nodoId,
            parcelaId,
            l.ts,
            num(l.valores.ph),
            num(l.valores.ec_us_cm),
            num(l.valores.humedad_suelo_pct),
            num(l.valores.temp_suelo_prof1_c),
            num(l.valores.temp_suelo_prof2_c),
            l.firma ?? null,
            estado,
          ],
        );
        resultados.push({ id: fila!.id, parcelaId, estado });
      }

      // Alerta solo en la transición VERDE→ROJO: si la parcela ya estaba ROJO no
      // se repite, y si sigue VERDE no se levanta ninguna.
      if (primeraBrecha && estadoPrevio !== 'ROJO') {
        await tx.query(
          `insert into alertas (parcela_id, agricultor_id, tipo, severidad, variable, valor, umbral_referencia, mensaje)
           values ($1, $2, 'IOT', 'ALERTA', $3, $4, $5, 'alerts.out_of_range')`,
          [
            parcelaId,
            parcela.agricultor_id,
            primeraBrecha.variable,
            primeraBrecha.valor.toFixed(2),
            primeraBrecha.umbral,
          ],
        );
      }
    }

    return { resultados, rojas };
  }

  /**
   * Evalúa el semáforo. Solo `ph` y `humedad_suelo_pct` deciden VERDE/ROJO (ec y
   * temperaturas son contexto, no criterio EUDR). Un valor ausente no dispara ROJO
   * —no se puede evaluar lo que no llega—; uno presente y fuera de rango sí.
   */
  private evaluar(
    valores: LecturaValores,
    umbrales: { ph: Umbral; humedad: Umbral },
  ): { estado: 'VERDE' | 'ROJO'; brecha: { variable: string; valor: number; umbral: number } | null } {
    const { ph, humedad_suelo_pct: humedad } = valores;

    if (ph != null && !dentro(ph, umbrales.ph)) {
      const umbral = ph < umbrales.ph.min ? umbrales.ph.min : umbrales.ph.max;
      return { estado: 'ROJO', brecha: { variable: 'ph', valor: ph, umbral } };
    }
    if (humedad != null && !dentro(humedad, umbrales.humedad)) {
      const umbral = humedad < umbrales.humedad.min ? umbrales.humedad.min : umbrales.humedad.max;
      return {
        estado: 'ROJO',
        brecha: { variable: 'humedad_suelo_pct', valor: humedad, umbral },
      };
    }
    return { estado: 'VERDE', brecha: null };
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

/** Redondea a 2 decimales (numeric del esquema) o null si el valor no viene. */
function num(v: number | undefined): string | null {
  return v == null ? null : v.toFixed(2);
}
