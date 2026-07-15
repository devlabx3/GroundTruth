import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { CertificadosService } from './certificados.service';

@Controller('certificados')
export class CertificadosController {
  constructor(private readonly certificados: CertificadosService) {}

  @Get()
  @NeedsPrivilege('certificados.ver')
  list(@Req() req: OperadorRequest) {
    return this.certificados.list(req.operadorId);
  }

  @Get(':id')
  @NeedsPrivilege('certificados.ver')
  detail(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.certificados.detail(req.operadorId, id);
  }

  @Post(':id/revocar')
  @NeedsPrivilege('certificados.revocar')
  revocar(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.certificados.revocar(req.operadorId, req.usuarioId, id, body);
  }
}
