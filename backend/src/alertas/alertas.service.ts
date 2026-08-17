import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AlertaEnviada, TipoAlerta } from '../entities/alerta-enviada.entity';
import { Tarea } from '../entities/tarea.entity';
import { Usuario } from '../entities/usuario.entity';
import { EmailService } from '../common/email.service';
import {
  asuntoAsignacion,
  asuntoBloqueada,
  asuntoRecordatorio,
  asuntoVencida,
  htmlAsignacion,
  htmlBloqueada,
  htmlRecordatorio,
  htmlVencida,
} from './plantillas';

interface DatosTarea {
  id: number;
  nombre: string;
  fechaFin: string;
  proyectoNombre: string;
}

interface FilaTareaPorVencer {
  id: number;
  nombre: string;
  fecha_fin: string;
  responsable_id: number | null;
  proyecto_nombre: string;
  dias_restantes: number;
}

// Fase 2 del roadmap (PID sección 7): cuatro tipos de alerta por correo —
// "asignacion" (se dispara desde TareasService al crear/actualizar una
// tarea), "48h", "24h" y "vencida" (las revisa el cron diario de este
// servicio). La tabla alertas_enviadas (db/schema.sql) es la fuente de
// verdad para no duplicar envíos: su UNIQUE(tarea_id, usuario_id, tipo) es
// lo que hace segura la idempotencia en registrarYEnviar() — "vencida" solo
// se manda una vez por tarea+usuario aunque la tarea siga abierta muchos
// días después de su fecha límite.
//
// fecha_fin en tareas es DATE (sin hora), así que 48h/24h solo se pueden
// calcular con granularidad de días completos — de ahí que el cron corra
// una vez al día en vez de contar horas exactas (ver resumen del PID).
@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    @InjectRepository(AlertaEnviada) private readonly alertasRepo: Repository<AlertaEnviada>,
    @InjectRepository(Tarea) private readonly tareasRepo: Repository<Tarea>,
    @InjectRepository(Usuario) private readonly usuariosRepo: Repository<Usuario>,
    private readonly email: EmailService,
    // Notificaciones in-app (Fase 2 completa, PID sección 7): emitimos
    // 'notificacion.creada' y RealtimeGateway la retransmite por WebSocket
    // a la room personal del usuario — desacoplado a propósito (este
    // servicio no conoce ni importa el gateway).
    private readonly eventos: EventEmitter2,
  ) {}

  // Llamado desde TareasService cuando se crea una tarea o cuando una
  // actualización agrega responsable/usuarios que antes no estaban
  // asignados — nunca se le vuelve a avisar a alguien que ya estaba.
  async notificarAsignacion(tareaId: number, usuarioIds: number[]): Promise<void> {
    const idsUnicos = [...new Set(usuarioIds)].filter((id) => Boolean(id));
    if (idsUnicos.length === 0) return;

    const tarea = await this.tareasRepo.findOne({ where: { id: tareaId }, relations: { proyecto: true } });
    if (!tarea) return;

    const usuarios = await this.usuariosRepo.find({ where: { id: In(idsUnicos) } });
    const datosTarea: DatosTarea = {
      id: tarea.id,
      nombre: tarea.nombre,
      fechaFin: tarea.fechaFin,
      proyectoNombre: tarea.proyecto?.nombre ?? '',
    };

    for (const usuario of usuarios) {
      if (!usuario.activo) continue;
      await this.registrarYEnviar({
        tareaId,
        usuarioId: usuario.id,
        tipo: 'asignacion',
        destinatario: usuario.email,
        datosTarea,
      });
    }
  }

  // Automatización simple #2 (mejora sugerida, ver README sección 4):
  // llamado desde TareasService cuando una tarea pasa a "bloqueada" — avisa
  // a cada Director cuya Dirección incluya alguna de las áreas del
  // proyecto (un proyecto puede tocar más de una Dirección, aunque no sea
  // lo usual). "Director" se resuelve igual que el resto del sistema: rol
  // 'director' cuya área de inicio de sesión cuelga de esa Dirección.
  async notificarTareaBloqueada(tareaId: number): Promise<void> {
    const tarea = await this.tareasRepo.findOne({ where: { id: tareaId }, relations: { proyecto: true } });
    if (!tarea) return;

    const directores: { id: number; email: string; activo: boolean }[] = await this.usuariosRepo.query(
      `SELECT DISTINCT u.id, u.email, u.activo
       FROM usuarios u
       JOIN roles r ON r.id = u.rol_id
       JOIN areas a ON a.id = u.area_id
       WHERE r.nombre = 'director'
         AND a.direccion_id IN (
           SELECT DISTINCT a2.direccion_id FROM proyecto_areas pa
           JOIN areas a2 ON a2.id = pa.area_id
           WHERE pa.proyecto_id = $1
         )`,
      [tarea.proyectoId],
    );
    if (directores.length === 0) return;

    const datosTarea: DatosTarea = {
      id: tarea.id,
      nombre: tarea.nombre,
      fechaFin: tarea.fechaFin,
      proyectoNombre: tarea.proyecto?.nombre ?? '',
    };
    for (const director of directores) {
      if (!director.activo) continue;
      await this.registrarYEnviar({
        tareaId,
        usuarioId: director.id,
        tipo: 'bloqueada',
        destinatario: director.email,
        datosTarea,
      });
    }
  }

  // Cron diario — 8:00am hora del servidor. Revisa todas las tareas no
  // completadas cuya fecha_fin quede a exactamente 2 o 1 días de hoy, o
  // que ya hayan pasado su fecha_fin (alerta "vencida", una sola vez).
  @Cron('0 8 * * *')
  async tareaProgramadaDiaria(): Promise<void> {
    const resultado = await this.revisarRecordatorios();
    this.logger.log(
      `Revisión diaria de vencimientos: ${resultado.revisadas} tareas revisadas, ${resultado.notificaciones} notificaciones enviadas.`,
    );
  }

  // Separado de tareaProgramadaDiaria() para poder invocarlo a mano
  // (pruebas, o un endpoint /alertas/revisar si algún día se necesita)
  // sin depender del reloj del cron.
  async revisarRecordatorios(): Promise<{ revisadas: number; notificaciones: number }> {
    // OJO: to_char(...) fuerza fecha_fin a texto 'YYYY-MM-DD' en la propia
    // consulta. Sin esto, el driver de pg regresa un objeto Date de JS para
    // columnas DATE (a diferencia de TypeORM/repository, que sí da string),
    // y formatearFecha() en plantillas.ts truena al hacer .split('-') sobre
    // un Date. Formatear aquí también evita el riesgo de que un Date se
    // corra un día al convertirlo por zona horaria.
    const tareas: FilaTareaPorVencer[] = await this.tareasRepo.query(
      `SELECT t.id, t.nombre, to_char(t.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, t.responsable_id, p.nombre AS proyecto_nombre,
              (t.fecha_fin - CURRENT_DATE) AS dias_restantes
       FROM tareas t
       JOIN proyectos p ON p.id = t.proyecto_id
       WHERE t.estatus <> 'completada'
         AND ((t.fecha_fin - CURRENT_DATE) IN (1, 2) OR t.fecha_fin < CURRENT_DATE)`,
    );

    if (tareas.length === 0) return { revisadas: 0, notificaciones: 0 };

    const tareaIds = tareas.map((t) => t.id);
    const asignaciones: Array<{ tarea_id: number; usuario_id: number }> = await this.tareasRepo.query(
      `SELECT tarea_id, usuario_id FROM tarea_usuarios WHERE tarea_id = ANY($1)`,
      [tareaIds],
    );

    const usuarioIdsPorTarea = new Map<number, Set<number>>();
    for (const t of tareas) {
      const asignados = new Set<number>();
      if (t.responsable_id) asignados.add(t.responsable_id);
      usuarioIdsPorTarea.set(t.id, asignados);
    }
    for (const a of asignaciones) {
      usuarioIdsPorTarea.get(a.tarea_id)?.add(a.usuario_id);
    }

    const todosLosUsuarioIds = [...new Set([...usuarioIdsPorTarea.values()].flatMap((s) => [...s]))];
    const usuarios = todosLosUsuarioIds.length
      ? await this.usuariosRepo.find({ where: { id: In(todosLosUsuarioIds) } })
      : [];
    const usuarioPorId = new Map(usuarios.map((u) => [u.id, u]));

    let notificaciones = 0;
    for (const t of tareas) {
      const tipo: TipoAlerta = t.dias_restantes === 2 ? '48h' : t.dias_restantes === 1 ? '24h' : 'vencida';
      const datosTarea: DatosTarea = {
        id: t.id,
        nombre: t.nombre,
        fechaFin: t.fecha_fin,
        proyectoNombre: t.proyecto_nombre,
      };
      const usuarioIds = usuarioIdsPorTarea.get(t.id) ?? new Set<number>();
      for (const usuarioId of usuarioIds) {
        const usuario = usuarioPorId.get(usuarioId);
        if (!usuario || !usuario.activo) continue;
        const enviado = await this.registrarYEnviar({
          tareaId: t.id,
          usuarioId,
          tipo,
          destinatario: usuario.email,
          datosTarea,
        });
        if (enviado) notificaciones++;
      }
    }
    return { revisadas: tareas.length, notificaciones };
  }

  // IMPORTANTE: primero se inserta el registro "pendiente" con
  // ON CONFLICT DO NOTHING (orIgnore) y solo si esa inserción realmente
  // ocurrió se manda el correo — así, si el cron o esta función se llaman
  // dos veces para la misma combinación tarea+usuario+tipo, la segunda vez
  // no reenvía nada (la tabla ya tiene la fila).
  private async registrarYEnviar(args: {
    tareaId: number;
    usuarioId: number;
    tipo: TipoAlerta;
    destinatario: string;
    datosTarea: DatosTarea;
  }): Promise<boolean> {
    const insertado = await this.alertasRepo
      .createQueryBuilder()
      .insert()
      .into(AlertaEnviada)
      .values({
        tareaId: args.tareaId,
        usuarioId: args.usuarioId,
        tipo: args.tipo,
        fechaProgramada: new Date(),
        estatusEnvio: 'pendiente',
        intentos: 0,
      })
      .orIgnore()
      .execute();

    // OJO: con ON CONFLICT DO NOTHING, TypeORM SIEMPRE regresa un elemento
    // en `identifiers` por cada fila de entrada (viene en null si el INSERT
    // fue ignorado por el conflicto) — por eso NO sirve para detectar si de
    // verdad se insertó. `raw` sí refleja solo las filas que RETURNING
    // realmente devolvió (0 filas si hubo conflicto y se ignoró), así que es
    // el campo correcto para decidir si esta llamada "ganó" la inserción y
    // debe mandar el correo, o si ya existía y hay que no hacer nada.
    if (insertado.raw.length === 0) {
      return false;
    }

    // Se emite ya mismo, independiente de si el correo se logra mandar o
    // no más abajo — la notificación in-app es la red de seguridad cuando
    // Resend falla o el tope diario se alcanza (ver EmailService).
    this.eventos.emit('notificacion.creada', {
      usuarioId: args.usuarioId,
      notificacion: {
        id: insertado.raw[0].id as number,
        tipo: args.tipo,
        tareaId: args.tareaId,
        tareaNombre: args.datosTarea.nombre,
        fechaProgramada: new Date(),
      },
    });

    let asunto: string;
    let html: string;
    if (args.tipo === 'asignacion') {
      asunto = asuntoAsignacion(args.datosTarea);
      html = htmlAsignacion(args.datosTarea);
    } else if (args.tipo === 'vencida') {
      asunto = asuntoVencida(args.datosTarea);
      html = htmlVencida(args.datosTarea);
    } else if (args.tipo === 'bloqueada') {
      asunto = asuntoBloqueada(args.datosTarea);
      html = htmlBloqueada(args.datosTarea);
    } else {
      asunto = asuntoRecordatorio(args.datosTarea, args.tipo);
      html = htmlRecordatorio(args.datosTarea, args.tipo);
    }

    const resultado = await this.email.enviar(args.destinatario, asunto, html);

    await this.alertasRepo.update(
      { tareaId: args.tareaId, usuarioId: args.usuarioId, tipo: args.tipo },
      {
        estatusEnvio: resultado.ok ? 'enviado' : 'fallido',
        fechaEnviada: resultado.ok ? new Date() : null,
        intentos: 1,
      },
    );

    if (!resultado.ok) {
      this.logger.warn(
        `Alerta ${args.tipo} de la tarea ${args.tareaId} para el usuario ${args.usuarioId} quedó marcada como fallida: ${resultado.error}`,
      );
    }
    return resultado.ok;
  }
}
