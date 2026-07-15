import { Module } from '@nestjs/common';
import { TesoreriaController } from './tesoreria.controller';
import { TesoreriaService } from './tesoreria.service';
import { DepositosService } from './depositos.service';
import { HeliusController } from './helius.controller';

@Module({
  controllers: [TesoreriaController, HeliusController],
  providers: [TesoreriaService, DepositosService],
  exports: [DepositosService],
})
export class TesoreriaModule {}
