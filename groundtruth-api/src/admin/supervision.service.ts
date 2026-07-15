import { Injectable } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { DomainErrors } from '@/common/domain-error';
import { CertificadosService } from '@/certificados/certificados.service';
import { EmbarquesService } from '@/embarques/embarques.service';

const estadoTel = (e: string | null) =>
  e === 'VERDE' ? 'conforme' : e === 'ROJO' ? 'alerta' : 'pendiente';

/**
 * Superficie transversal del Admin: panel global (A6), supervisión de parcelas,
 * auditoría del saga (A7) y revocación global (A8).
 *
 * Las acciones (revocar, reintentar) NO se reimplementan aquí: el admin resuelve
 * a qué unidad pertenece la fila y delega en el servicio del operador. Así existe
 * una sola ruta de emisión/revocación en el sistema — con su misma transacción,
 * su misma idempotencia y su misma auditoría.
 */
@Injectable()
export class AdminSupervisionService {
  constructor(
    private readonly db: DbService,
    private readonly certificadosSvc: CertificadosService,
    private readonly embarquesSvc: EmbarquesService,
  ) {}

  async overview() {
    const m = await this.db.queryOne<any>(
      `
      select
        (select count(*) from operadores) as unidades,
        (select count(*) from certificados
          where estado = 'ACTIVE' and emitido_en > now() - interval '30 days') as certificados_30d,
        (select count(*) from saga_certificacion
          where estado in ('CERT_PENDING','FAILED')) as sagas_pendientes,
        (select count(*) from alertas where leida_en is null) as alertas_abiertas
      `,
    );
    return {
      unidades: Number(m!.unidades),
      certificados30d: Number(m!.certificados_30d),
      sagasPendientes: Number(m!.sagas_pendientes),
      alertasAbiertas: Number(m!.alertas_abiertas),
    };
  }

  /** Supervisión global (A6): todas las parcelas de todas las unidades. */
  async parcelas() {
    const rows = await this.db.query<any>(
      `
      select p.id, p.nombre, o.nombre as unidad, cu.nombre as cultivo,
             p.ultimo_estado,
             exists (
               select 1 from certificados c
               where c.parcela_id = p.id and c.estado = 'ACTIVE'
             ) as certificada
      from parcelas p
      join fincas f     on f.id = p.finca_id
      join operadores o on o.id = f.operador_id
      join cultivos cu  on cu.id = p.cultivo_id
      order by o.nombre, p.nombre
      `,
    );
    return rows.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      unidad: p.unidad,
      cultivo: p.cultivo,
      estado: estadoTel(p.ultimo_estado),
      certificada: p.certificada,
    }));
  }

  // ---- Certificados, vista global (A8) ----

  async certificados() {
    const rows = await this.db.query<any>(
      `
      select c.id, c.numero_publico, c.estado, c.emitido_en, c.vigente_hasta,
             p.nombre as parcela, o.nombre as unidad
      from certificados c
      join parcelas p   on p.id = c.parcela_id
      join fincas f     on f.id = p.finca_id
      join operadores o on o.id = f.operador_id
      where c.estado <> 'DRAFT'
      order by c.emitido_en desc nulls last
      `,
    );
    const ESTADO_UI: Record<string, string> = {
      ACTIVE: 'vigente',
      REVOKED: 'revocado',
      EXPIRED: 'expirado',
      SUPERSEDED: 'reemplazado',
    };
    return rows.map((c) => ({
      id: c.id,
      numeroPublico: c.numero_publico,
      parcela: c.parcela,
      unidad: c.unidad,
      emitido: c.emitido_en,
      vigenciaHasta: c.vigente_hasta,
      estado: ESTADO_UI[c.estado] ?? c.estado.toLowerCase(),
    }));
  }

  async revocarCertificado(actorId: string, id: string, body: unknown) {
    const operadorId = await this.operadorDelCertificado(id);
    return this.certificadosSvc.revocar(operadorId, actorId, id, body);
  }

  // ---- Auditoría del saga (A7) ----

  async sagas() {
    const rows = await this.db.query<any>(
      `
      select s.id, s.estado, s.paso_actual, s.error_detalle, s.reintentable,
             s.intentos, s.created_at, s.actualizado_en,
             e.id as embarque_id, o.nombre as unidad
      from saga_certificacion s
      join embarques e  on e.id = s.embarque_id
      join operadores o on o.id = e.operador_id
      where s.estado in ('CERT_PENDING','FAILED')
      order by s.created_at desc
      `,
    );
    return rows.map((s) => ({
      id: s.id,
      embarque: s.embarque_id,
      unidad: s.unidad,
      paso: s.paso_actual,
      estado: s.estado,
      retryable: s.reintentable,
      intentos: s.intentos,
      // error_detalle guarda una CLAVE i18n, no texto libre (el idioma lo pone el front).
      motivoKey: s.error_detalle,
      fecha: s.actualizado_en ?? s.created_at,
    }));
  }

  /**
   * Reintento (A7). Vuelve a ejecutar la certificación del embarque: es la misma
   * transacción atómica del operador, y es idempotente por embarque — si ya quedó
   * EMITIDO, devuelve el resultado sin volver a cobrar ni re-mintear.
   */
  async retrySaga(actorId: string, id: string) {
    const s = await this.db.queryOne<any>(
      `select s.id, s.reintentable, e.id as embarque_id, e.operador_id
       from saga_certificacion s
       join embarques e on e.id = s.embarque_id
       where s.id = $1`,
      [id],
    );
    if (!s) throw DomainErrors.notFound();
    if (!s.reintentable) throw DomainErrors.noPrivilege();

    await this.db.query(
      'update saga_certificacion set intentos = intentos + 1, actualizado_en = now() where id = $1',
      [id],
    );
    const resultado = await this.embarquesSvc.certificar(s.operador_id, actorId, s.embarque_id);

    await this.db.query(
      `update saga_certificacion
         set estado = 'ONCHAIN_CONFIRMED', paso_actual = 'completado',
             error_detalle = null, reintentable = false, actualizado_en = now()
       where id = $1`,
      [id],
    );
    await this.db.query(
      `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id)
       values ($1, $2, 'saga.reintentar', 'saga_certificacion', $3)`,
      [actorId, s.operador_id, id],
    );
    return resultado;
  }

  private async operadorDelCertificado(id: string): Promise<string> {
    const row = await this.db.queryOne<{ operador_id: string }>(
      `select f.operador_id
       from certificados c
       join parcelas p on p.id = c.parcela_id
       join fincas f   on f.id = p.finca_id
       where c.id = $1`,
      [id],
    );
    if (!row) throw DomainErrors.notFound();
    return row.operador_id;
  }
}
