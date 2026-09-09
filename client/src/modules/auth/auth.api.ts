import { api } from '../../api/axios';
import type { LoginPayload, UsuarioAutenticado } from './auth.types';

export const authApi = {
  // Inicia sesión con email y contraseña; si sale bien, el backend deja la
  // sesión guardada en una cookie y devuelve los datos del usuario.
  login: (payload: LoginPayload) =>
    api.post<UsuarioAutenticado>('/auth/login', payload).then((res) => res.data),

  // Cierra la sesión actual borrando la cookie del backend.
  logout: () => api.post('/auth/logout'),

  // Pregunta quién está logueado ahora mismo; se usa al cargar la app para
  // saber si hay sesión activa o hay que pedir login.
  me: () => api.get<UsuarioAutenticado>('/auth/me').then((res) => res.data),
};