import { ConflictException } from '@nestjs/common';

interface ErrorDeBase {
  code?: string;
  constraint?: string;
  detail?: string;
  driverError?: { code?: string; constraint?: string; detail?: string };
}

// Violación de UNIQUE de Postgres (23505). TypeORM la envuelve en
// QueryFailedError con los datos del driver en `driverError`.
export function esViolacionUnique(err: unknown): boolean {
  const e = err as ErrorDeBase | null;
  return (e?.driverError?.code ?? e?.code) === '23505';
}

// Violación de una restricción de exclusión de Postgres (23P01), p. ej. dos
// membresías del mismo usuario con períodos superpuestos.
export function esViolacionExclusion(err: unknown): boolean {
  const e = err as ErrorDeBase | null;
  return (e?.driverError?.code ?? e?.code) === '23P01';
}

// Traduce una violación de UNIQUE a 409 con un mensaje claro, según la
// columna involucrada. NUNCA copia el `detail` de Postgres al mensaje (trae el
// valor duplicado, es decir el DNI o el email). Devuelve null si el error no es
// de unicidad: quien llama debe relanzar el original.
export function conflictoPorUnique(
  err: unknown,
  mensajes: Record<string, string>,
  porDefecto = 'Ya existe un registro con esos datos',
): ConflictException | null {
  if (!esViolacionUnique(err)) return null;
  const e = err as ErrorDeBase;
  const pista = `${e.driverError?.constraint ?? e.constraint ?? ''} ${
    e.driverError?.detail ?? e.detail ?? ''
  }`.toLowerCase();
  for (const [columna, mensaje] of Object.entries(mensajes)) {
    if (pista.includes(columna.toLowerCase())) {
      return new ConflictException(mensaje);
    }
  }
  return new ConflictException(porDefecto);
}
