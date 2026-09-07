import { api } from "../../api/axios";
import type { Pago, PagoPasarelaPayload } from "./pagos.types";

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
  getOpcionesEfectivo: () =>
    api.get<OpcionesCobroEfectivo>("/pagos/efectivo/opciones").then((res) => res.data),
  pagarConPasarela: (payload: PagoPasarelaPayload) =>
    api.post<Pago>("/pagos/pasarela", payload).then((res) => res.data),
  getPorUsuario: (usuarioId: string) =>
    api.get<Pago[]>(`/pagos/usuario/${usuarioId}`).then((res) => res.data),
  registrarEfectivo: (payload: RegistrarEfectivoPayload) =>
    api.post<Pago>("/pagos/efectivo", payload).then((res) => res.data),
};
