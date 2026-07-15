import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '@/db/db.service';
import { StorageService } from './storage.service';
import { SentinelService } from './sentinel.service';
import { PdfService } from './pdf.service';
import { ArweaveService } from './arweave.service';

const CEROS = '0'.repeat(64);

export interface Evidencia {
  /** URI del GeoJSON. `gt://parcela/<id>` si Arweave no está activo. */
  geojsonUri: string;
  hashPdf: string; // hex 64; ceros si no hay PDF
  hashImagen: string; // hex 64; ceros si no hay imagen satelital
  storagePathPdf: string | null;
  evidenciaId: string | null;
}

/**
 * Construye la cadena de evidencia de un certificado (Arquitectura §6, Arquitectura §11).
 *
 * **El orden no es casual:** la imagen y el PDF se generan y se hashean PRIMERO,
 * porque esos hashes van **embebidos dentro del GeoJSON**, y es el GeoJSON —ya
 * con ellos dentro— lo que se sube a Arweave y cuyo URI se ancla en el cNFT.
 * Al revés, la cadena no cerraría: el GeoJSON no podría probar nada sobre los
 * archivos pesados.
 *
 * Cada pata es opcional y se degrada sola: sin Sentinel no hay imagen (hash en
 * ceros), sin Storage no hay PDF, sin Irys el URI es una referencia interna. Lo
 * que NUNCA ocurre es inventar un hash.
 */
@Injectable()
export class EvidenciaService {
  private readonly log = new Logger(EvidenciaService.name);

  constructor(
    private readonly db: DbService,
    private readonly storage: StorageService,
    private readonly sentinel: SentinelService,
    private readonly pdf: PdfService,
    private readonly arweave: ArweaveService,
  ) {}

  async construir(
    parcelaId: string,
    cicloId: string,
    numeroPublico: string,
    vigenciaDias: number,
  ): Promise<Evidencia> {
    const p = await this.db.queryOne<any>(
      `
      select p.id, p.nombre, round(p.area_m2 / 10000.0, 4) as area_ha,
             st_asgeojson(p.geom)::json as geom,
             st_xmin(p.geom::box2d) as xmin, st_ymin(p.geom::box2d) as ymin,
             st_xmax(p.geom::box2d) as xmax, st_ymax(p.geom::box2d) as ymax,
             cu.nombre as cultivo, f.nombre as finca, f.id as finca_id,
             o.nombre as operador, o.id as operador_id, o.pais
      from parcelas p
      join cultivos cu  on cu.id = p.cultivo_id
      join fincas f     on f.id = p.finca_id
      join operadores o on o.id = f.operador_id
      where p.id = $1
      `,
      [parcelaId],
    );
    if (!p) throw new Error(`parcela ${parcelaId} no encontrada`);

    const emitidoEn = new Date();
    const vigenteHasta = new Date(emitidoEn.getTime() + vigenciaDias * 86_400_000);

    // --- 1. Imagen satelital (si hay credenciales) ---
    let hashImagen = CEROS;
    let evidenciaId: string | null = null;
    let imagen: Buffer | undefined;

    if (this.sentinel.isEnabled() && this.storage.isEnabled()) {
      try {
        const sat = await this.sentinel.obtener([
          Number(p.xmin),
          Number(p.ymin),
          Number(p.xmax),
          Number(p.ymax),
        ]);
        if (sat) {
          const subida = await this.storage.subir(
            `${p.operador_id}/${parcelaId}/${cicloId}/satelite.png`,
            sat.png,
            'image/png',
          );
          hashImagen = subida.hash;
          imagen = sat.png;

          const ev = await this.db.queryOne<{ id: string }>(
            `insert into evidencias_satelitales
               (parcela_id, storage_path_imagen, hash_imagen, timestamp_adquisicion,
                evalscript_version, bbox, resolucion_m, formato)
             values ($1, $2, $3, $4, $5,
                     st_makeenvelope($6, $7, $8, $9, 4326), $10, 'PNG')
             returning id`,
            [
              parcelaId,
              subida.path,
              subida.hash,
              sat.hasta,
              sat.evalscriptVersion,
              sat.bbox[0],
              sat.bbox[1],
              sat.bbox[2],
              sat.bbox[3],
              sat.resolucionM,
            ],
          );
          evidenciaId = ev!.id;
        }
      } catch (e) {
        // La imagen es evidencia de apoyo: su fallo no debe tumbar la emisión.
        this.log.warn(`Sin imagen satelital para ${parcelaId}: ${(e as Error).message}`);
      }
    }

    // --- 2. PDF del certificado (se hashea sobre la copia almacenada) ---
    let hashPdf = CEROS;
    let storagePathPdf: string | null = null;

    if (this.storage.isEnabled()) {
      try {
        const buf = await this.pdf.generar({
          numeroPublico,
          parcela: p.nombre,
          finca: p.finca,
          operador: p.operador,
          cultivo: p.cultivo,
          areaHa: Number(p.area_ha),
          emitidoEn,
          vigenteHasta,
          imagen,
        });
        const subida = await this.storage.subir(
          `${p.operador_id}/${parcelaId}/${cicloId}/${numeroPublico}.pdf`,
          buf,
          'application/pdf',
        );
        hashPdf = subida.hash;
        storagePathPdf = subida.path;
        if (evidenciaId) {
          await this.db.query(
            'update evidencias_satelitales set storage_path_pdf = $2, hash_pdf = $3 where id = $1',
            [evidenciaId, subida.path, subida.hash],
          );
        }
      } catch (e) {
        this.log.warn(`Sin PDF para ${parcelaId}: ${(e as Error).message}`);
      }
    }

    // --- 3. GeoJSON con los hashes dentro → Arweave ---
    const geojson = {
      type: 'Feature',
      geometry: p.geom,
      properties: {
        schema: 'eudr-parcel-v1',
        certificado: numeroPublico,
        parcela: { id: parcelaId, nombre: p.nombre, area_ha: Number(p.area_ha) },
        finca: { id: p.finca_id, nombre: p.finca },
        operador: { id: p.operador_id, nombre: p.operador, pais: p.pais },
        cultivo: p.cultivo,
        ciclo_siembra_id: cicloId,
        emitido_en: emitidoEn.toISOString(),
        vigente_hasta: vigenteHasta.toISOString(),
        // Las huellas de los archivos pesados viajan AQUÍ: es lo que ata el
        // GeoJSON permanente con el PDF y la imagen guardados en Storage.
        hashes: {
          pdf: hashPdf === CEROS ? null : hashPdf,
          imagen: hashImagen === CEROS ? null : hashImagen,
        },
      },
    };

    let geojsonUri = `gt://parcela/${parcelaId}`;
    if (this.arweave.isEnabled()) {
      try {
        geojsonUri = await this.arweave.subirGeoJson(geojson);
      } catch (e) {
        this.log.warn(`Sin Arweave para ${parcelaId}: ${(e as Error).message}`);
      }
    }

    return { geojsonUri, hashPdf, hashImagen, storagePathPdf, evidenciaId };
  }
}
