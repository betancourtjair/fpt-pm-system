import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AlertaEnviada } from '../entities/alerta-enviada.entity';

// Bitácora de solo lectura (Fase 2, PID sección 7) — le sirve al admin para
// confirmar que las alertas se están mandando (o ver por qué falló alguna)
// sin tener que entrar directo a la base de datos.
@Controller('alertas')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AlertasController {
  constructor(
    @InjectRepository(AlertaEnviada) private readonly alertas: Repository<AlertaEnviada>,
  ) {}

  @Roles('admin')
  @Get()
  async listar() {
    const registros = await this.alertas.find({
      relations: { tarea: true, usuario: true },
      order: { id: 'DESC' },
      take: 200,
    });
    return registros.map((a) => ({
      id: a.id,
      tarea: a.tarea ? { id: a.tarea.id, nombre: a.tarea.nombre } : null,
      usuario: a.usuario ? { id: a.usuario.id, nombre: a.usuario.nombre, email: a.usuario.email } : null,
      tipo: a.tipo,
      estatusEnvio: a.estatusEnvio,
      fechaProgramada: a.fechaProgramada,
      fechaEnviada: a.fechaEnviada,
      intentos: a.intentos,
    }));
  }
}
