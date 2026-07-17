import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { EquipoController } from './equipo.controller';
import { EquipoService } from './equipo.service';

@Module({
  imports: [AuthModule],
  controllers: [EquipoController],
  providers: [EquipoService],
})
export class EquipoModule {}
