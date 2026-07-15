import { Module } from '@nestjs/common';
import { EmbarquesController } from './embarques.controller';
import { EmbarquesService } from './embarques.service';

@Module({
  controllers: [EmbarquesController],
  providers: [EmbarquesService],
  exports: [EmbarquesService], // el reintento del saga (Admin) reusa `certificar`
})
export class EmbarquesModule {}
