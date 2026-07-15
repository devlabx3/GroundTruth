import { Injectable } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { DomainError, DomainErrors } from '@/common/domain-error';

/**
 * Superficie del Agricultor (DApp lite, F1–F5). La autorización NO es por
 * privilegios de operador: el agricultor accede a lo que posee
 * (`fincas.agricultor_id`). Cada método resuelve el usuario desde el JWT y
 * filtra por propiedad — nunca recibe `x-operador-id`.
 */
const ESTADO_TEL: Record<string, string> = { VERDE: 'conforme', ROJO: 'alerta' };
// Variable del payload → clave i18n de etiqueta (reutiliza dashboard:telemetry.*) + unidad.
const VAR_UI: Record<string, { key: string; unit: string }> = {
  ph: { key: 'ph', unit: '' },
  ec_us_cm: { key: 'ec', unit: 'mS/cm' },
  humedad_suelo_pct: { key: 'humidity', unit: '%' },
  temp_suelo_c: { key: 'temp_sup', unit: '°C' },
};

@Injectable()
export class FarmerService {
  constructor(private readonly db: DbService) {}

  private async usuarioId(authUserId: string): Promise<string> {
    const u = await this.db.queryOne<{ id: string; activo: boolean }>(
      'select id, activo from usuarios where auth_user_id = $1',
      [authUserId],
    );
    if (!u) throw DomainErrors.userNotProvisioned();
    if (!u.activo) throw DomainErrors.accountInactive();
    return u.id;
  }

  async alertas(authUserId: string) {
    const uid = await this.usuarioId(authUserId);
    const rows = await this.db.query<any>(
      `
      select a.id, a.parcela_id, p.nombre as parcela, a.variable, a.valor,
             ue.valor_min, ue.valor_max, a.created_at as fecha
      from alertas a
      join parcelas p on p.id = a.parcela_id
      left join umbrales_eudr ue on ue.cultivo_id = p.cultivo_id and ue.variable = a.variable
      where a.agricultor_id = $1 and a.leida_en is null
      order by a.created_at desc
      `,
      [uid],
    );
    return rows.map((a) => {
      const meta = VAR_UI[a.variable] ?? { key: a.variable, unit: '' };
      const u = meta.unit ? ` ${meta.unit}` : '';
      return {
        id: a.id,
        parcelaId: a.parcela_id,
        parcela: a.parcela,
        variableKey: meta.key,
        valor: `${a.valor}${u}`,
        umbral: a.valor_min != null ? `${a.valor_min}–${a.valor_max}${u}` : '—',
        fecha: a.fecha,
      };
    });
  }

  async parcelas(authUserId: string) {
    const uid = await this.usuarioId(authUserId);
    const rows = await this.db.query<any>(
      `
      select p.id, p.nombre, cu.nombre as cultivo, round(p.area_m2 / 10000.0, 2) as area_ha,
             p.ultimo_estado,
             exists (select 1 from certificados c where c.parcela_id = p.id and c.estado = 'ACTIVE') as certificada
      from parcelas p
      join fincas f   on f.id = p.finca_id
      join cultivos cu on cu.id = p.cultivo_id
      where f.agricultor_id = $1
      order by p.nombre
      `,
      [uid],
    );
    return rows.map((p) => this.mapParcela(p));
  }

  async parcela(authUserId: string, parcelaId: string) {
    const uid = await this.usuarioId(authUserId);
    const p = await this.db.queryOne<any>(
      `
      select p.id, p.nombre, cu.nombre as cultivo, round(p.area_m2 / 10000.0, 2) as area_ha,
             p.ultimo_estado,
             exists (select 1 from certificados c where c.parcela_id = p.id and c.estado = 'ACTIVE') as certificada
      from parcelas p
      join fincas f   on f.id = p.finca_id
      join cultivos cu on cu.id = p.cultivo_id
      where p.id = $2 and f.agricultor_id = $1
      `,
      [uid, parcelaId],
    );
    if (!p) throw DomainErrors.notFound();

    const ciclos = await this.db.query<any>(
      `
      select cs.id, cs.fecha_inicio, cs.fecha_cierre,
             exists (select 1 from certificados c where c.ciclo_siembra_id = cs.id and c.estado <> 'DRAFT') as certificado
      from ciclos_siembra cs
      where cs.parcela_id = $1
      order by cs.fecha_inicio desc
      `,
      [parcelaId],
    );
    return {
      ...this.mapParcela(p),
      ciclos: ciclos.map((c) => ({
        id: c.id,
        inicio: c.fecha_inicio,
        fin: c.fecha_cierre,
        certificado: c.certificado,
      })),
    };
  }

  /**
   * Declarar nueva siembra (F4): cierra el ciclo activo y abre uno nuevo.
   *
   * Tres guardarraíles (Errores §5.5), y ninguno es cosmético:
   *  - no hay ciclo activo → no hay nada que cerrar;
   *  - el ciclo actual se declaró hace <24 h → un doble clic no quema un ciclo;
   *  - **hay una certificación en curso para la parcela** → ver abajo.
   */
  async nuevaSiembra(authUserId: string, parcelaId: string) {
    const uid = await this.usuarioId(authUserId);
    return this.db.transaction(async (tx) => {
      const parcela = await tx.queryOne<{ id: string }>(
        `select p.id from parcelas p join fincas f on f.id = p.finca_id
         where p.id = $1 and f.agricultor_id = $2`,
        [parcelaId, uid],
      );
      if (!parcela) throw DomainErrors.notFound();

      // Carrera con consecuencia económica: el `certify` ya capturó el ciclo actual
      // en `embarque_parcelas`. Si el agricultor lo cierra ahora, se mintea (y se
      // COBRA) un cNFT para un ciclo que acaba de quedar obsoleto. El operador paga
      // por un certificado inútil. Por eso se bloquea mientras el embarque procesa.
      const enCurso = await tx.queryOne<{ id: string }>(
        `select e.id
         from embarques e
         join embarque_parcelas ep on ep.embarque_id = e.id
         where ep.parcela_id = $1 and e.estado = 'PROCESANDO'
         limit 1`,
        [parcelaId],
      );
      if (enCurso) {
        throw new DomainError('CERTIFICATION_IN_PROGRESS', 'certification_in_progress', 409, true);
      }

      const activo = await tx.queryOne<{ id: string; fecha_inicio: Date }>(
        `select id, fecha_inicio from ciclos_siembra
         where parcela_id = $1 and estado = 'ACTIVO'
         order by fecha_inicio desc limit 1
         for update`,
        [parcelaId],
      );
      if (!activo) throw new DomainError('NO_ACTIVE_CYCLE', 'no_active_cycle', 422);
      const horas = (Date.now() - new Date(activo.fecha_inicio).getTime()) / 36e5;
      if (horas < 24) throw new DomainError('PLANTING_DUPLICATE', 'planting_duplicate', 409);

      await tx.query(
        `update ciclos_siembra
           set estado = 'CERRADO', fecha_cierre = now(), motivo_cierre = 'nueva_siembra'
         where id = $1`,
        [activo.id],
      );
      const nuevo = await tx.queryOne<{ id: string }>(
        `insert into ciclos_siembra (parcela_id, estado, declarado_por, fecha_inicio)
         values ($1, 'ACTIVO', $2, now()) returning id`,
        [parcelaId, uid],
      );
      return { cicloId: nuevo!.id };
    });
  }

  private mapParcela(p: any) {
    const certificada = p.certificada;
    return {
      id: p.id,
      nombre: p.nombre,
      cultivo: p.cultivo,
      areaHa: Number(p.area_ha),
      estado: ESTADO_TEL[p.ultimo_estado] ?? 'pendiente',
      certificada,
      filled: certificada ? 4 : p.ultimo_estado ? 1 : 0,
    };
  }
}
