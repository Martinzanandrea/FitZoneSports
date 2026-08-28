import { api } from "../../api/axios";
import type { Membresia, CreateMembresiaPayload } from "./membresias.types";

export const membresiasApi = {
  create: (payload: CreateMembresiaPayload) =>
    api.post<Membresia>("/membresias", payload).then((res) => res.data),
  getAll: () => api.get<Membresia[]>("/membresias").then((res) => res.data),
  getVigente: (usuarioId: string) =>
    api
      .get<Membresia | null>(`/membresias/vigente/${usuarioId}`)
      .then((res) => res.data),
};
