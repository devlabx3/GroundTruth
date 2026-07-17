import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { Public } from '@/auth/public.decorator';
import { RateLimitGuard } from '@/public/rate-limit.guard';
import { TelemetriaIngestionService } from './telemetria-ingestion.service';

/**
 * Ingesta de telemetría IoT (Bloque 2). **Público** porque quien llama es un nodo
 * LoRaWAN/ChirpStack, no una persona: no hay JWT. La autenticación es un secreto
 * compartido en la cabecera `authorization`, comparado en tiempo constante — igual
 * que el webhook de Helius (una comparación normal filtra el secreto por temporización).
 *
 * Este es el MISMO servicio que alimenta el simulador en proceso: hardware real y
 * simulado convergen en `TelemetriaIngestionService`. Rate-limited por IP.
 *
 * TODO(follow-up HMAC/ATECC608): autenticación por-nodo (HMAC SHA-256 con clave en
 * `nodos_sensores.api_key_hash`) y verificación de la firma `firma` con
 * `atecc608_pubkey`. Hoy el campo `firma` se recibe y se persiste (`firma_hex`),
 * pero aún no se verifica: el secreto compartido acota el acceso mientras tanto.
 */
@Controller('telemetria')
@UseGuards(RateLimitGuard)
export class TelemetriaController {
  constructor(
    private readonly config: ConfigService,
    private readonly ingesta: TelemetriaIngestionService,
  ) {}

  @Public()
  @Post('ingest')
  async ingest(
    @Headers('authorization') auth: string | undefined,
    @Body() body: unknown,
  ) {
    this.verificarSecreto(auth);
    return this.ingesta.ingest(body);
  }

  private verificarSecreto(auth: string | undefined) {
    const esperado = this.config.get<string>('TELEMETRIA_INGEST_SECRET');
    // Sin secreto configurado el endpoint queda CERRADO: una superficie pública sin
    // autenticar es peor que no tenerla.
    if (!esperado) throw new ForbiddenException();
    if (!auth) throw new ForbiddenException();

    const a = Buffer.from(auth);
    const b = Buffer.from(esperado);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException();
    }
  }
}
