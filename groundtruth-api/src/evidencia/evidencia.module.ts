import { Global, Module } from '@nestjs/common';
import { EvidenciaService } from './evidencia.service';
import { StorageService } from './storage.service';
import { SentinelService } from './sentinel.service';
import { PdfService } from './pdf.service';
import { ArweaveService } from './arweave.service';

/** Global: la certificación (embarques) construye la evidencia antes de mintear. */
@Global()
@Module({
  providers: [EvidenciaService, StorageService, SentinelService, PdfService, ArweaveService],
  exports: [EvidenciaService, StorageService, SentinelService, ArweaveService],
})
export class EvidenciaModule {}
