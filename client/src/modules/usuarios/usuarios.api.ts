import { api } from "../../api/axios";
import type { Usuario, CrearStaffPayload } from "./usuarios.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

export const usuariosApi = {
  // Le pide al backend la lista de todos los usuarios (solo la ven
  // recepcionistas y gerentes, se usa para buscar a alguien por nombre).
  // Viene paginada: page arranca en 1 y limit trae 20 por defecto.
  getAll: (page = 1, limit = 20) =>
    api.get<PaginatedResponse<Usuario>>("/usuarios", { params: { page, limit } }).then((res) => res.data),
  // Trae el perfil completo de un usuario (solo propio o staff, según ownership).
  getOne: (id: string) =>
    api.get<Usuario>(`/usuarios/${id}`).then((res) => res.data),
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
  // OJO: dni no va por acá (el backend lo rechaza con 400) — usar actualizarDni.
  actualizar: (id: string, payload: Partial<Pick<Usuario, 'nombre' | 'apellido' | 'email' | 'telefono'>>) =>
    api.patch<Usuario>(`/usuarios/${id}`, payload).then((res) => res.data),
  // Actualiza solo el DNI (endpoint dedicado, solo gerentes).
  actualizarDni: (id: string, dni: string) =>
    api.patch<Usuario>(`/usuarios/${id}/dni`, { dni }).then((res) => res.data),
  // Registra a un socio o cliente nuevo desde el formulario público, sin
  // estar logueado; se manda FormData porque puede incluir la foto de perfil.
  // Ojo: la cuenta queda sin verificar, hay que confirmar el email después.
  registrarPublico: (data: FormData) =>
    api.post<Usuario>("/usuarios", data).then((res) => res.data),
  // Confirma el email con el token que llegó en el link (válido 24h).
  verificarEmail: (token: string) =>
    api.get<{ verificado: boolean }>("/usuarios/verificar-email", { params: { token } }).then((res) => res.data),
  // Pide un link nuevo de verificación (respuesta genérica a propósito,
  // para no revelar qué emails están registrados).
  reenviarVerificacion: (email: string) =>
    api.post<{ message: string }>("/usuarios/reenviar-verificacion", { email }).then((res) => res.data),
  // Cambia la contraseña propia: el backend exige { passwordActual, password }
  // según ChangePasswordDto (PATCH /usuarios/:id/password).
  cambiarPassword: (id: string, payload: { passwordActual: string; password: string }) =>
    api.patch(`/usuarios/${id}/password`, payload).then((res) => res.data),
  // Cambia la foto de perfil con upload real (PATCH /usuarios/:id/foto);
  // se manda FormData porque incluye el archivo.
  actualizarFoto: (id: string, archivo: File) => {
    const data = new FormData();
    data.append("foto", archivo);
    return api.patch<Usuario>(`/usuarios/${id}/foto`, data).then((res) => res.data);
  },
};
