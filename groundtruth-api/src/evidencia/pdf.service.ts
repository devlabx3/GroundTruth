import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

export interface DatosCertificado {
  numeroPublico: string;
  parcela: string;
  finca: string;
  operador: string;
  cultivo: string;
  areaHa: number;
  emitidoEn: Date;
  vigenteHasta: Date;
  assetId?: string;
  imagen?: Buffer;
}

/**
 * PDF del certificado — el documento que el operador entrega a su comprador.
 *
 * Es un **render**, no la fuente de verdad: lo que vale es el cNFT y el GeoJSON
 * en Arweave. Por eso su SHA-256 se ancla on-chain: para poder demostrar que
 * este papel corresponde a ese certificado y no ha sido retocado.
 */
@Injectable()
export class PdfService {
  async generar(d: DatosCertificado): Promise<Buffer> {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const trozos: Buffer[] = [];
    doc.on('data', (c: Buffer) => trozos.push(c));
    const listo = new Promise<Buffer>((resolve) => {
      doc.on('end', () => resolve(Buffer.concat(trozos)));
    });

    const fecha = (x: Date) => x.toISOString().slice(0, 10);

    doc.fontSize(9).fillColor('#6B7280').text('GROUNDTRUTH · CERTIFICADO EUDR');
    doc.moveDown(0.4);
    doc.fontSize(26).fillColor('#111827').text(d.numeroPublico);
    doc.moveDown(1);

    const fila = (etiqueta: string, valor: string) => {
      doc.fontSize(9).fillColor('#6B7280').text(etiqueta);
      doc.fontSize(12).fillColor('#111827').text(valor);
      doc.moveDown(0.6);
    };

    fila('Unidad de negocio', d.operador);
    fila('Finca', d.finca);
    fila('Parcela', d.parcela);
    fila('Cultivo', d.cultivo);
    fila('Área', `${d.areaHa.toFixed(2)} ha`);
    fila('Emitido', fecha(d.emitidoEn));
    fila('Vigente hasta', fecha(d.vigenteHasta));

    if (d.imagen) {
      doc.moveDown(0.4);
      doc.fontSize(9).fillColor('#6B7280').text('Evidencia satelital');
      doc.moveDown(0.3);
      doc.image(d.imagen, { fit: [220, 220] });
    }

    if (d.assetId) {
      doc.moveDown(1);
      doc.fontSize(8).fillColor('#6B7280').text('Certificado on-chain (cNFT, Solana)');
      doc.fontSize(9).fillColor('#111827').text(d.assetId);
    }

    doc.end();
    return listo;
  }
}
