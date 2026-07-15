import { Module } from '@nestjs/common';
import { CertificadosController } from './certificados.controller';
import { CertificadosService } from './certificados.service';

@Module({
  controllers: [CertificadosController],
  providers: [CertificadosService],
  exports: [CertificadosService], // el Admin revoca reusando este servicio
})
export class CertificadosModule {}
