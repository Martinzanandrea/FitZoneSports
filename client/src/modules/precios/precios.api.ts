import { api } from "../../api/axios";
import type { PrecioPlan } from "./precios.types";

export const preciosApi = {
  getMembresiasPublico: () =>
    api
      .get<PrecioPlan[]>("/precios/membresias/publico")
      .then((res) => res.data),
  actualizar: (plan: string, precio: number) =>
    api
      .patch<PrecioPlan>(`/precios/membresias/${plan}`, { precio })
      .then((res) => res.data),
};
