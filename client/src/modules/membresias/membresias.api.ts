import { api } from "../../api/axios";
import type { Membresia, CreateMembresiaPayload } from "./membresias.types";

export const membresiasApi = {
  create: (payload: CreateMembresiaPayload) =>
    api.post<Membresia>("/membresias", payload).then((res) => res.data),
  getAll: () => api.get<Membresia[]>("/membresias").then((res) => res.data),
  // No existe GET /membresias/vigente/:usuarioId en el backend.
  // Workaround temporal: filtra en cliente la más reciente del usuario.
  getVigente: async (usuarioId: string) => {
    const todas = await api.get<Membresia[]>("/membresias").then((res) => res.data);
    const delUsuario = (todas as unknown as Array<Membresia & { usuario: { id: string } }>).filter(
      (m) => (m as unknown as { usuario?: { id: string } }).usuario?.id === usuarioId,
    );
    if (delUsuario.length) return delUsuario.sort((a, b) => b.fechaFin.localeCompare(a.fechaFin))[0];
    return null;
  },
};
