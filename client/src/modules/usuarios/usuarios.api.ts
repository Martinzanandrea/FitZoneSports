import { api } from "../../api/axios";
import type { Usuario, CrearStaffPayload } from "./usuarios.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

export const usuariosApi = {
  // Le pide al backend la lista de todos los usuarios (solo la ven
  // recepcionistas y gerentes, se usa para buscar a alguien por nombre).
  // Viene paginada: page arranca en 1 y limit trae 20 por defecto.
  getAll: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Usuario>>("/usuarios", { params: { page, limit } }).then((res) => res.data),
  // Trae solo al personal (recepcionistas y gerentes), que es lo que
  // muestra la pantalla de Personal. También viene paginado.
  getStaff: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Usuario>>("/usuarios/staff", { params: { page, limit } }).then((res) => res.data),
  // Da de alta a un recepcionista o gerente nuevo — solo lo puede hacer un gerente.
  crearStaff: (payload: CrearStaffPayload) =>
    api.post<Usuario>("/usuarios/staff", payload).then((res) => res.data),
  // Le cambia la sede a un miembro del personal: el id dice a quién
  // y sedeId a qué sede nueva pasa.
  asignarSede: (id: string, sedeId: string) =>
    api
      .patch<Usuario>(`/usuarios/${id}/sede`, { sedeId })
      .then((res) => res.data),
  // Guarda cambios en los datos de un usuario (el id dice cuál);
  // solo se manda lo que cambió, por eso el resto de los campos es opcional.
  actualizar: (id: string, payload: Partial<Pick<Usuario, 'dni' | 'nombre' | 'apellido' | 'email' | 'telefono'>>) =>
    api.patch<Usuario>(`/usuarios/${id}`, payload).then((res) => res.data),
  // Registra a un socio o cliente nuevo desde el formulario público, sin
  // estar logueado; se manda FormData porque puede incluir la foto de perfil.
  registrarPublico: (data: FormData) =>
    api.post<Usuario>("/usuarios", data).then((res) => res.data),
};
