import { writeFileSync } from 'fs';
import { Comprobante, Pago } from '../../entities';
import {
  EstadoPago,
  MetodoPago,
  TipoEstrategiaPrecio,
  TipoActor,
} from '../../entities/enums';
import type { UsuarioAutenticado } from '../../auth/types/usuario-autenticado.type';
import { PagosService } from '../pagos.service';
import {
  armarDatosComprobante,
  enmascararDni,
  formatearARS,
  sanear,
} from './datos-comprobante';
import { PdfGeneratorService } from './pdf-generator.service';

const sede = {
  id: 's1',
  nombre: 'FitZone Centro',
  direccion: 'Av. Colón 1234, Córdoba',
};
const cliente = { id: 'c1', nombre: 'Ana', apellido: 'Paz', dni: '30111222' };
const cobrador = { id: 'r1', nombre: 'Rita', apellido: 'Gómez' };

function pagoMembresia(extra: Partial<Pago> = {}): Pago {
  return {
    id: '1a2b3c4d-0000-0000-0000-000000000000',
    usuario: cliente,
    membresia: {
      plan: 'MENSUAL',
      fechaInicio: '2026-10-09',
      fechaFin: '2026-11-09',
      sedeAlta: sede,
    },
    metodo: MetodoPago.EFECTIVO,
    registradoPor: cobrador,
    monto: '25000.00',
    estado: EstadoPago.APROBADO,
    // 02:40 UTC del 10/10 = 23:40 del 09/10 en Argentina.
    pagadoEn: new Date('2026-10-10T02:40:00Z'),
    creadoEn: new Date('2026-10-10T02:40:00Z'),
    ...extra,
  } as unknown as Pago;
}

function pagoCancha(
  estrategia: TipoEstrategiaPrecio,
  precioFinal: string,
  extra: Partial<Pago> = {},
): Pago {
  return {
    id: '9f8e7d6c-0000-0000-0000-000000000000',
    usuario: cliente,
    reservaCancha: {
      fecha: '2026-10-10',
      horaInicio: '19:00:00',
      horaFin: '20:00:00',
      estrategiaPrecio: estrategia,
      precioFinal,
      cancha: { nombre: 'Pádel 1', sede },
    },
    metodo: MetodoPago.MERCADOPAGO,
    monto: precioFinal,
    estado: EstadoPago.APROBADO,
    pagadoEn: new Date('2026-10-09T15:00:00Z'),
    creadoEn: new Date('2026-10-09T15:00:00Z'),
    ...extra,
  } as unknown as Pago;
}

describe('formato y saneado', () => {
  it('montos en pesos argentinos: miles con punto, decimales con coma', () => {
    expect(formatearARS(25000)).toBe('$ 25.000,00');
    expect(formatearARS(1234567.5)).toBe('$ 1.234.567,50');
    expect(formatearARS(-2550)).toBe('-$ 2.550,00');
    expect(formatearARS(0.5)).toBe('$ 0,50');
  });

  it('DNI: solo los últimos 3 dígitos', () => {
    expect(enmascararDni('30111222')).toBe('*****222');
    expect(enmascararDni('123')).toBe('123');
    expect(enmascararDni(null)).toBeNull();
    expect(enmascararDni('  ')).toBeNull();
  });

  it('sanea caracteres de control y espacios', () => {
    expect(sanear('Ana\u0000\n  Paz\t')).toBe('Ana Paz');
    expect(sanear(undefined)).toBe('');
  });
});

describe('datos del comprobante', () => {
  it('membresía en efectivo: plan, vigencia, sede, cobrador y hora argentina', () => {
    const d = armarDatosComprobante(pagoMembresia());
    expect(d.codigo).toBe('FZ-1A2B3C4D');
    expect(d.fechaHora).toBe('09/10/2026 23:40 hs');
    expect(d.sede).toEqual({ nombre: sede.nombre, direccion: sede.direccion });
    expect(d.concepto.titulo).toBe('Membresía Mensual');
    expect(d.concepto.detalle).toEqual(['Vigencia: 09/10/2026 al 09/11/2026']);
    expect(d.cobradoPor).toBe('Rita Gómez');
    expect(d.cliente.dni).toBe('*****222');
    expect(d.desglose).toEqual([{ etiqueta: 'Subtotal', monto: 25000 }]);
    expect(d.total).toBe(25000);
  });

  it('el DNI completo no aparece en ningún dato', () => {
    expect(
      JSON.stringify(armarDatosComprobante(pagoMembresia())),
    ).not.toContain('30111222');
  });

  it('pago online: no muestra quién cobró aunque venga un registrador', () => {
    const d = armarDatosComprobante(
      pagoMembresia({
        metodo: MetodoPago.MODO,
        registradoPor: cobrador as never,
      }),
    );
    expect(d.cobradoPor).toBeNull();
    expect(d.metodo).toBe('Modo');
  });

  it('cancha sin descuento: subtotal = total', () => {
    const d = armarDatosComprobante(
      pagoCancha(TipoEstrategiaPrecio.ESTANDAR, '9000.00'),
    );
    expect(d.concepto.titulo).toBe('Reserva de cancha · Pádel 1');
    expect(d.concepto.detalle).toEqual([
      'Fecha: 10/10/2026 (10/10)',
      'Horario: 19:00 a 20:00 hs',
    ]);
    expect(d.desglose).toEqual([{ etiqueta: 'Subtotal', monto: 9000 }]);
  });

  it('cancha con descuento de socio: subtotal, descuento y total cierran', () => {
    const d = armarDatosComprobante(
      pagoCancha(TipoEstrategiaPrecio.SOCIO_DESCUENTO, '8500.00'),
    );
    expect(d.desglose).toEqual([
      { etiqueta: 'Subtotal', monto: 10000 },
      { etiqueta: 'Descuento de socio (15%)', monto: -1500 },
    ]);
    const suma = d.desglose.reduce((s, l) => s + l.monto, 0);
    expect(suma).toBeCloseTo(d.total, 2);
  });

  it('cancha en hora pico y socio: recargo y descuento, y la suma cierra', () => {
    // 10000 base -> +15% = 11500 -> -15% = 9775
    const d = armarDatosComprobante(
      pagoCancha(TipoEstrategiaPrecio.SOCIO_HORA_PICO, '9775.00'),
    );
    expect(d.desglose.map((l) => l.etiqueta)).toEqual([
      'Subtotal',
      'Recargo hora pico (15%)',
      'Descuento de socio (15%)',
    ]);
    const suma = d.desglose.reduce((s, l) => s + l.monto, 0);
    expect(suma).toBeCloseTo(9775, 2);
  });

  it('pago rechazado: conserva el estado (se dibuja en coral)', () => {
    const d = armarDatosComprobante(
      pagoMembresia({ estado: EstadoPago.RECHAZADO }),
    );
    expect(d.estado).toBe(EstadoPago.RECHAZADO);
  });
});

describe('PdfGeneratorService: PDF válido', () => {
  const gen = new PdfGeneratorService();
  const casos: Array<[string, Pago]> = [
    ['membresía en efectivo', pagoMembresia()],
    [
      'membresía online',
      pagoMembresia({
        metodo: MetodoPago.MERCADOPAGO,
        registradoPor: undefined,
      }),
    ],
    [
      'cancha online sin descuento',
      pagoCancha(TipoEstrategiaPrecio.ESTANDAR, '9000.00'),
    ],
    [
      'cancha con descuento de socio',
      pagoCancha(TipoEstrategiaPrecio.SOCIO_DESCUENTO, '8500.00'),
    ],
    [
      'cancha en efectivo, hora pico y socio',
      pagoCancha(TipoEstrategiaPrecio.SOCIO_HORA_PICO, '9775.00', {
        metodo: MetodoPago.EFECTIVO,
        registradoPor: cobrador as never,
      }),
    ],
    ['pago rechazado', pagoMembresia({ estado: EstadoPago.RECHAZADO })],
    [
      'cliente sin DNI y textos con caracteres raros',
      pagoMembresia({
        usuario: {
          nombre: 'Ñandú\u0000',
          apellido: 'Pérez  ',
          dni: null,
        } as never,
      }),
    ],
  ];

  it.each(casos)('%s', async (_n, pago) => {
    const buf = await gen.generarComprobantePago(pago);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buf.subarray(-16).toString()).toContain('%%EOF');
    expect(buf.length).toBeGreaterThan(1500);
    // Una sola página A4.
    expect(
      (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length,
    ).toBe(1);
    // Muestras para revisar a ojo si se define COMPROBANTE_MUESTRAS=carpeta.
    const dir = process.env.COMPROBANTE_MUESTRAS;
    if (dir) writeFileSync(`${dir}/${_n.replace(/\W+/g, '-')}.pdf`, buf);
  });
});

describe('regeneración sin duplicar', () => {
  const gg: UsuarioAutenticado = {
    id: 'gg',
    tipoActor: TipoActor.GERENTE_GENERAL,
    email: 'g@x.com',
    sedeId: null,
  };
  const recepB: UsuarioAutenticado = {
    id: 'rB',
    tipoActor: TipoActor.RECEPCIONISTA,
    email: 'r@x.com',
    sedeId: 'sedeB',
  };

  function armar(existente: Partial<Comprobante> | null) {
    const pago = {
      id: 'p1',
      estado: EstadoPago.APROBADO,
      usuario: { id: 'cli1' },
      membresia: { sedeAlta: { id: 's1' } },
    };
    const qb: Record<string, jest.Mock> = {};
    qb.setLock = jest.fn(() => qb);
    qb.where = jest.fn(() => qb);
    qb.getOne = jest.fn().mockResolvedValue(pago);
    const manager = {
      getRepository: (e: unknown) =>
        e === Pago
          ? {
              createQueryBuilder: () => qb,
              findOne: jest.fn().mockResolvedValue(pago),
            }
          : { findOne: jest.fn().mockResolvedValue(existente) },
    };
    const comprobantes = {
      generar: jest
        .fn()
        .mockResolvedValue({ id: 'nuevo', generadoEn: new Date(5) }),
      regenerar: jest.fn().mockResolvedValue({
        comprobante: { id: 'c1', generadoEn: new Date(9) },
        pdfPathAnterior: 'https://x/viejo.pdf',
      }),
      eliminarArchivo: jest.fn().mockResolvedValue(undefined),
    };
    const service = new PagosService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      comprobantes as never,
      {} as never,
      {} as never,
      { transaction: (cb: (m: unknown) => unknown) => cb(manager) } as never,
      {} as never,
      {} as never,
    );
    return { service, comprobantes };
  }

  it('reemplaza el PDF del MISMO registro y borra el archivo anterior', async () => {
    const t = armar({
      id: 'c1',
      pdfPath: 'https://x/viejo.pdf',
      generadoEn: new Date(1),
    });
    const r = await t.service.generarComprobanteBajoDemanda('p1', gg, true);
    expect(r).toEqual({ id: 'c1', generadoEn: new Date(9), creado: false });
    expect(t.comprobantes.regenerar).toHaveBeenCalledTimes(1);
    expect(t.comprobantes.generar).not.toHaveBeenCalled();
    expect(t.comprobantes.eliminarArchivo).toHaveBeenCalledWith(
      'https://x/viejo.pdf',
    );
  });

  it('sin regenerar, devuelve el existente y no toca nada', async () => {
    const t = armar({ id: 'c1', generadoEn: new Date(1) });
    const r = await t.service.generarComprobanteBajoDemanda('p1', gg, false);
    expect(r.id).toBe('c1');
    expect(t.comprobantes.regenerar).not.toHaveBeenCalled();
    expect(t.comprobantes.eliminarArchivo).not.toHaveBeenCalled();
  });

  it('regenerar un pago que aún no tiene comprobante lo crea (uno solo)', async () => {
    const t = armar(null);
    const r = await t.service.generarComprobanteBajoDemanda('p1', gg, true);
    expect(r.creado).toBe(true);
    expect(t.comprobantes.generar).toHaveBeenCalledTimes(1);
    expect(t.comprobantes.eliminarArchivo).not.toHaveBeenCalled();
  });

  it('otra sede: 404 y no regenera', async () => {
    const t = armar({ id: 'c1' });
    await expect(
      t.service.generarComprobanteBajoDemanda('p1', recepB, true),
    ).rejects.toThrow('Pago no encontrado');
    expect(t.comprobantes.regenerar).not.toHaveBeenCalled();
  });
});
