import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard, type AdminRequest } from '@/auth/admin.guard';
import { AdminUnidadesService } from './unidades.service';
import { AdminIdentidadService } from './identidad.service';
import { AdminParametrosService } from './parametros.service';
import { AdminSupervisionService } from './supervision.service';
import { AdminIntegracionesService } from './integraciones.service';
import { AdminSimuladorService } from './simulador.service';
import { AdminFinanzasService } from './finanzas.service';

/**
 * Superficie del Admin de plataforma. Todo cuelga de /admin y de `AdminGuard`
 * (usuarios.es_admin): ningún endpoint de aquí acepta `x-operador-id`, porque el
 * admin no pertenece a una unidad — las cruza todas.
 */

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminHomeController {
  constructor(private readonly supervision: AdminSupervisionService) {}

  @Get('overview')
  overview() {
    return this.supervision.overview();
  }

  /** Supervisión global (A6): parcelas de todas las unidades. */
  @Get('parcelas')
  parcelas() {
    return this.supervision.parcelas();
  }
}

@Controller('admin/unidades')
@UseGuards(AdminGuard)
export class AdminUnidadesController {
  constructor(private readonly unidades: AdminUnidadesService) {}

  @Get()
  list() {
    return this.unidades.list();
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.unidades.detail(id);
  }

  @Post()
  create(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.unidades.create(req.usuarioId, body);
  }

  @Patch(':id')
  setEstado(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.unidades.setEstado(req.usuarioId, id, body);
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminIdentidadController {
  constructor(private readonly identidad: AdminIdentidadService) {}

  @Get('usuarios')
  listUsuarios() {
    return this.identidad.listUsuarios();
  }

  @Post('usuarios')
  crearUsuario(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.identidad.crearUsuario(req.usuarioId, body);
  }

  @Post('usuarios/:id/desactivar')
  desactivarUsuario(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.identidad.desactivarUsuario(req.usuarioId, id);
  }

  @Get('privilegios')
  listPrivilegios() {
    return this.identidad.listPrivilegios();
  }

  @Post('privilegios')
  crearPrivilegio(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.identidad.crearPrivilegio(req.usuarioId, body);
  }

  @Post('privilegios/:id/deprecar')
  deprecarPrivilegio(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.identidad.deprecarPrivilegio(req.usuarioId, id);
  }
}

@Controller('admin/parametros')
@UseGuards(AdminGuard)
export class AdminParametrosController {
  constructor(private readonly parametros: AdminParametrosService) {}

  @Get()
  get() {
    return this.parametros.get();
  }

  @Patch()
  update(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.parametros.update(req.usuarioId, body);
  }

  @Get('auditoria')
  auditoria() {
    return this.parametros.auditoria();
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminSagaController {
  constructor(private readonly supervision: AdminSupervisionService) {}

  /** Auditoría del saga (A7). */
  @Get('saga')
  sagas() {
    return this.supervision.sagas();
  }

  @Post('saga/:id/retry')
  retry(@Req() req: AdminRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.supervision.retrySaga(req.usuarioId, id);
  }

  /** Revocación global (A8). */
  @Get('certificados')
  certificados() {
    return this.supervision.certificados();
  }

  @Post('certificados/:id/revocar')
  revocar(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.supervision.revocarCertificado(req.usuarioId, id, body);
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminOpsController {
  constructor(
    private readonly integraciones: AdminIntegracionesService,
    private readonly simulador: AdminSimuladorService,
  ) {}

  /** Salud de integraciones (A9). */
  @Get('integraciones')
  listIntegraciones() {
    return this.integraciones.list();
  }

  /** Simulador IoT (A5). */
  @Get('simulador/nodos')
  nodos() {
    return this.simulador.nodos();
  }

  @Patch('simulador/nodos/:id')
  setActivo(
    @Req() req: AdminRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: unknown,
  ) {
    return this.simulador.setActivo(req.usuarioId, id, body);
  }

  @Post('simulador/generar')
  generar(@Req() req: AdminRequest, @Body() body: unknown) {
    return this.simulador.generar(req.usuarioId, body);
  }
}

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminFinanzasController {
  constructor(private readonly finanzas: AdminFinanzasService) {}

  /** Finanzas de plataforma: ingresos, fondo de gas y agregados (solo lectura). */
  @Get('finanzas')
  resumen() {
    return this.finanzas.finanzas();
  }
}
