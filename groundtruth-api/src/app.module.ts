import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env';
import { DomainExceptionFilter } from './common/domain-exception.filter';
import { DbModule } from './db/db.module';
import { AuthGuard } from './auth/auth.guard';
import { PrivilegesGuard } from './auth/privileges.guard';
import { HealthController } from './health/health.controller';
import { MeModule } from './me/me.module';
import { TopologiaModule } from './topologia/topologia.module';
import { TesoreriaModule } from './tesoreria/tesoreria.module';
import { EmbarquesModule } from './embarques/embarques.module';
import { CertificadosModule } from './certificados/certificados.module';
import { FarmerModule } from './farmer/farmer.module';
import { EquipoModule } from './equipo/equipo.module';
import { UnidadModule } from './unidad/unidad.module';
import { AgricultoresModule } from './agricultores/agricultores.module';
import { AdminModule } from './admin/admin.module';
import { SolanaModule } from './solana/solana.module';
import { EvidenciaModule } from './evidencia/evidencia.module';
import { PublicModule } from './public/public.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DbModule,
    SolanaModule,
    EvidenciaModule,
    PublicModule,
    MeModule,
    TopologiaModule,
    TesoreriaModule,
    EmbarquesModule,
    CertificadosModule,
    FarmerModule,
    EquipoModule,
    UnidadModule,
    AgricultoresModule,
    AdminModule,
    // Pendiente: webhook de Helius (depósitos a tesorería) y el programa Anchor.
  ],
  controllers: [HealthController],
  providers: [
    // Orden de guards = orden de evaluación: sesión → privilegio (Índice §2.1).
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: PrivilegesGuard },
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
