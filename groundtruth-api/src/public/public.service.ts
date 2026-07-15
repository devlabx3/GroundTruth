import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { DbService } from '@/db/db.service';
import { DomainError, DomainErrors } from '@/common/domain-error';

const querySchema = z.object({
  q: z.string().trim().min(3).max(120),
  by: z.enum(['number', 'asset', 'hash']),
});

/**
 * Verificador público (V2) — **la única superficie sin autenticación**.
 *
 * Es lo que hace que un certificado GroundTruth valga algo ante un tercero: un
 * auditor o un importador comprueba el documento que le entregaron **sin pedirnos
 * permiso ni fiarse de nosotros**.
 *
 * Lee **exclusivamente de la vista `certificados_publicos`**, que materializa el
 * contrato de privacidad (Modelo-de-Datos §7.1): estado, cultivo, país, fechas,
 * hashes y referencias on-chain. **Nunca** el nombre del agricultor, su contacto,
 * la telemetría cruda ni el polígono. Consultar la tabla `certificados` desde aquí
 * expondría el tenant entero; por eso no se hace, ni "solo para este campo".
 */
@Injectable()
export class PublicService {
  constructor(private readonly db: DbService) {}

  async buscarCertificado(params: unknown) {
    const { q, by } = querySchema.parse(params);

    // Columna de búsqueda según la entrada. Nunca se interpola el valor: va como
    // parámetro, y el nombre de columna sale de este mapa cerrado (no del usuario).
    const columna = {
      number: 'numero_publico',
      asset: 'cnft_asset_id',
      hash: 'hash_pdf',
    }[by];

    const row = await this.db.queryOne<any>(
      `select numero_publico, estado, cnft_asset_id, uri_geojson_arweave,
              hash_pdf, hash_imagen, emitido_en, vigente_hasta, revocado_en,
              cultivo, pais
       from certificados_publicos
       where ${columna} = $1`,
      [by === 'hash' ? q.toLowerCase() : q],
    );
    if (!row) throw new DomainError('CERT_NOT_FOUND', 'cert_not_found', 404);

    return {
      numeroPublico: row.numero_publico,
      estado: row.estado,
      cultivo: row.cultivo,
      pais: row.pais,
      emitidoEn: row.emitido_en,
      vigenteHasta: row.vigente_hasta,
      revocadoEn: row.revocado_en,
      // Las huellas y las referencias on-chain: con esto, quien recibe el
      // documento puede comprobarlo por su cuenta contra la cadena y Arweave.
      hashPdf: row.hash_pdf,
      hashImagen: row.hash_imagen,
      assetId: row.cnft_asset_id,
      uriGeojson: row.uri_geojson_arweave,
    };
  }
}
