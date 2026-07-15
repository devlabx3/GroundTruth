import { Module } from '@nestjs/common';
import { CertificadosModule } from '@/certificados/certificados.module';
import { EmbarquesModule } from '@/embarques/embarques.module';
import {
  AdminFinanzasController,
  AdminHomeController,
  AdminIdentidadController,
  AdminOpsController,
  AdminParametrosController,
  AdminSagaController,
  AdminUnidadesController,
} from './admin.controller';
import { AdminUnidadesService } from './unidades.service';
import { AdminIdentidadService } from './identidad.service';
import { AdminParametrosService } from './parametros.service';
import { AdminSupervisionService } from './supervision.service';
import { AdminIntegracionesService } from './integraciones.service';
import { AdminSimuladorService } from './simulador.service';
import { AdminFinanzasService } from './finanzas.service';

/**
 * Admin importa Certificados y Embarques para REUSAR sus servicios (revocar,
 * certificar) en vez de reimplementarlos: una sola ruta de emisión y revocación
 * en todo el sistema, con su transacción y su idempotencia.
 */
@Module({
  imports: [CertificadosModule, EmbarquesModule],
  controllers: [
    AdminHomeController,
    AdminUnidadesController,
    AdminIdentidadController,
    AdminParametrosController,
    AdminSagaController,
    AdminOpsController,
    AdminFinanzasController,
  ],
  providers: [
    AdminUnidadesService,
    AdminIdentidadService,
    AdminParametrosService,
    AdminSupervisionService,
    AdminIntegracionesService,
    AdminSimuladorService,
    AdminFinanzasService,
  ],
})
export class AdminModule {}
