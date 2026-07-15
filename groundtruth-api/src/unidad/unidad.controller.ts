import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { UnidadService } from './unidad.service';

@Controller('unidad')
@NeedsPrivilege('unidad.configurar')
export class UnidadController {
  constructor(private readonly unidad: UnidadService) {}

  @Get()
  get(@Req() req: OperadorRequest) {
    return this.unidad.get(req.operadorId);
  }

  @Patch()
  update(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.unidad.update(req.operadorId, req.usuarioId, body);
  }
}
