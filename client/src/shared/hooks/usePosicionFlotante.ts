import { useCallback, useLayoutEffect, useState, type RefObject } from 'react';

export interface PosicionFlotante {
  top: number;
  left: number;
  width?: number;
  maxHeight: number;
  arriba: boolean;
}

interface Opciones {
  /** 'lista': mismo ancho que el disparador, abre abajo o arriba según el espacio. 'tooltip': centrado, prefiere arriba. */
  modo: 'lista' | 'tooltip';
  altoMaximo?: number;
  separacion?: number;
}

const MARGEN = 8;

// Calcula coordenadas `fixed` para un elemento flotante renderizado en un portal,
// a partir del disparador. Se recalcula en scroll (de cualquier ancestro) y resize.
export function usePosicionFlotante(
  abierto: boolean,
  anclaRef: RefObject<HTMLElement | null>,
  flotanteRef: RefObject<HTMLElement | null>,
  { modo, altoMaximo = 240, separacion = 6 }: Opciones,
): PosicionFlotante | null {
  const [pos, setPos] = useState<PosicionFlotante | null>(null);

  const calcular = useCallback(() => {
    const ancla = anclaRef.current;
    const flotante = flotanteRef.current;
    if (!ancla || !flotante) return;
    const r = ancla.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const natural = Math.min(flotante.scrollHeight, altoMaximo);
    const espacioAbajo = vh - r.bottom - separacion - MARGEN;
    const espacioArriba = r.top - separacion - MARGEN;

    const arriba = modo === 'tooltip'
      ? !(espacioArriba < natural && espacioAbajo > espacioArriba)
      : !(natural <= espacioAbajo || espacioAbajo >= espacioArriba);
    const maxHeight = Math.max(80, Math.min(altoMaximo, arriba ? espacioArriba : espacioAbajo));
    const alto = Math.min(natural, maxHeight);
    const top = arriba ? r.top - separacion - alto : r.bottom + separacion;

    let left = r.left;
    let width: number | undefined;
    if (modo === 'lista') {
      width = r.width;
    } else {
      left = r.left + r.width / 2 - flotante.offsetWidth / 2;
    }
    const ancho = width ?? flotante.offsetWidth;
    left = Math.max(MARGEN, Math.min(left, vw - ancho - MARGEN));

    setPos((previa) =>
      previa && previa.top === top && previa.left === left && previa.width === width
        && previa.maxHeight === maxHeight && previa.arriba === arriba
        ? previa
        : { top, left, width, maxHeight, arriba },
    );
  }, [anclaRef, flotanteRef, modo, altoMaximo, separacion]);

  useLayoutEffect(() => {
    if (!abierto) return;
    calcular();
    window.addEventListener('scroll', calcular, true);
    window.addEventListener('resize', calcular);
    return () => {
      window.removeEventListener('scroll', calcular, true);
      window.removeEventListener('resize', calcular);
    };
  }, [abierto, calcular]);

  return abierto ? pos : null;
}
