import { Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { AuthedRequest } from '@/auth/auth.guard';
import { FarmerService } from './farmer.service';

/**
 * DApp lite del agricultor. Solo requiere sesión (AuthGuard global); NO usa
 * PrivilegesGuard ni `x-operador-id` — la autorización es por propiedad de finca.
 */
@Controller('farmer')
export class FarmerController {
  constructor(private readonly farmer: FarmerService) {}

  @Get('alertas')
  alertas(@Req() req: AuthedRequest) {
    return this.farmer.alertas(req.authUserId);
  }

  @Get('parcelas')
  parcelas(@Req() req: AuthedRequest) {
    return this.farmer.parcelas(req.authUserId);
  }

  @Get('parcelas/:id')
  parcela(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.farmer.parcela(req.authUserId, id);
  }

  @Post('parcelas/:id/nueva-siembra')
  nuevaSiembra(@Req() req: AuthedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.farmer.nuevaSiembra(req.authUserId, id);
  }
}
