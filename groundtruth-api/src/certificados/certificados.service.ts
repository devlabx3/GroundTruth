import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { DomainError, DomainErrors } from '@/common/domain-error';

/** ACTIVE→vigente, REVOKED→revocado, etc. (tokens del StatusBadge del frontend). */
const ESTADO_UI: Record<string, string> = {
  DRAFT: 'pendiente',
  ACTIVE: 'vigente',
  SUPERSEDED: 'sustituido',
  EXPIRED: 'expirado',
  REVOKED: 'revocado',
};

const revocarSchema = z.object({ motivo: z.string().trim().min(1) });

@Injectable()
export class CertificadosService {
  constructor(private readonly db: DbService) {}

  /** Lista de la unidad (O8). Los borradores internos de embarque no se muestran. */
  list(operadorId: string) {
    return this.db
      .query<any>(
        `
        select c.id, c.numero_publico, p.nombre as parcela,
               c.emitido_en, c.vigente_hasta, c.estado,
               (select ep.embarque_id from embarque_parcelas ep
                 where ep.certificado_id = c.id order by ep.created_at desc limit 1) as embarque_id
        from certificados c
        join parcelas p on p.id = c.parcela_id
        join fincas f   on f.id = p.finca_id
        where f.operador_id = $1 and c.estado <> 'DRAFT'
        order by c.emitido_en desc nulls last
        `,
        [operadorId],
      )
      .then((rows) =>
        rows.map((c) => ({
          id: c.id,
          numeroPublico: c.numero_publico,
          parcela: c.parcela,
          embarque: c.embarque_id,
          emitido: c.emitido_en,
          vigenciaHasta: c.vigente_hasta,
          estado: ESTADO_UI[c.estado],
        })),
      );
  }

  async detail(operadorId: string, id: string) {
    const c = await this.db.queryOne<any>(
      `
      select c.id, c.numero_publico, p.nombre as parcela, cu.nombre as cultivo,
             c.emitido_en, c.vigente_hasta, c.estado,
             c.revocado_en, c.revocado_motivo,
             c.cnft_asset_id, c.uri_geojson_arweave, c.hash_pdf, c.hash_imagen,
             (select ep.embarque_id from embarque_parcelas ep
               where ep.certificado_id = c.id order by ep.created_at desc limit 1) as embarque_id
      from certificados c
      join parcelas p  on p.id = c.parcela_id
      join cultivos cu on cu.id = p.cultivo_id
      join fincas f    on f.id = p.finca_id
      where c.id = $1 and f.operador_id = $2 and c.estado <> 'DRAFT'
      `,
      [id, operadorId],
    );
    if (!c) throw DomainErrors.notFound();

    return {
      id: c.id,
      numeroPublico: c.numero_publico,
      parcela: c.parcela,
      cultivo: c.cultivo,
      embarque: c.embarque_id,
      emitido: c.emitido_en,
      vigenciaHasta: c.vigente_hasta,
      estado: ESTADO_UI[c.estado],
      revocadoEn: c.revocado_en,
      motivoRevocacion: c.revocado_motivo,
      // Pre-Solana: cNFT y hashes se anclan al integrar el programa Anchor.
      assetId: c.cnft_asset_id,
      uriGeojson: c.uri_geojson_arweave,
      hashPdf: c.hash_pdf,
      hashImagen: c.hash_imagen,
    };
  }

  /** Revocar (O8): estado off-chain (D1); auditado. Solo un certificado vigente. */
  async revocar(operadorId: string, usuarioId: string, id: string, body: unknown) {
    const { motivo } = revocarSchema.parse(body);
    return this.db.transaction(async (tx) => {
      const cert = await tx.queryOne<{ estado: string }>(
        `select c.estado
         from certificados c
         join parcelas p on p.id = c.parcela_id
         join fincas f   on f.id = p.finca_id
         where c.id = $1 and f.operador_id = $2
         for update`,
        [id, operadorId],
      );
      if (!cert) throw DomainErrors.notFound();
      if (cert.estado !== 'ACTIVE') {
        throw new DomainError('CERT_NOT_REVOCABLE', 'cert_not_revocable', 409);
      }

      await tx.query(
        `update certificados
           set estado = 'REVOKED', revocado_en = now(), revocado_motivo = $2, revocado_por = $3
         where id = $1`,
        [id, motivo, usuarioId],
      );

      await tx.query(
        `insert into auditoria (actor_id, operador_id, accion, entidad, entidad_id, valor_nuevo)
         values ($1, $2, 'certificado.revocar', 'certificados', $3, $4)`,
        [usuarioId, operadorId, id, JSON.stringify({ motivo })],
      );

      return { id, estado: ESTADO_UI['REVOKED'], revocadoEn: new Date().toISOString() };
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async expirarVencidos(): Promise<void> {
    await this.db.query(
      `update certificados
        set estado = 'EXPIRED'
        where estado = 'ACTIVE' and vigente_hasta < now()`,
    );
  }
}
