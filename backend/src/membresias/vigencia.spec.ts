import { EstadoMembresia } from '../entities/enums';
import {
  esProxima,
  esVigente,
  estadoEfectivo,
  hoyArgentina,
  obtenerCadena,
  obtenerProxima,
  obtenerVigente,
  sqlVigente,
  sumarMeses,
} from './vigencia';

const fila = (
  estado: EstadoMembresia,
  fechaInicio: string,
  fechaFin: string,
  id = `${estado}-${fechaInicio}`,
) => ({ id, estado, fechaInicio, fechaFin });

// El repositorio simulado devuelve TODO sin filtrar: la regla de vigencia la
// aplican las funciones, no la consulta.
const repoCon = (filas: unknown[]) =>
  ({ find: jest.fn().mockResolvedValue(filas) }) as never;

describe('sumarMeses (sin desborde al mes siguiente)', () => {
  it.each([
    ['2026-01-31', 1, '2026-02-28'],
    ['2028-01-31', 1, '2028-02-29'], // bisiesto
    ['2026-11-30', 3, '2027-02-28'],
    ['2026-11-30', 1, '2026-12-30'],
    ['2026-10-18', 1, '2026-11-18'],
    ['2026-12-15', 1, '2027-01-15'],
    ['2026-03-31', 1, '2026-04-30'],
    ['2026-10-18', 12, '2027-10-18'],
    ['2028-02-29', 12, '2029-02-28'],
    ['2026-08-31', 3, '2026-11-30'],
  ])('%s + %i mes(es) = %s', (fecha, n, esperado) => {
    expect(sumarMeses(fecha, n)).toBe(esperado);
  });
});

describe('esVigente / esProxima (fecha_fin exclusiva)', () => {
  const m = fila(EstadoMembresia.ACTIVO, '2026-10-01', '2026-11-01');
  it('vigente desde fecha_inicio inclusive', () => {
    expect(esVigente(m, '2026-10-01')).toBe(true);
    expect(esVigente(m, '2026-10-31')).toBe(true);
  });
  it('el día de fecha_fin ya NO vale', () => {
    expect(esVigente(m, '2026-11-01')).toBe(false);
  });
  it('antes de empezar no es vigente: es próxima', () => {
    expect(esVigente(m, '2026-09-30')).toBe(false);
    expect(esProxima(m, '2026-09-30')).toBe(true);
    expect(esProxima(m, '2026-10-01')).toBe(false);
  });
  it('VENCIDO y SUSPENDIDO nunca son vigentes ni próximas', () => {
    for (const estado of [
      EstadoMembresia.VENCIDO,
      EstadoMembresia.SUSPENDIDO,
    ]) {
      const x = fila(estado, '2026-10-01', '2026-11-01');
      expect(esVigente(x, '2026-10-15')).toBe(false);
      expect(esProxima(x, '2026-09-01')).toBe(false);
    }
  });
  it('ACTIVO ya terminada (el cron no corrió) se ve como VENCIDO', () => {
    expect(estadoEfectivo(m, '2026-11-01')).toBe(EstadoMembresia.VENCIDO);
    expect(estadoEfectivo(m, '2026-10-31')).toBe(EstadoMembresia.ACTIVO);
  });
});

describe('consultas de vigencia (una vigente más una próxima)', () => {
  const vencida = fila(EstadoMembresia.VENCIDO, '2026-08-01', '2026-09-01');
  const suspendida = fila(
    EstadoMembresia.SUSPENDIDO,
    '2026-09-01',
    '2026-12-01',
  );
  const activaTerminada = fila(
    EstadoMembresia.ACTIVO,
    '2026-09-01',
    '2026-10-01',
  );
  const vigente = fila(EstadoMembresia.ACTIVO, '2026-10-10', '2026-11-10');
  const proxima = fila(EstadoMembresia.ACTIVO, '2026-11-10', '2026-12-10');
  const todas = [vencida, suspendida, activaTerminada, vigente, proxima];
  const hoy = '2026-10-18';

  it('obtenerVigente elige por fechas, no la futura ni la terminada', async () => {
    expect(await obtenerVigente(repoCon(todas), 'u1', hoy)).toBe(vigente);
  });
  it('obtenerProxima devuelve la que todavía no empezó', async () => {
    expect(await obtenerProxima(repoCon(todas), 'u1', hoy)).toBe(proxima);
  });
  it('sin vigente: null (aunque haya una ACTIVO terminada o una suspendida)', async () => {
    const r = repoCon([vencida, suspendida, activaTerminada]);
    expect(await obtenerVigente(r, 'u1', hoy)).toBeNull();
    expect(await obtenerProxima(r, 'u1', hoy)).toBeNull();
  });
  it('obtenerCadena: mayor fecha_fin entre las ACTIVO que no terminaron', async () => {
    const c = await obtenerCadena(repoCon(todas), 'u1', hoy);
    expect(c.vigente).toBe(vigente);
    expect(c.proxima).toBe(proxima);
    expect(c.mayorFin).toBe('2026-12-10');
  });
  it('obtenerCadena ignora vencidas, suspendidas y ACTIVO terminadas', async () => {
    const c = await obtenerCadena(
      repoCon([vencida, suspendida, activaTerminada]),
      'u1',
      hoy,
    );
    expect(c).toEqual({ vigente: null, proxima: null, mayorFin: null });
  });
});

describe('hora argentina como "hoy"', () => {
  afterEach(() => jest.useRealTimers());
  it('a las 22:00 en Argentina (01:00 UTC del día siguiente) hoy sigue siendo el día argentino', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-18T01:00:00Z'));
    expect(hoyArgentina()).toBe('2026-10-17');
  });
});

describe('sqlVigente', () => {
  it('usa fechas y estado, con fecha_fin exclusiva', () => {
    expect(sqlVigente('m', ':hoy')).toBe(
      "m.estado = 'ACTIVO' AND m.fecha_inicio <= :hoy AND m.fecha_fin > :hoy",
    );
  });
});
