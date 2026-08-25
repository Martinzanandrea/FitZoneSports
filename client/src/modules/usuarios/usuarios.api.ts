import { api } from '../../api/axios';
import type { Usuario, CrearStaffPayload } from './usuarios.types';

export const usuariosApi = {
  getAll: () => api.get<Usuario[]>('/usuarios').then((res) => res.data),
  crearStaff: (payload: CrearStaffPayload) =>
    api.post<Usuario>('/usuarios/staff', payload).then((res) => res.data),
};