import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../../shared/components/organisms/ErrorBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Instancia falsa de Html5Qrcode: el estado y el comportamiento de stop() los fija cada prueba.
const m = vi.hoisted(() => ({
  estado: 1,
  stop: vi.fn(),
  clear: vi.fn(),
  start: vi.fn(),
}));

vi.mock('html5-qrcode', () => ({
  Html5QrcodeScannerState: { UNKNOWN: 0, NOT_STARTED: 1, SCANNING: 2, PAUSED: 3 },
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
  Html5Qrcode: class {
    static getCameras = () => Promise.resolve([{ id: 'cam-1', label: 'cam' }]);
    getState = () => m.estado;
    start = m.start;
    stop = m.stop;
    clear = m.clear;
  },
}));

import { LectorQr } from './LectorQr';

let contenedor: HTMLDivElement;
let raiz: Root;
const pendientes = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  m.estado = 1;
  m.stop.mockReset();
  m.clear.mockReset();
  m.start.mockReset().mockResolvedValue(undefined);
  contenedor = document.createElement('div');
  document.body.appendChild(contenedor);
  raiz = createRoot(contenedor);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  contenedor.remove();
  vi.restoreAllMocks();
});

async function montarYDesmontar() {
  act(() =>
    raiz.render(
      <ErrorBoundary>
        <LectorQr onDetectado={() => undefined} />
      </ErrorBoundary>,
    ),
  );
  await pendientes();
  act(() => raiz.unmount());
  await pendientes();
}

describe('LectorQr: detener el lector', () => {
  it('si el lector no está escaneando y stop() lanza de forma síncrona, montar y desmontar no rompe ni muestra el ErrorBoundary', async () => {
    m.estado = 1; // NOT_STARTED
    m.stop.mockImplementation(() => {
      throw new Error('Cannot stop, scanner is not running or paused.');
    });
    const errores: unknown[] = [];
    const alError = (e: ErrorEvent) => errores.push(e.error);
    const alRechazo = (e: PromiseRejectionEvent) => errores.push(e.reason);
    window.addEventListener('error', alError);
    window.addEventListener('unhandledrejection', alRechazo);

    await expect(montarYDesmontar()).resolves.toBeUndefined();

    window.removeEventListener('error', alError);
    window.removeEventListener('unhandledrejection', alRechazo);
    expect(contenedor.textContent).not.toContain('Ocurrió un error en esta pantalla');
    expect(m.stop).not.toHaveBeenCalled();
    expect(errores).toEqual([]);
  });

  it('si el lector está escaneando, stop() se llama una sola vez y luego se limpia el visor', async () => {
    m.estado = 2; // SCANNING
    m.stop.mockResolvedValue(undefined);
    await montarYDesmontar();
    expect(m.stop).toHaveBeenCalledTimes(1);
    expect(m.clear).toHaveBeenCalled();
  });

  it('si stop() lanza estando en SCANNING, el error se absorbe', async () => {
    m.estado = 2;
    m.stop.mockImplementation(() => {
      throw new Error('boom');
    });
    await expect(montarYDesmontar()).resolves.toBeUndefined();
    expect(contenedor.textContent).not.toContain('Ocurrió un error en esta pantalla');
  });
});
