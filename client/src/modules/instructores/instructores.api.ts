import { api } from '../../api/axios';

export interface Instructor {
  id: string;
  nombre: string;
  especialidad?: string | null;
  activo: boolean;
}

export const instructoresApi = {
  // Trae la lista de instructores para mostrarlos o elegir uno al crear una clase.
  getAll: () => api.get<Instructor[]>('/instructores').then((response) => response.data),
  // Trae los datos de un solo instructor; el id dice cuál ver en detalle.
  getOne: (id: string) => api.get<Instructor>(`/instructores/${id}`).then((r) => r.data),
  // Da de alta a un instructor nuevo; la especialidad y el teléfono son opcionales.
  create: (payload: { nombre: string; especialidad?: string; telefono?: string }) =>
    api.post<Instructor>('/instructores', payload).then((response) => response.data),
  // Guarda cambios en un instructor (el id dice cuál); solo se manda lo que cambió.
  update: (id: string, payload: Partial<Instructor>) => api.patch<Instructor>(`/instructores/${id}`, payload).then((r) => r.data),
  // Da de baja a un instructor (el id dice cuál); es una baja lógica, no se borra de verdad.
  remove: (id: string) => api.delete(`/instructores/${id}`).then((r) => r.data),
};
