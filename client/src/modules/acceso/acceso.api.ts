import { api } from '../../api/axios';
import type { Aforo } from './acceso.types';

export const accesoApi = {
  getAforo: (sedeId: string) => api.get<Aforo>(`/acceso/aforo/${sedeId}`).then((res) => res.data),
};