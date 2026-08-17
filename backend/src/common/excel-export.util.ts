// Exportación a Excel de Proyectos y Tareas (prioridad 9 de la lista) —
// reutiliza exceljs, que ya era dependencia del backend para la plantilla
// de carga masiva de usuarios (ver usuarios/excel-usuarios.util.ts). Solo
// exporta lo que el usuario ya puede ver: ambos generadores reciben datos
// ya filtrados/serializados por ProyectosService/TareasService (mismo
// alcance por rol y misma regla de visibilidad de presupuesto que en la
// pantalla — nunca se agrega aquí un campo que el usuario no vería en la app).
import ExcelJS from 'exceljs';

const PRIMARY_DARK = 'FF2E0A4D';
const WHITE = 'FFFFFFFF';

function encabezado(ws: ExcelJS.Worksheet, textos: string[]) {
  const fila = ws.addRow(textos);
  fila.eachCell((c) => {
    c.font = { name: 'Arial', bold: true, color: { argb: WHITE } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRIMARY_DARK } };
  });
  ws.views = [{ state: 'frozen', ySplit: fila.number }];
}

export interface FilaProyectoExcel {
  nombre: string;
  areas: string;
  responsable: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
  presupuesto?: number;
  gastoTotal?: number;
}

export async function generarExcelProyectos(filas: FilaProyectoExcel[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gestión de Proyectos — Fitness Para Todos';
  const ws = wb.addWorksheet('Proyectos');

  const conPresupuesto = filas.some((f) => f.presupuesto !== undefined);
  const columnas = ['Nombre', 'Áreas', 'Responsable', 'Fecha inicio', 'Fecha fin', 'Estatus'];
  if (conPresupuesto) columnas.push('Presupuesto (MXN)', 'Gasto real (MXN)');
  encabezado(ws, columnas);

  ws.columns = [
    { width: 32 },
    { width: 28 },
    { width: 24 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    ...(conPresupuesto ? [{ width: 18 }, { width: 18 }] : []),
  ];

  for (const f of filas) {
    const fila: (string | number)[] = [f.nombre, f.areas, f.responsable, f.fechaInicio, f.fechaFin, f.estatus];
    if (conPresupuesto) fila.push(f.presupuesto ?? 0, f.gastoTotal ?? 0);
    ws.addRow(fila);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface FilaTareaExcel {
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  responsable: string;
  asignados: string;
  dependeDe: string;
  estatus: string;
  porcentajeAvance: number;
  presupuesto?: number;
}

export async function generarExcelTareas(
  nombreProyecto: string,
  filas: FilaTareaExcel[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Gestión de Proyectos — Fitness Para Todos';
  const ws = wb.addWorksheet('Tareas');

  const conPresupuesto = filas.some((f) => f.presupuesto !== undefined);
  ws.getCell('A1').value = `Proyecto: ${nombreProyecto}`;
  ws.getCell('A1').font = { name: 'Arial', bold: true, size: 12, color: { argb: '2E0A4D' } };
  ws.addRow([]);

  const columnas = [
    'Tarea',
    'Fecha inicio',
    'Fecha fin',
    'Responsable',
    'Asignados',
    'Depende de',
    'Estatus',
    '% Avance',
  ];
  if (conPresupuesto) columnas.push('Presupuesto (MXN)');
  encabezado(ws, columnas);

  ws.columns = [
    { width: 32 },
    { width: 14 },
    { width: 14 },
    { width: 22 },
    { width: 30 },
    { width: 24 },
    { width: 16 },
    { width: 10 },
    ...(conPresupuesto ? [{ width: 18 }] : []),
  ];

  for (const f of filas) {
    const fila: (string | number)[] = [
      f.nombre,
      f.fechaInicio,
      f.fechaFin,
      f.responsable,
      f.asignados,
      f.dependeDe,
      f.estatus,
      f.porcentajeAvance,
    ];
    if (conPresupuesto) fila.push(f.presupuesto ?? 0);
    ws.addRow(fila);
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
