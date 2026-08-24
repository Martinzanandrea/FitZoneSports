import { api } from '../../api/axios';
import type { LoginPayload, UsuarioAutenticado } from './auth.types';

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<UsuarioAutenticado>('/auth/login', payload).then((res) => res.data),

  logout: () => api.post('/auth/logout'),

  me: () => api.get<UsuarioAutenticado>('/auth/me').then((res) => res.data),
};