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
