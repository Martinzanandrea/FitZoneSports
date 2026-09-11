import { api } from "../../api/axios";
import type { Pago, PagoPasarelaPayload } from "./pagos.types";
import type { PaginatedResponse } from "../../shared/types/pagination";

export interface OpcionesCobroEfectivo {
  usuarios: Array<{
    id: string;
    nombre: string;
    apellido: string;
    dni: string | null;
    sede?: { id: string; nombre: string } | null;
  }>;
  membresias: Array<{
    id: string;
    plan: string;
    estado: string;
    fechaInicio: string;
    fechaFin: string;
    usuario: { id: string; nombre: string; apellido: string; dni?: string | null };
    sedeAlta: { id: string; nombre: string };
  }>;
  reservasClase: Array<{
    id: string;
    estado: string;
    usuario: { id: string; nombre: string; apellido: string; dni?: string | null };
    clase: { tipoClase: string; horarioInicio: string; sede: { id: string; nombre: string } };
  }>;
  reservasCancha: Array<{
    id: string;
    estado: string;
    fecha: string;
    horaInicio: string;
    horaFin: string;
    precioFinal: string;
    usuario: { id: string; nombre: string; apellido: string; dni?: string | null };
    cancha: { nombre: string; sede: { id: string; nombre: string } };
  }>;
}

export interface RegistrarEfectivoPayload {
  usuarioId: string;
  membresiaId?: string;
  reservaClaseId?: string;
  reservaCanchaId?: string;
  monto?: number;
}

export const pagosApi = {
  // Trae todo lo que un recepcionista puede cobrar en efectivo (usuarios,
  // membresías y reservas pendientes), ya filtrado por su sede.
  getOpcionesEfectivo: () =>
    api.get<OpcionesCobroEfectivo>("/pagos/efectivo/opciones").then((res) => res.data),
  // Cobra con la pasarela simulada; el monto real lo calcula el backend,
  // lo que se manda es a qué corresponde el pago y con qué método.
  pagarConPasarela: (payload: PagoPasarelaPayload) =>
    api.post<Pago>("/pagos/pasarela", payload).then((res) => res.data),
  // Trae el historial de pagos de una persona; el usuarioId dice de quién
  // (cada uno solo puede ver el propio, salvo el staff).
  // Viene paginado: page arranca en 1 y limit trae 20 por defecto.
  getPorUsuario: (usuarioId: string, page = 1, limit = 20) =>
    api.get<PaginatedResponse<Pago>>(`/pagos/usuario/${usuarioId}`, { params: { page, limit } }).then((res) => res.data),
  // Registra un cobro en efectivo hecho en el mostrador — solo para
  // recepcionistas y gerentes; se pasa una sola de las tres referencias
  // (membresía, reserva de clase o de cancha).
  registrarEfectivo: (payload: RegistrarEfectivoPayload) =>
    api.post<Pago>("/pagos/efectivo", payload).then((res) => res.data),
};
