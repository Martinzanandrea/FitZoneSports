import { api } from "../../api/axios";
import type { Sede, CreateSedePayload } from "./sedes.types";

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
};
