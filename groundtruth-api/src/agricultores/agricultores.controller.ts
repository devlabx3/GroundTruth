import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { AgricultoresService } from './agricultores.service';

@Controller('agricultores')
@NeedsPrivilege('agricultores.gestionar')
export class AgricultoresController {
  constructor(private readonly agricultores: AgricultoresService) {}

  @Get()
  list(
    @Req() req: OperadorRequest,
    @Query('nombre') nombre?: string,
    @Query('email') email?: string,
    @Query('finca') finca?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '25',
  ) {
    return this.agricultores.list(
      req.operadorId,
      { nombre, email, finca },
      Number(page),
      Number(pageSize),
    );
  }

  @Post()
  crear(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.agricultores.crear(req.operadorId, req.usuarioId, body);
  }

  @Patch('fincas/:fincaId')
  reasignarFinca(
    @Param('fincaId') fincaId: string,
    @Req() req: OperadorRequest,
    @Body() body: unknown,
  ) {
    return this.agricultores.reasignarFinca(req.operadorId, fincaId, req.usuarioId, body);
  }
}
