import { api } from '../../api/axios';

export interface Instructor {
  id: string;
  nombre: string;
  especialidad?: string | null;
  activo: boolean;
}

export const instructoresApi = {
  getAll: () => api.get<Instructor[]>('/instructores').then((response) => response.data),
  getOne: (id: string) => api.get<Instructor>(`/instructores/${id}`).then((r) => r.data),
  create: (payload: { nombre: string; especialidad?: string; telefono?: string }) =>
    api.post<Instructor>('/instructores', payload).then((response) => response.data),
  update: (id: string, payload: Partial<Instructor>) => api.patch<Instructor>(`/instructores/${id}`, payload).then((r) => r.data),
  remove: (id: string) => api.delete(`/instructores/${id}`).then((r) => r.data),
};
