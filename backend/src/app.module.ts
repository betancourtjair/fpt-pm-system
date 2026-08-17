import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { TareasModule } from './tareas/tareas.module';
import { AlertasModule } from './alertas/alertas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Habilita @Cron(...) en AlertasService (Fase 2, PID sección 7) — el
    // cron diario que revisa recordatorios de 48h/24h.
    ScheduleModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CatalogoModule,
    UsuariosModule,
    ProyectosModule,
    TareasModule,
    AlertasModule,
  ],
})
export class AppModule {}
