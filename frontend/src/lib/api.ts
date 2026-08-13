import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL: API_URL });

// El token se guarda en localStorage: es código de la aplicación real (no un
// artifact de Claude), así que localStorage es la forma estándar de persistir
// la sesión entre recargas de página.
export function getToken() {
  return localStorage.getItem('fpt_token');
}

export function setSession(token: string, usuario: unknown) {
  localStorage.setItem('fpt_token', token);
  localStorage.setItem('fpt_usuario', JSON.stringify(usuario));
}

export function clearSession() {
  localStorage.removeItem('fpt_token');
  localStorage.removeItem('fpt_usuario');
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

export type Direccion = { id: number; nombre: string; areas: { id: number; nombre: string }[] };

export type UsuarioResumen = { id: number; nombre: string; email?: string; rol?: string };

export type Proyecto = {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
  presupuesto?: number;
  responsable: UsuarioResumen | null;
  creador: UsuarioResumen | null;
  areas: { id: number; nombre: string; direccionId: number }[];
};

export type Tarea = {
  id: number;
  proyectoId: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estatus: string;
  porcentajeAvance: number;
  presupuesto?: number;
  responsable: UsuarioResumen | null;
  dependenciaId: number | null;
  dependencia: UsuarioResumen | null;
  usuariosAsignados: UsuarioResumen[];
};

export const proyectosApi = {
  listar: () => api.get<Proyecto[]>('/proyectos').then((r) => r.data),
  obtener: (id: number) => api.get<Proyecto>(`/proyectos/${id}`).then((r) => r.data),
  crear: (dto: Record<string, unknown>) => api.post<Proyecto>('/proyectos', dto).then((r) => r.data),
  actualizar: (id: number, dto: Record<string, unknown>) =>
    api.patch<Proyecto>(`/proyectos/${id}`, dto).then((r) => r.data),
  eliminar: (id: number) => api.delete(`/proyectos/${id}`).then((r) => r.data),
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

export const usuariosApi = {
  listar: () => api.get<UsuarioDirectorio[]>('/usuarios').then((r) => r.data),
  crear: (dto: Record<string, unknown>) =>
    api.post<UsuarioDirectorio>('/usuarios', dto).then((r) => r.data),
  actualizar: (id: number, dto: Record<string, unknown>) =>
    api.patch<UsuarioDirectorio>(`/usuarios/${id}`, dto).then((r) => r.data),
  autorizarPresupuesto: (id: number, autorizar: boolean) =>
    api.patch(`/usuarios/${id}/autorizar-presupuesto`, { autorizar }).then((r) => r.data),
};

export type Rol = { id: number; nombre: string; permisos: Record<string, unknown> };

export const catalogoApi = {
  direcciones: () => api.get<Direccion[]>('/direcciones').then((r) => r.data),
  roles: () => api.get<Rol[]>('/roles').then((r) => r.data),
};
