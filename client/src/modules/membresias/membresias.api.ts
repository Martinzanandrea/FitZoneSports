import { api } from "../../api/axios";
import type { Membresia, CreateMembresiaPayload } from "./membresias.types";

export const membresiasApi = {
  create: (payload: CreateMembresiaPayload) =>
    api.post<Membresia>("/membresias", payload).then((res) => res.data),
};
