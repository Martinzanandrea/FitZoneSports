// Decide de qué tipo es un error de una petición. Es lo que separa "no hay red"
// (el modo offline debe seguir funcionando) de "el servidor dijo que la sesión
// no vale" (hay que cerrar sesión). Funciones puras, sin axios ni React.

export type ClaseError =
  | 'RED' // la petición no obtuvo respuesta: sin red, timeout, servidor inalcanzable
  | 'AUTENTICACION' // 401 o 403: token inválido o usuario sin permiso/desactivado
  | 'SERVIDOR' // 5xx: el servidor respondió pero está caído o roto
  | 'OTRO'; // cualquier otra respuesta (4xx de negocio, validación, etc.)

const estadoDe = (err: unknown): number | undefined => {
  const status = (err as { response?: { status?: unknown } } | null)?.response?.status;
  return typeof status === 'number' ? status : undefined;
};

export function clasificarError(err: unknown): ClaseError {
  const status = estadoDe(err);
  // Sin respuesta HTTP no hay nada que el servidor haya dicho de la sesión
  // (cubre error de red, timeout ECONNABORTED y peticiones canceladas).
  if (status === undefined) return 'RED';
  if (status === 401 || status === 403) return 'AUTENTICACION';
  if (status >= 500) return 'SERVIDOR';
  return 'OTRO';
}

// Un error de red o de servidor caído nunca prueba que la sesión sea inválida.
export function esFalloDeConectividad(err: unknown, enLinea: boolean = true): boolean {
  if (!enLinea && estadoDe(err) === undefined) return true;
  const clase = clasificarError(err);
  return clase === 'RED' || clase === 'SERVIDOR';
}

export type DecisionArranque = 'CONSERVAR_SIN_VERIFICAR' | 'CERRAR_SESION';

// Al arrancar, /auth/me falló. Con sesión guardada y un fallo de conectividad
// se conserva (marcada "sin verificar"); en cualquier otro caso se cierra,
// igual que antes: 401, 403, otras respuestas o ninguna sesión previa.
export function decidirTrasFalloAlArrancar(err: unknown, enLinea: boolean, haySesionLocal: boolean): DecisionArranque {
  return haySesionLocal && esFalloDeConectividad(err, enLinea) ? 'CONSERVAR_SIN_VERIFICAR' : 'CERRAR_SESION';
}
