import { Module } from '@nestjs/common';
import { TelemetriaController } from './telemetria.controller';
import { TelemetriaIngestionService } from './telemetria-ingestion.service';
import { RateLimitGuard } from '@/public/rate-limit.guard';

/**
 * Ingesta de telemetría IoT. Exporta `TelemetriaIngestionService` para que el
 * simulador (AdminModule) lo consuma en proceso — una sola vía de entrada para
 * datos reales y simulados.
 */
@Module({
  controllers: [TelemetriaController],
  providers: [TelemetriaIngestionService, RateLimitGuard],
  exports: [TelemetriaIngestionService],
})
export class TelemetriaModule {}
