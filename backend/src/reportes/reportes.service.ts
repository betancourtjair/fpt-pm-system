import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tarea } from '../entities/tarea.entity';
import { JwtPayload } from '../auth/auth.service';
import { ProyectosService } from '../proyectos/proyectos.service';

interface FilaResumen {
  direccionId: number;
  direccionNombre: string;
  totalProyectos: string;
  totalTareas: string;
  tareasCompletadas: string;
  tareasVencidas: string;
  tiempoPromedioFinalizacionDias: string | null;
}

interface FilaMes {
  mes: string;
  total: string;
}

// Dashboard ejecutivo con tendencias (mejora solicitada por dirección, no
// forma parte del PID original): a diferencia de "Inicio" que muestra una
// foto del momento, aquí se compara mes contra mes usando tareas.creado_en /
// completada_en (columnas agregadas específicamente para esto — ver README
// sobre la limitación de creado_en en tareas preexistentes a la migración).
// Reutiliza el mismo alcance por rol que el resto de la app.
@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Tarea) private readonly tareas: Repository<Tarea>,
    private readonly proyectosService: ProyectosService,
  ) {}

  private async idsParam(user: JwtPayload): Promise<number[] | null> {
    const idsEnAlcance = await this.proyectosService.proyectoIdsEnAlcance(user);
    return idsEnAlcance === 'all' ? null : idsEnAlcance;
  }

  // % de cumplimiento, vencidas y tiempo promedio de finalización, agrupado
  // por Dirección — una fila por Dirección con al menos un proyecto en el
  // alcance del usuario (LEFT JOIN a tareas para no perder Direcciones cuyos
  // proyectos todavía no tienen tareas cargadas).
  async resumen(user: JwtPayload) {
    const idsParam = await this.idsParam(user);

    const filas: FilaResumen[] = await this.tareas.query(
      `WITH proyecto_direccion AS (
         SELECT DISTINCT pa.proyecto_id, a.direccion_id
         FROM proyecto_areas pa
         JOIN areas a ON a.id = pa.area_id
         WHERE ($1::int[] IS NULL OR pa.proyecto_id = ANY($1))
       )
       SELECT d.id AS "direccionId",
              d.nombre AS "direccionNombre",
              COUNT(DISTINCT pd.proyecto_id) AS "totalProyectos",
              COUNT(t.id) AS "totalTareas",
              COUNT(*) FILTER (WHERE t.estatus = 'completada') AS "tareasCompletadas",
              COUNT(*) FILTER (WHERE t.estatus <> 'completada' AND t.fecha_fin < CURRENT_DATE) AS "tareasVencidas",
              AVG(EXTRACT(EPOCH FROM (t.completada_en - t.creado_en)) / 86400)
                FILTER (WHERE t.completada_en IS NOT NULL) AS "tiempoPromedioFinalizacionDias"
       FROM direcciones d
       JOIN proyecto_direccion pd ON pd.direccion_id = d.id
       LEFT JOIN tareas t ON t.proyecto_id = pd.proyecto_id
       GROUP BY d.id, d.nombre
       ORDER BY d.nombre ASC`,
      [idsParam],
    );

    return filas.map((f) => {
      const totalTareas = Number(f.totalTareas);
      const tareasCompletadas = Number(f.tareasCompletadas);
      return {
        direccionId: f.direccionId,
        direccionNombre: f.direccionNombre,
        totalProyectos: Number(f.totalProyectos),
        totalTareas,
        tareasCompletadas,
        tareasVencidas: Number(f.tareasVencidas),
        porcentajeCumplimiento: totalTareas > 0 ? Math.round((tareasCompletadas / totalTareas) * 100) : 0,
        tiempoPromedioFinalizacionDias:
          f.tiempoPromedioFinalizacionDias !== null ? Math.round(Number(f.tiempoPromedioFinalizacionDias) * 10) / 10 : null,
      };
    });
  }

  // Serie mensual de los últimos `meses` meses (default 6, tope 24 — evita
  // que alguien pida un histórico gigantesco por accidente). Los meses sin
  // actividad se rellenan con ceros en TS en vez de dejarlos fuera, porque
  // un hueco en la gráfica se lee como error de datos, no como "cero".
  async tendencia(user: JwtPayload, meses: number) {
    const n = Math.min(Math.max(1, meses), 24);
    const idsParam = await this.idsParam(user);

    // Primer día del mes más antiguo del rango, para acotar las tres
    // consultas sin tener que repetir el cálculo de fechas en SQL.
    const hoy = new Date();
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - (n - 1), 1);

    const [creadas, completadas, automatizaciones]: [FilaMes[], FilaMes[], FilaMes[]] = await Promise.all([
      this.tareas.query(
        `SELECT to_char(date_trunc('month', t.creado_en), 'YYYY-MM') AS mes, COUNT(*) AS total
         FROM tareas t
         WHERE t.creado_en >= $2 AND ($1::int[] IS NULL OR t.proyecto_id = ANY($1))
         GROUP BY mes`,
        [idsParam, inicio],
      ),
      this.tareas.query(
        `SELECT to_char(date_trunc('month', t.completada_en), 'YYYY-MM') AS mes, COUNT(*) AS total
         FROM tareas t
         WHERE t.completada_en IS NOT NULL AND t.completada_en >= $2
           AND ($1::int[] IS NULL OR t.proyecto_id = ANY($1))
         GROUP BY mes`,
        [idsParam, inicio],
      ),
      this.tareas.query(
        `SELECT to_char(date_trunc('month', np.creado_en), 'YYYY-MM') AS mes, COUNT(*) AS total
         FROM notificaciones_personalizadas np
         JOIN tareas t ON t.id = np.tarea_id
         WHERE np.tipo = 'automatizacion' AND np.creado_en >= $2
           AND ($1::int[] IS NULL OR t.proyecto_id = ANY($1))
         GROUP BY mes`,
        [idsParam, inicio],
      ),
    ]);

    const mapaCreadas = new Map(creadas.map((f) => [f.mes, Number(f.total)]));
    const mapaCompletadas = new Map(completadas.map((f) => [f.mes, Number(f.total)]));
    const mapaAutomatizaciones = new Map(automatizaciones.map((f) => [f.mes, Number(f.total)]));

    const resultado: {
      mes: string;
      tareasCreadas: number;
      tareasCompletadas: number;
      automatizacionesActivadas: number;
    }[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const clave = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      resultado.push({
        mes: clave,
        tareasCreadas: mapaCreadas.get(clave) ?? 0,
        tareasCompletadas: mapaCompletadas.get(clave) ?? 0,
        automatizacionesActivadas: mapaAutomatizaciones.get(clave) ?? 0,
      });
    }
    return resultado;
  }
}
