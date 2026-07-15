import { Module } from '@nestjs/common';
import { UnidadController } from './unidad.controller';
import { UnidadService } from './unidad.service';

@Module({
  controllers: [UnidadController],
  providers: [UnidadService],
})
export class UnidadModule {}
