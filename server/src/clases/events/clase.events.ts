export const CLASE_CUPO_LIBERADO = 'clase.cupo-liberado';

export interface CupoLiberadoPayload {
  ocurrenciaId: string;
}

// Se emite DESPUÉS de confirmada la transacción de la baja de una clase. No
// pasa por CLASE_CUPO_LIBERADO: la baja cancela reservas en bloque y nadie de
// la lista de espera debe ser promovido a una clase que ya no existe.
export const CLASE_DADA_DE_BAJA = 'clase.dada-de-baja';

export interface OcurrenciaAfectada {
  fecha: string; // YYYY-MM-DD
  horaInicio: string;
  horaFin: string;
}

export interface ClaseDadaDeBajaPayload {
  claseId: string;
  tipoClase: string;
  // Una entrada por persona con reserva (RESERVADA o LISTA_ESPERA) cancelada.
  afectados: Array<{ usuarioId: string; ocurrencias: OcurrenciaAfectada[] }>;
}
