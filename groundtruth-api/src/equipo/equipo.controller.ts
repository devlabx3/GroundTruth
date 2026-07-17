import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { EquipoService } from './equipo.service';

@Controller('equipo')
@NeedsPrivilege('equipo.gestionar')
export class EquipoController {
  constructor(private readonly equipo: EquipoService) {}

  @Get()
  overview(@Req() req: OperadorRequest) {
    return this.equipo.overview(req.operadorId);
  }

  @Post('subroles')
  crearSubrol(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.equipo.crearSubrol(req.operadorId, body);
  }

  @Delete('subroles/:id')
  eliminarSubrol(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.equipo.eliminarSubrol(req.operadorId, id);
  }

  @Patch('miembros/:id')
  cambiarSubrol(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.equipo.cambiarSubrol(req.operadorId, id, body);
  }

  @Post('miembros/invitar')
  invitarMiembro(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.equipo.invitarMiembro(req.operadorId, req.usuarioId, body);
  }
}
