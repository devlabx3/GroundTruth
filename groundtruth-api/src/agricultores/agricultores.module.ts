import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { AgricultoresController } from './agricultores.controller';
import { AgricultoresService } from './agricultores.service';

@Module({
  imports: [AuthModule],
  controllers: [AgricultoresController],
  providers: [AgricultoresService],
})
export class AgricultoresModule {}
