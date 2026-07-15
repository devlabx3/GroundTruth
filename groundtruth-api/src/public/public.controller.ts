import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Public } from '@/auth/public.decorator';
import { PublicService } from './public.service';
import { RateLimitGuard } from './rate-limit.guard';

/**
 * Verificador público (V2). **Sin autenticación por diseño**: quien verifica un
 * certificado es un auditor o un importador que no tiene —ni debe tener— cuenta
 * en GroundTruth. Si hiciera falta pedirnos permiso para comprobar un certificado,
 * el certificado no probaría nada.
 *
 * A cambio: límite por IP y **solo la vista pública** (ver `PublicService`).
 */
@Controller('public')
@UseGuards(RateLimitGuard)
export class PublicController {
  constructor(private readonly publico: PublicService) {}

  /** `by`: number (GT-AAAA-NNNNN) · asset (cNFT) · hash (SHA-256 del PDF). */
  @Public()
  @Get('certificates')
  buscar(@Query() query: unknown) {
    return this.publico.buscarCertificado(query);
  }
}
