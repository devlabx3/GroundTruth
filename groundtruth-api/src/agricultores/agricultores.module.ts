import { Module } from '@nestjs/common';
import { AgricultoresController } from './agricultores.controller';
import { AgricultoresService } from './agricultores.service';

@Module({
  controllers: [AgricultoresController],
  providers: [AgricultoresService],
})
export class AgricultoresModule {}
