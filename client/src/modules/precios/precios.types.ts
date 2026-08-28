export interface PrecioPlan {
  id: string;
  plan: "MENSUAL" | "TRIMESTRAL" | "ANUAL";
  precio: string;
  actualizadoEn: string;
}
