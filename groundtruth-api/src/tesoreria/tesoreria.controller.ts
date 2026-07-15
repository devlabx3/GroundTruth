import { Controller, Get, Post, Req } from '@nestjs/common';
import { NeedsPrivilege } from '@/auth/needs-privilege.decorator';
import type { OperadorRequest } from '@/auth/privileges.guard';
import { TesoreriaService } from './tesoreria.service';
import { DepositosService } from './depositos.service';

@Controller('tesoreria')
export class TesoreriaController {
  constructor(
    private readonly tesoreria: TesoreriaService,
    private readonly depositos: DepositosService,
  ) {}

  @Get()
  @NeedsPrivilege('tesoreria.ver')
  getTesoreria(@Req() req: OperadorRequest) {
    return this.tesoreria.getTesoreria(req.operadorId);
  }

  @Get('saldo')
  @NeedsPrivilege('tesoreria.ver')
  getSaldo(@Req() req: OperadorRequest) {
    return this.tesoreria.getSaldo(req.operadorId);
  }

  /** Reconcilia contra la cadena a demanda (el operador acaba de depositar). */
  @Post('sincronizar')
  @NeedsPrivilege('tesoreria.ver')
  sincronizar(@Req() req: OperadorRequest) {
    return this.depositos.sincronizar(req.operadorId);
  }
}
