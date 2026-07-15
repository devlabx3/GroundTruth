import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { AgricultoresService } from './agricultores.service';

@Controller('agricultores')
@NeedsPrivilege('agricultores.gestionar')
export class AgricultoresController {
  constructor(private readonly agricultores: AgricultoresService) {}

  @Get()
  list(@Req() req: OperadorRequest) {
    return this.agricultores.list(req.operadorId);
  }

  @Post()
  crear(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.agricultores.crear(req.operadorId, req.usuarioId, body);
  }
}
