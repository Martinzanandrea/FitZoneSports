import { api } from '../../api/axios';

export interface Instructor {
  id: string;
  nombre: string;
  especialidad?: string | null;
  activo: boolean;
}

export const instructoresApi = {
  getAll: () => api.get<Instructor[]>('/instructores').then((response) => response.data),
};
