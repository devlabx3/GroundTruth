import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { EmbarquesService } from './embarques.service';

@Controller('embarques')
export class EmbarquesController {
  constructor(private readonly embarques: EmbarquesService) {}

  @Get()
  @NeedsPrivilege('embarques.preparar')
  list(@Req() req: OperadorRequest) {
    return this.embarques.list(req.operadorId);
  }

  @Get(':id')
  @NeedsPrivilege('embarques.preparar')
  detail(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.embarques.detail(req.operadorId, id);
  }

  @Post()
  @NeedsPrivilege('embarques.preparar')
  create(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.embarques.create(req.operadorId, req.usuarioId, body, req.privileges);
  }

  /** Emisión: exige el privilegio sensible `certificados.emitir` (separación
   *  preparador/aprobador, Errores §5.4). */
  @Post(':id/certificar')
  @NeedsPrivilege('certificados.emitir')
  certificar(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.embarques.certificar(req.operadorId, req.usuarioId, id);
  }
}
