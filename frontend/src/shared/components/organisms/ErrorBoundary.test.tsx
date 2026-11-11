import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let falla = true;
function Hijo() {
  if (falla) throw new Error('Cannot read properties of undefined (reading slice)');
  return <p>Pantalla sana</p>;
}

let contenedor: HTMLDivElement;
let raiz: Root;

function montar(resetKey = 'a') {
  act(() => raiz.render(<ErrorBoundary resetKey={resetKey}><Hijo /></ErrorBoundary>));
}
const boton = (texto: string) => [...contenedor.querySelectorAll('button')].find((b) => b.textContent === texto);

beforeEach(() => {
  falla = true;
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  act(() => raiz.unmount());
  contenedor.remove();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('ante un error de render muestra el mensaje, el detalle y los dos botones en vez de una pantalla vacía', () => {
    montar();
    expect(contenedor.textContent).toContain('Ocurrió un error en esta pantalla');
    expect(contenedor.querySelector('[data-testid="detalle-error"]')?.textContent).toContain('reading slice');
    expect(boton('Volver a intentar')).toBeTruthy();
    expect(boton('Recargar')).toBeTruthy();
  });

  it('muestra como máximo 5 líneas del componentStack', () => {
    montar();
    const lineas = (contenedor.querySelector('[data-testid="detalle-error"]')?.textContent ?? '').split('\n');
    // 1 línea de message + hasta 5 de stack
    expect(lineas.length).toBeLessThanOrEqual(6);
    expect(lineas.length).toBeGreaterThan(1);
  });

  it('registra el error en consola', () => {
    montar();
    const llamadas = (console.error as unknown as ReturnType<typeof vi.fn>).mock.calls;
    expect(llamadas.some((c) => String(c[0]).includes('[ErrorBoundary]'))).toBe(true);
  });

  it('"Volver a intentar" reinicia el estado y vuelve a mostrar la pantalla si el error ya no ocurre', () => {
    montar();
    falla = false;
    act(() => boton('Volver a intentar')!.click());
    expect(contenedor.textContent).toContain('Pantalla sana');
    expect(contenedor.textContent).not.toContain('Ocurrió un error');
  });

  it('al cambiar de ruta (resetKey) descarta el error', () => {
    montar('a');
    falla = false;
    montar('b');
    expect(contenedor.textContent).toContain('Pantalla sana');
  });
});
