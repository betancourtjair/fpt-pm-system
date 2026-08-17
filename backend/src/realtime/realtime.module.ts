import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { AuthModule } from '../auth/auth.module';
import { ProyectosModule } from '../proyectos/proyectos.module';

// Fase 2 completa (PID sección 7): WebSockets para el Gantt en vivo +
// notificaciones in-app. AuthModule se importa solo para reutilizar el
// JwtService ya configurado (mismo secreto que la API REST); ProyectosModule
// para reutilizar puedeVer() y no duplicar la regla de alcance por rol.
@Module({
  imports: [AuthModule, ProyectosModule],
  providers: [RealtimeGateway],
  // Nada lo importa directamente: TareasService y AlertasService le hablan
  // por EventEmitter2 (eventos 'tarea.cambio' / 'notificacion.creada'), no
  // por inyección — así este módulo no necesita depender de TareasModule ni
  // viceversa.
})
export class RealtimeModule {}
