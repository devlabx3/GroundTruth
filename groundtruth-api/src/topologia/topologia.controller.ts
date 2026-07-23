import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Patch, Query, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { TopologiaService } from './topologia.service';

@Controller('topologia')
export class TopologiaController {
  constructor(private readonly topologia: TopologiaService) {}

  /** Fincas de la unidad (selector del alta de parcela, sin paginar). */
  @Get('fincas')
  @NeedsPrivilege('topologia.gestionar')
  listFincas(@Req() req: OperadorRequest) {
    return this.topologia.listFincas(req.operadorId);
  }

  /** Fincas de la unidad, paginadas/filtrables/ordenables — listado de gestión. */
  @Get('fincas/buscar')
  @NeedsPrivilege('topologia.gestionar')
  buscarFincas(
    @Req() req: OperadorRequest,
    @Query('nombre') nombre?: string,
    @Query('agricultor') agricultor?: string,
    @Query('pais') pais?: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '25',
    @Query('sortBy') sortBy: 'nombre' | 'agricultor' | 'pais' | 'areaHa' = 'nombre',
    @Query('sortDir') sortDir: 'asc' | 'desc' = 'asc',
  ) {
    return this.topologia.buscarFincas(
      req.operadorId,
      { nombre, agricultor, pais },
      Number(page),
      Number(pageSize),
      sortBy,
      sortDir,
    );
  }

  /** Alta de finca: crear una nueva finca en la unidad (opcionalmente con agricultor). */
  @Post('fincas')
  @NeedsPrivilege('topologia.gestionar')
  crearFinca(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.topologia.crearFinca(req.operadorId, req.usuarioId, body);
  }

  /** Alta de finca con agricultor encargado (flujo unificado con saga onchain). */
  @Post('fincas-con-agricultor')
  @NeedsPrivilege('topologia.gestionar')
  crearFincaConAgricultor(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.topologia.crearFincaConAgricultor(req.operadorId, req.usuarioId, body);
  }

  /** Editar finca: actualizar nombre, país y área. */
  @Patch('fincas/:id')
  @NeedsPrivilege('topologia.gestionar')
  editarFinca(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string, @Body() body: unknown) {
    return this.topologia.editarFinca(req.operadorId, id, req.usuarioId, body);
  }

  /** Alta de parcela: polígono + nodos. El servidor impone el gate de cobertura. */
  @Post('parcelas')
  @NeedsPrivilege('topologia.gestionar')
  crearParcela(@Req() req: OperadorRequest, @Body() body: unknown) {
    return this.topologia.crearParcela(req.operadorId, req.usuarioId, body);
  }

  /** Detalle de parcela: gestión O lectura de telemetría (Índice §5). */
  @Get('parcelas/:id')
  @NeedsPrivilege('topologia.gestionar', 'telemetria.ver')
  getParcela(@Req() req: OperadorRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.topologia.getParcela(req.operadorId, id);
  }

  @Get('parcelas')
  @NeedsPrivilege('topologia.gestionar', 'telemetria.ver')
  listParcelas(@Req() req: OperadorRequest) {
    return this.topologia.listParcelas(req.operadorId);
  }
}
