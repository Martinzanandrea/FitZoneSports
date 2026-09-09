import { api } from "../../api/axios";
import type { Sede, CreateSedePayload, FranjaHoraria } from "./sedes.types";

export const sedesApi = {
  // Trae solo los datos públicos de las sedes, sin necesitar estar
  // logueado — se usa en la landing para mostrar dónde están ubicadas.
  getAllPublico:()=> api.get<Sede[]>("/sedes/publico").then((res) => res.data),
  // Le pide al backend la lista completa de sedes que puede administrar
  // el usuario logueado (el propio backend ya filtra según su rol).
  getAll: () => api.get<Sede[]>("/sedes").then((res) => res.data),
  // Trae los datos de una sola sede; el id es la sede que se quiere ver en detalle.
  getOne: (id: string) => api.get<Sede>(`/sedes/${id}`).then((res) => res.data),
  // Crea una sede nueva en la cadena — solo para gerentes.
  create: (payload: CreateSedePayload) =>
    api.post<Sede>("/sedes", payload).then((res) => res.data),
  // Guarda cambios en una sede (el id dice cuál); sirve tanto para editar
  // sus datos como para activarla o desactivarla.
  update: (
    id: string,
    payload: Partial<CreateSedePayload> & { activa?: boolean },
  ) => api.patch<Sede>(`/sedes/${id}`, payload).then((res) => res.data),
  // Trae las franjas de apertura de una sede (ej. mañana y tarde con hueco).
  getFranjas: (sedeId: string) =>
    api.get<FranjaHoraria[]>(`/sedes/${sedeId}/franjas`).then((res) => res.data),
  // Agrega una ventana de apertura a la sede (el sedeId dice a cuál);
  // las horas van en formato "HH:MM" y solo lo puede hacer un gerente.
  crearFranja: (sedeId: string, payload: { apertura: string; cierre: string }) =>
    api.post<FranjaHoraria>(`/sedes/${sedeId}/franjas`, payload).then((res) => res.data),
  // Borra una ventana de apertura (el franjaId dice cuál) de una sede;
  // solo lo puede hacer un gerente.
  eliminarFranja: (sedeId: string, franjaId: string) =>
    api.delete(`/sedes/${sedeId}/franjas/${franjaId}`).then((res) => res.data),
};
