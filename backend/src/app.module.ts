import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ProyectosModule } from './proyectos/proyectos.module';
import { TareasModule } from './tareas/tareas.module';
import { AlertasModule } from './alertas/alertas.module';
import { NotificacionesModule } from './notificaciones/notificaciones.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Habilita @Cron(...) en AlertasService (Fase 2, PID sección 7) — el
    // cron diario que revisa recordatorios de 48h/24h.
    ScheduleModule.forRoot(),
    // Bus de eventos internos (Fase 2, PID sección 7): TareasService y
    // AlertasService emiten eventos ('tarea.cambio', 'notificacion.creada')
    // que RealtimeGateway escucha para retransmitir por WebSocket — así
    // ninguno de los dos necesita depender directamente del gateway.
    EventEmitterModule.forRoot(),
    DatabaseModule,
    HealthModule,
    AuthModule,
    CatalogoModule,
    UsuariosModule,
    ProyectosModule,
    TareasModule,
    AlertasModule,
    NotificacionesModule,
    RealtimeModule,
  ],
})
export class AppModule {}
