import { api } from "../../api/axios";
import type { PrecioPlan } from "./precios.types";

export const preciosApi = {
  // Trae los precios de los planes para mostrarlos antes de registrarse,
  // sin necesitar estar logueado.
  getMembresiasPublico: () =>
    api
      .get<PrecioPlan[]>("/precios/membresias/publico")
      .then((res) => res.data),
  // Le cambia el precio a un plan (el plan dice cuál: MENSUAL, TRIMESTRAL
  // o ANUAL); solo lo puede hacer un gerente y rige para los pagos nuevos.
  actualizar: (plan: string, precio: number) =>
    api
      .patch<PrecioPlan>(`/precios/membresias/${plan}`, { precio })
      .then((res) => res.data),
};
