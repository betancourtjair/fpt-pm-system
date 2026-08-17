import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';

// Búsqueda global (tercera ronda de mejoras, ver README sección 4): un
// buscador arriba que encuentra un proyecto, tarea o comentario por palabra
// clave sin tener que entrar proyecto por proyecto. Reutiliza
// ProyectosService.proyectoIdsEnAlcance() para nunca regresar algo que el
// usuario no vería ya navegando la app (mismo alcance por rol de siempre).
@Injectable()
export class BusquedaService {
  constructor(
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    private readonly proyectosService: ProyectosService,
  ) {}

  async buscar(termino: string, user: JwtPayload) {
    const q = termino.trim();
    if (q.length < 2) {
      return { proyectos: [], tareas: [], comentarios: [] };
    }
    const idsEnAlcance = await this.proyectosService.proyectoIdsEnAlcance(user);
    const idsParam = idsEnAlcance === 'all' ? null : idsEnAlcance;
    const like = `%${q}%`;

    const [proyectos, tareas, comentarios] = await Promise.all([
      this.tareas.query(
        `SELECT id, nombre FROM proyectos
         WHERE nombre ILIKE $1 AND ($2::int[] IS NULL OR id = ANY($2))
         ORDER BY nombre ASC LIMIT 10`,
        [like, idsParam],
      ),
      this.tareas.query(
        `SELECT t.id, t.nombre, t.proyecto_id AS "proyectoId", p.nombre AS "proyectoNombre"
         FROM tareas t JOIN proyectos p ON p.id = t.proyecto_id
         WHERE t.nombre ILIKE $1 AND ($2::int[] IS NULL OR t.proyecto_id = ANY($2))
         ORDER BY t.nombre ASC LIMIT 10`,
        [like, idsParam],
      ),
      this.tareas.query(
        `SELECT c.id, c.texto, c.tarea_id AS "tareaId", t.nombre AS "tareaNombre",
                t.proyecto_id AS "proyectoId", p.nombre AS "proyectoNombre"
         FROM comentarios_tarea c
         JOIN tareas t ON t.id = c.tarea_id
         JOIN proyectos p ON p.id = t.proyecto_id
         WHERE c.texto ILIKE $1 AND ($2::int[] IS NULL OR t.proyecto_id = ANY($2))
         ORDER BY c.creado_en DESC LIMIT 10`,
        [like, idsParam],
      ),
    ]);

    return { proyectos, tareas, comentarios };
  }
}
