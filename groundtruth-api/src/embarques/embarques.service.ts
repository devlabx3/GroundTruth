import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService, Tx } from '@/db/db.service';
import { DomainError, DomainErrors } from '@/common/domain-error';
import { SolanaService, type ResultadoCertify } from '@/solana/solana.service';
import { EvidenciaService, type Evidencia } from '@/evidencia/evidencia.service';

const MICRO = 1_000_000;
/** Hash ausente: 32 bytes en cero. Nunca un hash inventado. */
const CEROS64 = '0'.repeat(64);

/**
 * Traduce un fallo del programa Anchor al error de dominio que el frontend sabe
 * mostrar. Sin esto, un "custom program error: 0x1772" llegaría crudo a la UI.
 */
function mapearErrorDeCadena(e: unknown): DomainError {
  const texto = String((e as Error)?.message ?? e);
  if (/InsufficientFunds|insufficient funds|0x1772/i.test(texto)) {
    return DomainErrors.treasuryInsufficientFunds();
  }
  if (/OperatorInactive/i.test(texto)) return DomainErrors.unitNotActive();
  if (/FeeExceedsCap/i.test(texto)) return DomainErrors.paramOutOfRange();
  if (/already in use|AccountAlreadyInitialized/i.test(texto)) {
    // El CertificateRecord ya existe: el certificado estaba minteado. Es
    // recuperable — el reintento lo reconcilia leyéndolo de la cadena.
    return DomainErrors.certAlreadyExists();
  }
  // Fallo de red/RPC: reintentable, no es culpa del usuario.
  return new DomainError('ONCHAIN_FAILED', 'onchain_failed', 502, true);
}
const ESTADO_UI: Record<string, string> = {
  BORRADOR: 'borrador',
  LISTO_APROBACION: 'listo',
  PROCESANDO: 'procesando',
  EMITIDO: 'emitido',
  FALLIDO: 'fallido',
};

const createSchema = z.object({
  parcelaIds: z.array(z.string().uuid()).min(1),
});

@Injectable()
export class EmbarquesService {
  constructor(
    private readonly db: DbService,
    private readonly solana: SolanaService,
    private readonly evidencia: EvidenciaService,
  ) {}

  async list(operadorId: string) {
    const rows = await this.db.query(
      `
      select e.id, c.nombre as cultivo, e.estado, e.created_at as fecha,
             count(ep.parcela_id) as num_parcelas
      from embarques e
      join cultivos c on c.id = e.cultivo_id
      left join embarque_parcelas ep on ep.embarque_id = e.id
      where e.operador_id = $1
      group by e.id, c.nombre
      order by e.created_at desc
      `,
      [operadorId],
    );
    return rows.map((r: any) => ({
      id: r.id,
      cultivo: r.cultivo,
      estado: ESTADO_UI[r.estado],
      fecha: r.fecha,
      numParcelas: Number(r.num_parcelas),
    }));
  }

  async detail(operadorId: string, id: string) {
    const emb = await this.db.queryOne<any>(
      `
      select e.id, c.nombre as cultivo, e.estado, e.created_at as fecha
      from embarques e
      join cultivos c on c.id = e.cultivo_id
      where e.id = $1 and e.operador_id = $2
      `,
      [id, operadorId],
    );
    if (!emb) throw DomainErrors.notFound();

    const parcelas = await this.db.query<any>(
      `
      select p.id, p.nombre, cu.nombre as cultivo, ep.es_nuevo,
             cert.id as certificado_id, cert.numero_publico, cert.estado as cert_estado,
             p.ultimo_estado
      from embarque_parcelas ep
      join parcelas p   on p.id = ep.parcela_id
      join cultivos cu  on cu.id = p.cultivo_id
      join certificados cert on cert.id = ep.certificado_id
      where ep.embarque_id = $1
      order by p.nombre
      `,
      [id],
    );

    const tarifas = await this.tarifas();
    const nuevos = parcelas.filter((p) => p.es_nuevo).length;
    const reutilizados = parcelas.length - nuevos;
    const estadoTel = (e: string | null) =>
      e === 'VERDE' ? 'conforme' : e === 'ROJO' ? 'alerta' : 'pendiente';

    return {
      id: emb.id,
      cultivo: emb.cultivo,
      estado: ESTADO_UI[emb.estado],
      fecha: emb.fecha,
      parcelas: parcelas.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        cultivo: p.cultivo,
        esNuevo: p.es_nuevo,
        estado: estadoTel(p.ultimo_estado),
        certificada: p.cert_estado === 'ACTIVE',
        numeroPublico: p.numero_publico,
      })),
      // Certificados ya emitidos (para la vista "emitido").
      certificados: parcelas
        .filter((p) => p.cert_estado === 'ACTIVE')
        .map((p) => ({
          id: p.certificado_id,
          numeroPublico: p.numero_publico,
          estado: p.cert_estado,
          parcela: p.nombre,
        })),
      costo: {
        nuevos,
        reutilizados,
        certUsdc: nuevos * tarifas.cert,
        manifiestoUsdc: tarifas.manifiesto,
        totalUsdc: nuevos * tarifas.cert + tarifas.manifiesto,
      },
    };
  }

  /** Prepara un borrador (O7). Regla de unicidad de cultivo + pertenencia. */
  async create(operadorId: string, userId: string, body: unknown, privileges: string[] = []) {
    const { parcelaIds } = createSchema.parse(body);
    const estado = privileges.includes('certificados.emitir') ? 'BORRADOR' : 'LISTO_APROBACION';

    return this.db.transaction(async (tx) => {
      // Parcelas de la unidad + su cultivo + ciclo activo + último estado.
      const parcelas = await tx.query<any>(
        `
        select p.id, p.cultivo_id, cu.nombre as cultivo,
               (select cs.id from ciclos_siembra cs
                 where cs.parcela_id = p.id and cs.estado = 'ACTIVO'
                 order by cs.fecha_inicio desc limit 1) as ciclo_id,
               p.ultimo_estado
        from parcelas p
        join fincas f on f.id = p.finca_id
        join cultivos cu on cu.id = p.cultivo_id
        where p.id = any($1) and f.operador_id = $2
        `,
        [parcelaIds, operadorId],
      );

      if (parcelas.length !== parcelaIds.length) throw DomainErrors.notFound();

      // Unicidad de cultivo (Errores §5.4).
      const cultivos = new Set(parcelas.map((p) => p.cultivo_id));
      if (cultivos.size > 1) throw DomainErrors.cropMismatch();

      // Ninguna parcela en anomalía (roja) puede certificarse.
      if (parcelas.some((p) => p.ultimo_estado === 'ROJO')) {
        throw new DomainError('PARCEL_ANOMALY', 'parcel_anomaly', 422);
      }

      // Toda parcela necesita un ciclo activo para poder certificar.
      if (parcelas.some((p) => !p.ciclo_id)) {
        throw new DomainError('NO_ACTIVE_CYCLE', 'no_active_cycle', 422);
      }

      const cultivoId = parcelas[0].cultivo_id;
      const emb = await tx.queryOne<{ id: string }>(
        `insert into embarques (operador_id, cultivo_id, estado, creado_por)
         values ($1, $2, $3, $4) returning id`,
        [operadorId, cultivoId, estado, userId],
      );
      const embarqueId = emb!.id;

      // Por parcela: reusar cert ACTIVE del ciclo, o crear DRAFT (se mintea al certificar).
      for (const p of parcelas) {
        const existente = await tx.queryOne<{ id: string }>(
          `select id from certificados
           where parcela_id = $1 and ciclo_siembra_id = $2 and estado = 'ACTIVE'`,
          [p.id, p.ciclo_id],
        );
        let certificadoId: string;
        let esNuevo: boolean;
        if (existente) {
          certificadoId = existente.id;
          esNuevo = false;
        } else {
          const draft = await tx.queryOne<{ id: string }>(
            `insert into certificados (parcela_id, ciclo_siembra_id, estado)
             values ($1, $2, 'DRAFT')
             on conflict (parcela_id, ciclo_siembra_id) do update set estado = certificados.estado
             returning id`,
            [p.id, p.ciclo_id],
          );
          certificadoId = draft!.id;
          esNuevo = true;
        }
        await tx.query(
          `insert into embarque_parcelas (embarque_id, parcela_id, certificado_id, es_nuevo)
           values ($1, $2, $3, $4)`,
          [embarqueId, p.id, certificadoId, esNuevo],
        );
      }

      return { id: embarqueId };
    });
  }

  /**
   * Certifica el embarque (saga, mitigación F4).
   *
   * Con Solana configurada emite de verdad: cobra USDC de la Treasury PDA y
   * mintea un cNFT por parcela nueva, todo en UNA transacción de cadena. Sin
   * configurar, cae a la ruta pre-Solana (transacción DB que imita los efectos),
   * para que el sistema siga usable en local/demo.
   *
   * Idempotente en ambos casos: si el embarque ya está EMITIDO, devuelve sus
   * certificados sin volver a cobrar.
   */
  async certificar(operadorId: string, userId: string, id: string) {
    if (this.solana.isEnabled()) {
      return this.certificarOnchain(operadorId, userId, id);
    }
    return this.certificarEnBd(operadorId, userId, id);
  }

  /**
   * Saga on-chain en tres fases. Las dos escrituras en BD son transaccionales; lo
   * único que queda "en el aire" es el envío a la cadena, y para eso está el saga:
   *
   *  1. **Preparar** (BD): valida, reserva números públicos, marca PROCESANDO.
   *  2. **Emitir** (cadena): una TX con N `certify` + 1 `emit_manifest`. Atómica.
   *  3. **Reconciliar** (BD): guarda asset IDs, firma real y el saldo LEÍDO de la
   *     cadena (no un resta optimista: la fuente de verdad es el ATA).
   *
   * Si la fase 2 falla, la 3 no ocurre y no se cobra nada: el embarque vuelve a
   * BORRADOR y el saga queda FAILED reintentable (el Admin lo reintenta desde su
   * vista, y el reintento reconcilia en vez de duplicar).
   */
  private async certificarOnchain(operadorId: string, userId: string, id: string) {
    // --- Fase 1: preparar ---
    const plan = await this.db.transaction(async (tx) => {
      const emb = await tx.queryOne<any>(
        `select id, estado, cultivo_id from embarques where id = $1 and operador_id = $2 for update`,
        [id, operadorId],
      );
      if (!emb) throw DomainErrors.notFound();
      if (emb.estado === 'EMITIDO') return null; // ya emitido: nada que hacer

      const op = await tx.queryOne<{ estado: string }>(
        'select estado from operadores where id = $1',
        [operadorId],
      );
      if (op?.estado !== 'ACTIVO') throw DomainErrors.unitNotActive();

      const parcelas = await tx.query<any>(
        `select ep.parcela_id, ep.certificado_id, ep.es_nuevo,
                c.ciclo_siembra_id, c.numero_publico, p.finca_id
         from embarque_parcelas ep
         join certificados c on c.id = ep.certificado_id
         join parcelas p on p.id = ep.parcela_id
         where ep.embarque_id = $1`,
        [id],
      );
      const tarifas = await this.tarifas(tx, emb.cultivo_id);
      const nuevos = parcelas.filter((p) => p.es_nuevo);

      // El número público es el nombre del cNFT, así que hace falta ANTES de
      // mintear. Se reserva sobre el certificado DRAFT: si la cadena falla, el
      // reintento reutiliza el mismo número en vez de quemar uno nuevo.
      for (const p of nuevos) {
        if (p.numero_publico) continue;
        p.numero_publico = await this.siguienteNumero(tx);
        await tx.query('update certificados set numero_publico = $2 where id = $1', [
          p.certificado_id,
          p.numero_publico,
        ]);
      }

      await tx.query(`update embarques set estado = 'PROCESANDO' where id = $1`, [id]);
      await tx.query(
        `insert into saga_certificacion (embarque_id, estado, paso_actual, reintentable, actualizado_en)
         values ($1, 'CERT_PENDING', 'tx_solana', true, now())`,
        [id],
      );
      return { nuevos, tarifas };
    });

    if (!plan) {
      // Ya estaba EMITIDO (idempotencia).
      return this.db.transaction((tx) => this.resultado(tx, id, operadorId));
    }

    // --- Fase 2: evidencia + emisión en la cadena ---
    let onchain: ResultadoCertify;
    const evidencias: Record<string, Evidencia> = {};
    try {
      // La evidencia va ANTES del mint: su URI y sus hashes son lo que queda
      // grabado en el cNFT. Construirla después sería anclar una promesa.
      for (const p of plan.nuevos) {
        evidencias[p.parcela_id] = await this.evidencia.construir(
          p.parcela_id,
          p.ciclo_siembra_id,
          p.numero_publico,
          plan.tarifas.vigenciaDias,
        );
      }

      await this.solana.asegurarIdentidades(
        operadorId,
        plan.nuevos.map((p: any) => ({ parcelaId: p.parcela_id, fincaId: p.finca_id })),
      );
      onchain = await this.solana.certificarEmbarque(
        operadorId,
        id,
        plan.nuevos.map((p: any) => ({
          parcelaId: p.parcela_id,
          cicloId: p.ciclo_siembra_id,
          fincaId: p.finca_id,
          numeroPublico: p.numero_publico,
          geojsonUri: evidencias[p.parcela_id].geojsonUri,
          hashPdf: evidencias[p.parcela_id].hashPdf,
          hashImagen: evidencias[p.parcela_id].hashImagen,
        })),
        Math.round(plan.tarifas.cert * MICRO),
        Math.round(plan.tarifas.manifiesto * MICRO),
      );
    } catch (e) {
      const err = mapearErrorDeCadena(e);
      await this.db.transaction(async (tx) => {
        await tx.query(`update embarques set estado = 'BORRADOR' where id = $1`, [id]);
        await tx.query(
          `update saga_certificacion
             set estado = 'FAILED', error_detalle = $2, reintentable = true,
                 intentos = intentos + 1, actualizado_en = now()
           where embarque_id = $1`,
          [id, err.messageKey],
        );
      });
      throw err;
    }

    // --- Fase 3: reconciliar ---
    return this.db.transaction(async (tx) => {
      for (const p of plan.nuevos) {
        const ev = evidencias[p.parcela_id];
        await tx.query(
          `update certificados
             set estado = 'ACTIVE', emitido_en = now(),
                 vigente_hasta = now() + ($3 || ' days')::interval,
                 cnft_asset_id = $2,
                 uri_geojson_arweave = $4,
                 hash_pdf = $5, hash_imagen = $6,
                 storage_path_pdf = $7, evidencia_id = $8
           where id = $1`,
          [
            p.certificado_id,
            onchain.assets[p.parcela_id],
            plan.tarifas.vigenciaDias,
            ev.geojsonUri,
            ev.hashPdf === CEROS64 ? null : ev.hashPdf,
            ev.hashImagen === CEROS64 ? null : ev.hashImagen,
            ev.storagePathPdf,
            ev.evidenciaId,
          ],
        );
      }

      const tes = await tx.queryOne<{ id: string }>(
        'select id from tesorerias where operador_id = $1 for update',
        [operadorId],
      );
      if (tes) {
        const certMicro = Math.round(plan.nuevos.length * plan.tarifas.cert * MICRO);
        const manMicro = Math.round(plan.tarifas.manifiesto * MICRO);
        // Los dos débitos comparten firma (van en la misma TX), pero la columna es
        // única: se distinguen con un sufijo. La firma real es la parte previa a '#'.
        if (plan.nuevos.length > 0) {
          await tx.query(
            `insert into movimientos_tesoreria (tesoreria_id, tipo, monto, tx_signature, embarque_id, confirmado_en)
             values ($1, 'DEBITO_CERTIFICACION', $2, $3, $4, now())
             on conflict (tx_signature) do nothing`,
            [tes.id, -certMicro, `${onchain.signature}#cert`, id],
          );
        }
        await tx.query(
          `insert into movimientos_tesoreria (tesoreria_id, tipo, monto, tx_signature, embarque_id, confirmado_en)
           values ($1, 'DEBITO_MANIFIESTO', $2, $3, $4, now())
           on conflict (tx_signature) do nothing`,
          [tes.id, -manMicro, `${onchain.signature}#manifiesto`, id],
        );
        // El saldo NO se resta: se toma el que dice la cadena (el ATA es la verdad;
        // `saldo_cache` es solo un espejo, y así no puede derivar).
        await tx.query(
          'update tesorerias set saldo_cache = $2, actualizado_en = now() where id = $1',
          [tes.id, onchain.saldoMicro],
        );
      }

      await tx.query(
        `update embarques
           set estado = 'EMITIDO', aprobado_por = $2, emitido_en = now(),
               tarifa_manifiesto_cobrada = $3, tx_manifest_signature = $4
         where id = $1`,
        [id, userId, Math.round(plan.tarifas.manifiesto * MICRO), onchain.signature],
      );
      await tx.query(
        `update saga_certificacion
           set estado = 'ONCHAIN_CONFIRMED', paso_actual = 'completado',
               error_detalle = null, reintentable = false, actualizado_en = now()
         where embarque_id = $1`,
        [id],
      );

      return this.resultado(tx, id, operadorId);
    });
  }

  /** Ruta pre-Solana: transacción DB que imita los efectos on-chain (sin cadena). */
  private async certificarEnBd(operadorId: string, userId: string, id: string) {
    return this.db.transaction(async (tx) => {
      const emb = await tx.queryOne<any>(
        `select id, estado, cultivo_id from embarques where id = $1 and operador_id = $2 for update`,
        [id, operadorId],
      );
      if (!emb) throw DomainErrors.notFound();
      if (emb.estado === 'EMITIDO') {
        return this.resultado(tx, id, operadorId);
      }

      // Una unidad suspendida (o aún sin tesorería on-chain) no emite: la
      // suspensión del Admin tiene que morder aquí, no ser solo una etiqueta.
      const op = await tx.queryOne<{ estado: string }>(
        'select estado from operadores where id = $1',
        [operadorId],
      );
      if (op?.estado !== 'ACTIVO') throw DomainErrors.unitNotActive();

      const parcelas = await tx.query<any>(
        `select ep.parcela_id, ep.certificado_id, ep.es_nuevo, c.ciclo_siembra_id, p.cultivo_id
         from embarque_parcelas ep
         join certificados c on c.id = ep.certificado_id
         join parcelas p on p.id = ep.parcela_id
         where ep.embarque_id = $1`,
        [id],
      );

      const tarifas = await this.tarifas(tx, emb.cultivo_id);
      const nuevos = parcelas.filter((p) => p.es_nuevo);
      const cargoMicro = Math.round(
        (nuevos.length * tarifas.cert + tarifas.manifiesto) * MICRO,
      );

      // Tesorería: verificar y debitar (bloqueo de fila).
      const tes = await tx.queryOne<{ id: string; saldo_cache: string }>(
        `select id, saldo_cache from tesorerias where operador_id = $1 for update`,
        [operadorId],
      );
      if (!tes) throw DomainErrors.notFound();
      if (Number(tes.saldo_cache) < cargoMicro) throw DomainErrors.treasuryInsufficientFunds();

      // Mintear los nuevos: DRAFT → ACTIVE con número público y vigencia.
      for (const p of nuevos) {
        const numero = await this.siguienteNumero(tx);
        await tx.query(
          `update certificados
             set estado = 'ACTIVE', numero_publico = $2, emitido_en = now(),
                 vigente_hasta = now() + ($3 || ' days')::interval
           where id = $1`,
          [p.certificado_id, numero, tarifas.vigenciaDias],
        );
      }

      // Débitos: certificación (agregado) + manifiesto. Firma sintética pre-Solana.
      if (nuevos.length > 0) {
        await tx.query(
          `insert into movimientos_tesoreria (tesoreria_id, tipo, monto, tx_signature, embarque_id, confirmado_en)
           values ($1, 'DEBITO_CERTIFICACION', $2, 'offchain:' || gen_random_uuid(), $3, now())`,
          [tes.id, -Math.round(nuevos.length * tarifas.cert * MICRO), id],
        );
      }
      await tx.query(
        `insert into movimientos_tesoreria (tesoreria_id, tipo, monto, tx_signature, embarque_id, confirmado_en)
         values ($1, 'DEBITO_MANIFIESTO', $2, 'offchain:' || gen_random_uuid(), $3, now())`,
        [tes.id, -Math.round(tarifas.manifiesto * MICRO), id],
      );
      await tx.query(
        `update tesorerias set saldo_cache = saldo_cache - $2, actualizado_en = now() where id = $1`,
        [tes.id, cargoMicro],
      );

      await tx.query(
        `update embarques
           set estado = 'EMITIDO', aprobado_por = $2, emitido_en = now(),
               tarifa_manifiesto_cobrada = $3
         where id = $1`,
        [id, userId, Math.round(tarifas.manifiesto * MICRO)],
      );

      // Estado del saga (lo consume la auditoría del Admin y el modal por Realtime).
      await tx.query(
        `insert into saga_certificacion (embarque_id, estado, paso_actual, reintentable)
         values ($1, 'ONCHAIN_CONFIRMED', 'completado', false)`,
        [id],
      );

      return this.resultado(tx, id, operadorId);
    });
  }

  private async resultado(tx: Tx, embarqueId: string, operadorId: string) {
    const certificados = await tx.query<any>(
      `select cert.id, cert.numero_publico, cert.estado, p.nombre as parcela
       from embarque_parcelas ep
       join certificados cert on cert.id = ep.certificado_id
       join parcelas p on p.id = ep.parcela_id
       where ep.embarque_id = $1
       order by p.nombre`,
      [embarqueId],
    );
    const tes = await tx.queryOne<{ saldo_cache: string }>(
      `select saldo_cache from tesorerias where operador_id = $1`,
      [operadorId],
    );
    return {
      certificados: certificados.map((c) => ({
        id: c.id,
        numeroPublico: c.numero_publico,
        estado: c.estado,
        parcela: c.parcela,
      })),
      saldoUsdc: tes ? Number(tes.saldo_cache) / MICRO : 0,
    };
  }

  /**
   * Tarifas y vigencia vigentes al momento de cobrar. Salen de la base (las
   * edita el Admin en Parámetros, §A4): el precio no se hardcodea en el código
   * ni se congela en el frontend. La vigencia es POR CULTIVO (parametros_cultivo).
   */
  private async tarifas(tx?: Tx, cultivoId?: string) {
    const db = tx ?? this.db;
    const rows = await db.query<{ clave: string; valor: string }>(
      `select clave, valor from parametros_globales
       where clave in ('tarifa_certificacion_usdc','tarifa_manifiesto_usdc')`,
    );
    const map = Object.fromEntries(rows.map((r) => [r.clave, Number(r.valor)]));
    const vig = cultivoId
      ? await db.queryOne<{ valor: string }>(
          `select valor from parametros_cultivo
           where cultivo_id = $1 and clave = 'vigencia_max_dias'`,
          [cultivoId],
        )
      : null;
    return {
      cert: map['tarifa_certificacion_usdc'] ?? 5,
      manifiesto: map['tarifa_manifiesto_usdc'] ?? 2,
      vigenciaDias: vig ? Number(vig.valor) : 270,
    };
  }

  /** Número público secuencial por año: GT-AAAA-NNNNN. */
  private async siguienteNumero(tx: Tx): Promise<string> {
    const year = new Date().getUTCFullYear();
    const prefix = `GT-${year}-`;
    const row = await tx.queryOne<{ max: string | null }>(
      `select max(substring(numero_publico from '[0-9]+$')) as max
       from certificados where numero_publico like $1`,
      [`${prefix}%`],
    );
    const next = (row?.max ? parseInt(row.max, 10) : 0) + 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }
}
