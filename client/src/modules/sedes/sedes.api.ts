import { api } from "../../api/axios";
import type { Sede, CreateSedePayload } from "./sedes.types";

export const sedesApi = {
  getAll: () => api.get<Sede[]>("/sedes").then((res) => res.data),
  getOne: (id: string) => api.get<Sede>(`/sedes/${id}`).then((res) => res.data),
  create: (payload: CreateSedePayload) =>
    api.post<Sede>("/sedes", payload).then((res) => res.data),
  update: (
    id: string,
    payload: Partial<CreateSedePayload> & { activa?: boolean },
  ) => api.patch<Sede>(`/sedes/${id}`, payload).then((res) => res.data),
};
