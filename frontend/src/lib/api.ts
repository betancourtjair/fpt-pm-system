import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL: API_URL });

// El token se guarda en localStorage: es código de la aplicación real (no un
// artifact de Claude), así que localStorage es la forma estándar de persistir
// la sesión entre recargas de página.
export function getToken() {
  return localStorage.getItem('fpt_token');
}

// Compartido por todas las descargas de Excel (plantilla de usuarios,
// exportar Proyectos/Tareas — prioridad 9) para no repetir el mismo
// boilerplate de URL de objeto + <a> temporal en cada pantalla.
export function descargarBlob(blob: Blob, nombreArchivo: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

// SESION_MAX_MS respalda, del lado del cliente, el cierre automático de
// sesión cada 3 horas (ver Layout.tsx) — independiente de JWT_EXPIRES_IN
// en el backend, que es la misma ventana pero validada en el servidor.
export const SESION_MAX_MS = 3 * 60 * 60 * 1000;

export function setSession(token: string, usuario: unknown) {
  localStorage.setItem('fpt_token', token);
  localStorage.setItem('fpt_usuario', JSON.stringify(usuario));
  localStorage.setItem('fpt_login_en', String(Date.now()));
}

export function clearSession() {
  localStorage.removeItem('fpt_token');
  localStorage.removeItem('fpt_usuario');
  localStorage.removeItem('fpt_login_en');
}

// Milisegundos que faltan para cumplir las 3 horas desde el login; 0 si ya
// se cumplieron (o si por lo que sea no hay marca de tiempo guardada).
export function msRestantesDeSesion(): number {
  const loginEn = Number(localStorage.getItem('fpt_login_en'));
  if (!loginEn) return 0;
  return Math.max(0, SESION_MAX_MS - (Date.now() - loginEn));
}

export function getUsuario() {
  const raw = localStorage.getItem('fpt_usuario');
  return raw ? JSON.parse(raw) : null;
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      clearSession();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

// ---------------------------------------------------------------------------
// Fase 1 (PID sección 7): Proyectos, Tareas y catálogos de apoyo. Toda la
// lógica de alcance/permiso vive en el backend — aquí solo se envuelven los
// endpoints para que las páginas no repitan rutas/URLs a mano.
// ---------------------------------------------------------------------------

// El color se administra por Dirección (no por Área) — cada Área hereda
// el color de su Dirección, así que sigue trayendo `color` para no tener
// que repetir esa lógica en cada pantalla que pinta chips/filas de Área.
export type AreaConColor = { id: number; nombre: string; direccionId?: number; color: string };

export type Direccion = { id: number; nombre: string; color: string; areas: AreaConColor[] };

export type UsuarioResumen = { id: number; nombre: string; email?: string; rol?: string };

// Equipo de un proyecto (tercera ronda de mejoras) — selector de menciones
// (@usuario) en comentarios; más permisivo que /usuarios (que exige rol
// admin/director/gerente_area), aquí basta con poder VER el proyecto.
export type MiembroEquipo = { id: number; nombre: string };

export type Proyecto = {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
  presupuesto?: number;
  // Solo viaja junto con `presupuesto` (misma regla de visibilidad) — suma
  // de gastos_proyecto, ver ProyectosService.mapaGastosPorProyecto.
  gastoTotal?: number;
  responsable: UsuarioResumen | null;
  creador: UsuarioResumen | null;
  areas: AreaConColor[];
};

export type Gasto = {
  id: number;
  concepto: string;
  monto: number;
  fecha: string;
  creador: UsuarioResumen | null;
};

export type Tarea = {
  id: number;
  proyectoId: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
  porcentajeAvance: number;
  prioridad: 'alta' | 'media' | 'baja';
  presupuesto?: number;
  responsable: UsuarioResumen | null;
  // Dependencias múltiples (cuarta ronda de mejoras, ver README sección 4)
  // — reemplaza el dependenciaId/dependencia singular original: esta tarea
  // espera a que TODAS las de este arreglo terminen antes de poder iniciar.
  dependencias: { id: number; nombre: string }[];
  usuariosAsignados: UsuarioResumen[];
  // Solo viene poblado en /tareas/mis-tareas (mejora sugerida: vista
  // transversal a proyectos) — en el resto de endpoints ya se sabe el
  // proyecto por el contexto de la pantalla.
  proyecto?: { id: number; nombre: string };
  // Etiquetas libres (tercera ronda de mejoras) — texto libre además de
  // prioridad, para que cada Dirección organice por lo que necesite.
  etiquetas: string[];
  // Tareas recurrentes (cuarta ronda de mejoras) — si recurrenciaTipo no es
  // null, al completarse esta tarea se genera sola la siguiente ocurrencia.
  recurrenciaTipo: 'diaria' | 'semanal' | 'mensual' | null;
  recurrenciaIntervalo: number;
  recurrenciaActiva: boolean;
  // Métricas para reportes ejecutivos (cuarta ronda de mejoras).
  creadoEn: string;
  completadaEn: string | null;
};

export type ComentarioTarea = {
  id: number;
  tareaId: number;
  texto: string;
  creadoEn: string;
  usuario: UsuarioResumen | null;
};

export const proyectosApi = {
  listar: () => api.get<Proyecto[]>('/proyectos').then((r) => r.data),
  obtener: (id: number) => api.get<Proyecto>(`/proyectos/${id}`).then((r) => r.data),
  crear: (dto: Record<string, unknown>) => api.post<Proyecto>('/proyectos', dto).then((r) => r.data),
  actualizar: (id: number, dto: Record<string, unknown>) =>
    api.patch<Proyecto>(`/proyectos/${id}`, dto).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/proyectos/${id}`).then((r) => r.data),
  // Plantillas de proyecto (mejora sugerida) — clona el proyecto con todas
  // sus tareas (dependencias y asignaciones incluidas) sobre una nueva
  // fecha de inicio.
  clonar: (id: number, dto: { nombre: string; fechaInicio: string }) =>
    api.post<Proyecto>(`/proyectos/${id}/clonar`, dto).then((r) => r.data),
  // Presupuesto real vs. plan (prioridad 8) — bitácora de gastos reales.
  gastos: (proyectoId: number) => api.get<Gasto[]>(`/proyectos/${proyectoId}/gastos`).then((r) => r.data),
  crearGasto: (proyectoId: number, dto: { concepto: string; monto: number; fecha: string }) =>
    api.post<Gasto[]>(`/proyectos/${proyectoId}/gastos`, dto).then((r) => r.data),
  eliminarGasto: (proyectoId: number, gastoId: number) =>
    api.delete<Gasto[]>(`/proyectos/${proyectoId}/gastos/${gastoId}`).then((r) => r.data),
  // Exportar a Excel (prioridad 9) — mismo alcance/visibilidad que la
  // pantalla, el backend nunca exporta un dato que el usuario no vería ya.
  exportarExcel: () =>
    api.get('/proyectos/exportar-excel', { responseType: 'blob' }).then((r) => r.data as Blob),
  // Equipo del proyecto (tercera ronda) — lista de candidatos para @mencionar
  // en un comentario; accesible a cualquiera con acceso de lectura.
  equipo: (proyectoId: number) =>
    api.get<MiembroEquipo[]>(`/proyectos/${proyectoId}/equipo`).then((r) => r.data),
};

export const tareasApi = {
  listarDeProyecto: (proyectoId: number) =>
    api.get<Tarea[]>(`/proyectos/${proyectoId}/tareas`).then((r) => r.data),
  obtener: (id: number) => api.get<Tarea>(`/tareas/${id}`).then((r) => r.data),
  crear: (proyectoId: number, dto: Record<string, unknown>) =>
    api.post<Tarea>(`/proyectos/${proyectoId}/tareas`, dto).then((r) => r.data),
  actualizar: (id: number, dto: Record<string, unknown>) =>
    api.patch<Tarea>(`/tareas/${id}`, dto).then((r) => r.data),
  actualizarAvance: (id: number, dto: { estatus?: string; porcentajeAvance?: number }) =>
    api.patch<Tarea>(`/tareas/${id}/avance`, dto).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/tareas/${id}`).then((r) => r.data),
  exportarExcel: (proyectoId: number) =>
    api
      .get(`/proyectos/${proyectoId}/tareas/exportar-excel`, { responseType: 'blob' })
      .then((r) => r.data as Blob),
  // Reasignación masiva de responsable (prioridad 11) — para el caso "esta
  // tanda de tareas ahora las lleva Fulano" sin editarlas una por una.
  reasignarMasivo: (proyectoId: number, tareaIds: number[], responsableId: number) =>
    api
      .patch<Tarea[]>(`/proyectos/${proyectoId}/tareas/reasignar-masivo`, { tareaIds, responsableId })
      .then((r) => r.data),
  // "Mis tareas" (mejora sugerida) — todo lo asignado al usuario actual a
  // través de todos sus proyectos, sin tener que entrar uno por uno.
  misTareas: () => api.get<Tarea[]>('/tareas/mis-tareas').then((r) => r.data),
};

// Comentarios por tarea (mejora sugerida) — para discutir una tarea sin
// salirse a correo/WhatsApp.
export const comentariosApi = {
  deTarea: (tareaId: number) => api.get<ComentarioTarea[]>(`/tareas/${tareaId}/comentarios`).then((r) => r.data),
  crear: (tareaId: number, texto: string) =>
    api.post<ComentarioTarea[]>(`/tareas/${tareaId}/comentarios`, { texto }).then((r) => r.data),
  eliminar: (comentarioId: number) => api.delete(`/comentarios/${comentarioId}`).then((r) => r.data),
};

// Adjuntar archivos a proyectos/tareas (prioridad 11). El archivo en sí
// vive en Supabase Storage — el frontend nunca habla directo con Supabase,
// siempre pasa por estos endpoints propios (subir/descargar/borrar).
export type Archivo = {
  id: number;
  nombreArchivo: string;
  tipoMime: string | null;
  tamanoBytes: number;
  subidoEn: string;
  subidoPor: UsuarioResumen | null;
};

function subirArchivo(url: string, archivo: File) {
  const form = new FormData();
  form.append('file', archivo);
  return api.post<Archivo[]>(url, form).then((r) => r.data);
}

export const archivosApi = {
  deProyecto: (proyectoId: number) =>
    api.get<Archivo[]>(`/proyectos/${proyectoId}/archivos`).then((r) => r.data),
  subirAProyecto: (proyectoId: number, archivo: File) =>
    subirArchivo(`/proyectos/${proyectoId}/archivos`, archivo),
  deTarea: (tareaId: number) => api.get<Archivo[]>(`/tareas/${tareaId}/archivos`).then((r) => r.data),
  subirATarea: (tareaId: number, archivo: File) => subirArchivo(`/tareas/${tareaId}/archivos`, archivo),
  descargar: (archivoId: number, nombreArchivo: string) =>
    api.get(`/archivos/${archivoId}/descargar`, { responseType: 'blob' }).then((r) => {
      descargarBlob(r.data as Blob, nombreArchivo);
    }),
  eliminar: (archivoId: number) => api.delete(`/archivos/${archivoId}`).then((r) => r.data),
};

export type UsuarioDirectorio = {
  id: number;
  nombre: string;
  email: string;
  activo: boolean;
  mustChangePassword: boolean;
  verPresupuestoAutorizado: boolean;
  rolId: number;
  rol: string | null;
  areaId: number | null;
  area: string | null;
  direccionId: number | null;
  direccion: string | null;
};

export type ResultadoFilaImportacion = {
  fila: number;
  nombre: string;
  email: string;
  ok: boolean;
  mensaje?: string;
  rol?: string;
  passwordTemporal?: string;
};

export type ResultadoImportacionExcel = {
  total: number;
  creados: number;
  conError: number;
  resultados: ResultadoFilaImportacion[];
};

// Carga de trabajo por persona (tercera ronda de mejoras, ver README
// sección 4) — mismo alcance de roles que /usuarios, con conteos encima.
export type CargaTrabajoUsuario = {
  id: number;
  nombre: string;
  rol: string | null;
  area: string | null;
  direccion: string | null;
  tareasActivas: number;
  tareasVencidas: number;
};

export const usuariosApi = {
  listar: () => api.get<UsuarioDirectorio[]>('/usuarios').then((r) => r.data),
  cargaTrabajo: () => api.get<CargaTrabajoUsuario[]>('/usuarios/carga-trabajo').then((r) => r.data),
  crear: (dto: Record<string, unknown>) =>
    api.post<UsuarioDirectorio>('/usuarios', dto).then((r) => r.data),
  actualizar: (id: number, dto: Record<string, unknown>) =>
    api.patch<UsuarioDirectorio>(`/usuarios/${id}`, dto).then((r) => r.data),
  autorizarPresupuesto: (id: number, autorizar: boolean) =>
    api.patch(`/usuarios/${id}/autorizar-presupuesto`, { autorizar }).then((r) => r.data),
  // Carga masiva (admin) — PID sección 9.2, alta de usuarios por lote.
  descargarPlantilla: () =>
    api.get('/usuarios/plantilla-excel', { responseType: 'blob' }).then((r) => r.data as Blob),
  importarExcel: (archivo: File) => {
    const form = new FormData();
    form.append('file', archivo);
    return api
      .post<ResultadoImportacionExcel>('/usuarios/importar-excel', form)
      .then((r) => r.data);
  },
};

export type Rol = { id: number; nombre: string; permisos: Record<string, unknown> };

export const catalogoApi = {
  direcciones: () => api.get<Direccion[]>('/direcciones').then((r) => r.data),
  roles: () => api.get<Rol[]>('/roles').then((r) => r.data),
  // Color por Dirección (el admin lo personaliza desde "Admin"; cada Área
  // hereda el color de su Dirección — ver Dashboard/Proyectos).
  actualizarColorDireccion: (direccionId: number, color: string) =>
    api.patch<Direccion>(`/direcciones/${direccionId}/color`, { color }).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Fase 2 completa (PID sección 7): notificaciones dentro de la app.
// Reutilizan la misma tabla que las alertas por correo — cada quien ve
// únicamente las suyas (sin importar el rol).
// ---------------------------------------------------------------------------

// A partir de la tercera ronda de mejoras el id ya no es numérico: viene
// prefijado "a-<id>" (de alertas_enviadas) o "p-<id>" (de
// notificaciones_personalizadas, tabla sin restricción de unicidad porque
// una mención o una automatización sí puede repetirse sobre la misma tarea).
export type Notificacion = {
  id: string;
  tipo: 'asignacion' | '48h' | '24h' | 'vencida' | 'bloqueada' | 'mencion' | 'automatizacion';
  tarea: { id: number; nombre: string } | null;
  mensaje?: string | null;
  fechaProgramada: string;
  leido: boolean;
};

export const notificacionesApi = {
  listar: () =>
    api.get<{ notificaciones: Notificacion[]; noLeidas: number }>('/notificaciones').then((r) => r.data),
  marcarLeida: (id: string) => api.patch(`/notificaciones/${id}/leido`).then((r) => r.data),
  marcarTodasLeidas: () => api.patch('/notificaciones/leer-todas').then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Tercera ronda de mejoras (ver README sección 4): automatizaciones,
// subtareas, bitácora de actividad, búsqueda global y vistas guardadas.
// ---------------------------------------------------------------------------

// Automatizaciones configurables por el usuario — reglas "si la tarea entra
// en tal condición, avisa a tal persona", por proyecto.
export type TipoAccionRegla = 'notificar_responsable' | 'notificar_director' | 'notificar_usuario';

export type ReglaAutomatizacion = {
  id: number;
  proyectoId: number;
  nombre: string;
  condicionPrioridad: 'alta' | 'media' | 'baja' | null;
  condicionEstatus: string | null;
  condicionVencida: boolean;
  accionTipo: TipoAccionRegla;
  accionUsuario: UsuarioResumen | null;
  activa: boolean;
  creadoEn: string;
};

export const automatizacionesApi = {
  deProyecto: (proyectoId: number) =>
    api.get<ReglaAutomatizacion[]>(`/proyectos/${proyectoId}/automatizaciones`).then((r) => r.data),
  crear: (proyectoId: number, dto: Record<string, unknown>) =>
    api.post<ReglaAutomatizacion[]>(`/proyectos/${proyectoId}/automatizaciones`, dto).then((r) => r.data),
  actualizar: (id: number, dto: Record<string, unknown>) =>
    api.patch<ReglaAutomatizacion[]>(`/automatizaciones/${id}`, dto).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/automatizaciones/${id}`).then((r) => r.data),
};

// Subtareas / checklist dentro de una tarea.
export type SubtareaChecklist = {
  id: number;
  tareaId: number;
  texto: string;
  completada: boolean;
  orden: number;
  creadoEn: string;
};

export const subtareasApi = {
  deTarea: (tareaId: number) => api.get<SubtareaChecklist[]>(`/tareas/${tareaId}/subtareas`).then((r) => r.data),
  crear: (tareaId: number, texto: string) =>
    api.post<SubtareaChecklist[]>(`/tareas/${tareaId}/subtareas`, { texto }).then((r) => r.data),
  actualizar: (id: number, dto: { texto?: string; completada?: boolean }) =>
    api.patch<SubtareaChecklist[]>(`/subtareas/${id}`, dto).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/subtareas/${id}`).then((r) => r.data),
};

// Plantillas de checklist reutilizables (cuarta ronda de mejoras, ver
// README sección 4) — compartidas en toda la organización, se aplican con
// un clic sobre cualquier tarea que se pueda administrar.
export type PlantillaChecklist = {
  id: number;
  nombre: string;
  creador: UsuarioResumen | null;
  creadoEn: string;
  items: { id: number; texto: string }[];
};

export const plantillasChecklistApi = {
  listar: () => api.get<PlantillaChecklist[]>('/plantillas-checklist').then((r) => r.data),
  crear: (dto: { nombre: string; items: string[] }) =>
    api.post<PlantillaChecklist[]>('/plantillas-checklist', dto).then((r) => r.data),
  eliminar: (id: number) => api.delete<PlantillaChecklist[]>(`/plantillas-checklist/${id}`).then((r) => r.data),
  aplicarATarea: (plantillaId: number, tareaId: number) =>
    api.post<SubtareaChecklist[]>(`/plantillas-checklist/${plantillaId}/aplicar-a-tarea/${tareaId}`).then((r) => r.data),
};

// Bitácora de actividad por tarea — combina comentarios + eventos del
// sistema (creación, cambio de estatus/responsable/prioridad) en un solo feed.
export type ItemActividad = {
  id: string;
  tipo: 'comentario' | 'creacion' | 'cambio_estatus' | 'cambio_responsable' | 'cambio_prioridad';
  detalle: string;
  usuario: UsuarioResumen | null;
  creadoEn: string;
  comentarioId?: number;
};

export const actividadApi = {
  deTarea: (tareaId: number) => api.get<ItemActividad[]>(`/tareas/${tareaId}/actividad`).then((r) => r.data),
};

// Búsqueda global — proyectos, tareas y comentarios, ya filtrados por lo que
// el usuario actual puede ver (mismo alcance por rol que el resto de la app).
export type ResultadoBusqueda = {
  proyectos: { id: number; nombre: string }[];
  tareas: { id: number; nombre: string; proyectoId: number; proyectoNombre: string }[];
  comentarios: { id: number; texto: string; tareaId: number; tareaNombre: string; proyectoId: number }[];
};

export const busquedaApi = {
  buscar: (q: string) => api.get<ResultadoBusqueda>('/buscar', { params: { q } }).then((r) => r.data),
};

// Vistas / filtros guardados por usuario — puramente personal, sin alcance
// por proyecto (cada quien guarda lo suyo sobre una pantalla concreta).
export type PantallaVistaGuardada = 'proyectos' | 'mis-tareas' | 'kanban' | 'calendario';

export type VistaGuardada = {
  id: number;
  pantalla: PantallaVistaGuardada;
  nombre: string;
  filtros: Record<string, unknown>;
  creadoEn: string;
};

export const vistasGuardadasApi = {
  listar: (pantalla?: PantallaVistaGuardada) =>
    api.get<VistaGuardada[]>('/vistas-guardadas', { params: pantalla ? { pantalla } : {} }).then((r) => r.data),
  crear: (dto: { pantalla: PantallaVistaGuardada; nombre: string; filtros: Record<string, unknown> }) =>
    api.post<VistaGuardada>('/vistas-guardadas', dto).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/vistas-guardadas/${id}`).then((r) => r.data),
};

// ---------------------------------------------------------------------------
// Reportes / dashboard ejecutivo con tendencias (cuarta ronda de mejoras):
// a diferencia de Dashboard (foto del momento), aquí se compara mes contra
// mes usando tareas.creadoEn/completadaEn. Mismo alcance por rol de siempre
// (admin/director/gerente_area) — el backend nunca regresa algo fuera de
// /reportes/resumen y /reportes/tendencia.
// ---------------------------------------------------------------------------

export type ResumenDireccion = {
  direccionId: number;
  direccionNombre: string;
  totalProyectos: number;
  totalTareas: number;
  tareasCompletadas: number;
  tareasVencidas: number;
  porcentajeCumplimiento: number;
  // null si todavía ninguna tarea de la Dirección tiene completadaEn.
  tiempoPromedioFinalizacionDias: number | null;
};

export type TendenciaMes = {
  mes: string; // 'YYYY-MM'
  tareasCreadas: number;
  tareasCompletadas: number;
  automatizacionesActivadas: number;
};

export const reportesApi = {
  resumen: () => api.get<ResumenDireccion[]>('/reportes/resumen').then((r) => r.data),
  tendencia: (meses?: number) =>
    api.get<TendenciaMes[]>('/reportes/tendencia', { params: meses ? { meses } : {} }).then((r) => r.data),
};
