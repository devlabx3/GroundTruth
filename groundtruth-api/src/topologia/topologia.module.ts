import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { TopologiaController } from './topologia.controller';
import { TopologiaService } from './topologia.service';

@Module({
  imports: [AuthModule],
  controllers: [TopologiaController],
  providers: [TopologiaService],
})
export class TopologiaModule {}
