import { api } from "../../api/axios";
import type { Usuario, CrearStaffPayload } from "./usuarios.types";

export const usuariosApi = {
  getAll: () => api.get<Usuario[]>("/usuarios").then((res) => res.data),
  getStaff: () => api.get<Usuario[]>("/usuarios/staff").then((res) => res.data),
  crearStaff: (payload: CrearStaffPayload) =>
    api.post<Usuario>("/usuarios/staff", payload).then((res) => res.data),
  asignarSede: (id: string, sedeId: string) =>
    api
      .patch<Usuario>(`/usuarios/${id}/sede`, { sedeId })
      .then((res) => res.data),
  actualizar: (id: string, payload: Partial<Pick<Usuario, 'dni' | 'nombre' | 'apellido' | 'email' | 'telefono'>>) =>
    api.patch<Usuario>(`/usuarios/${id}`, payload).then((res) => res.data),
  registrarPublico: (data: FormData) =>
    api.post<Usuario>("/usuarios", data).then((res) => res.data),
};
