import { Module } from '@nestjs/common';
import { TopologiaController } from './topologia.controller';
import { TopologiaService } from './topologia.service';

@Module({
  controllers: [TopologiaController],
  providers: [TopologiaService],
})
export class TopologiaModule {}
