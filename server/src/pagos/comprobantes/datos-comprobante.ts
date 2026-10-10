import { Pago } from '../../entities';
import { EstadoPago, TipoEstrategiaPrecio } from '../../entities/enums';
import { fechaCorta } from '../../common/helpers/hora-argentina.helper';

// Porcentajes de las estrategias de precio de canchas (ver canchas/pricing):
// el comprobante reconstruye el desglose a partir de la estrategia guardada en
// la reserva y del precio final cobrado.
const DESCUENTO_SOCIO = 0.15;
const RECARGO_HORA_PICO = 0.15;

export interface LineaDesglose {
  etiqueta: string;
  monto: number;
}

export interface DatosComprobante {
  codigo: string;
  fechaHora: string;
  estado: EstadoPago;
  sede: { nombre: string; direccion: string } | null;
  cliente: { nombre: string; dni: string | null };
  concepto: { titulo: string; detalle: string[] };
  metodo: string;
  cobradoPor: string | null;
  desglose: LineaDesglose[];
  total: number;
}

// Quita caracteres de control y espacios repetidos: los textos vienen de la base.
export function sanear(texto: string | null | undefined): string {
  return (
    (texto ?? '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

// El PDF vive en una URL pública: solo se muestran los últimos 3 dígitos.
export function enmascararDni(dni: string | null | undefined): string | null {
  const limpio = sanear(dni);
  if (!limpio) return null;
  const visibles = limpio.slice(-3);
  return '*'.repeat(Math.max(limpio.length - 3, 0)) + visibles;
}

// 25000 -> "$ 25.000,00" (miles con punto, decimales con coma), sin depender de ICU.
export function formatearARS(monto: number): string {
  const negativo = monto < 0;
  const [entero, dec] = Math.abs(monto).toFixed(2).split('.');
  const miles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}$ ${miles},${dec}`;
}

const NOMBRE_METODO: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  MERCADOPAGO: 'Mercado Pago',
  MODO: 'Modo',
};

const NOMBRE_PLAN: Record<string, string> = {
  MENSUAL: 'Mensual',
  TRIMESTRAL: 'Trimestral',
  ANUAL: 'Anual',
};

const ZONA = 'America/Argentina/Buenos_Aires';

export function fechaHoraArgentina(fecha: Date): string {
  const p = new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hourCycle: 'h23',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(fecha);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? '';
  return `${v('day')}/${v('month')}/${v('year')} ${v('hour')}:${v('minute')} hs`;
}

// "2026-10-31" -> "31/10/2026"
function fechaLarga(f: string): string {
  const [a, m, d] = f.split('-');
  return `${d}/${m}/${a}`;
}

const hhmm = (h: string) => h.slice(0, 5);
const redondear = (n: number) => Math.round(n * 100) / 100;

function desgloseCancha(
  estrategia: TipoEstrategiaPrecio | undefined,
  total: number,
): LineaDesglose[] {
  const socio =
    estrategia === TipoEstrategiaPrecio.SOCIO_DESCUENTO ||
    estrategia === TipoEstrategiaPrecio.SOCIO_HORA_PICO;
  const pico =
    estrategia === TipoEstrategiaPrecio.HORA_PICO ||
    estrategia === TipoEstrategiaPrecio.SOCIO_HORA_PICO;
  if (!socio && !pico) return [{ etiqueta: 'Subtotal', monto: total }];

  // Se deshace en orden inverso al que se aplicó (primero el recargo, luego el descuento).
  const conRecargo = socio ? total / (1 - DESCUENTO_SOCIO) : total;
  const base = pico ? conRecargo / (1 + RECARGO_HORA_PICO) : conRecargo;
  const lineas: LineaDesglose[] = [
    { etiqueta: 'Subtotal', monto: redondear(base) },
  ];
  if (pico) {
    lineas.push({
      etiqueta: 'Recargo hora pico (15%)',
      monto: redondear(base * RECARGO_HORA_PICO),
    });
  }
  if (socio) {
    lineas.push({
      etiqueta: 'Descuento de socio (15%)',
      monto: -redondear(conRecargo - total),
    });
  }
  return lineas;
}

// Arma, solo con campos que existen, lo que muestra el comprobante. Espera el
// pago con: usuario, registradoPor, membresia.sedeAlta, reservaCancha.cancha.sede.
export function armarDatosComprobante(pago: Pago): DatosComprobante {
  const total = Number(pago.monto);
  const sedeEntidad =
    pago.membresia?.sedeAlta ?? pago.reservaCancha?.cancha?.sede ?? null;

  let concepto: DatosComprobante['concepto'];
  let desglose: LineaDesglose[];
  if (pago.membresia) {
    const m = pago.membresia;
    concepto = {
      titulo: `Membresía ${NOMBRE_PLAN[m.plan] ?? sanear(m.plan)}`,
      detalle: [
        m.fechaInicio && m.fechaFin
          ? `Vigencia: ${fechaLarga(m.fechaInicio)} al ${fechaLarga(m.fechaFin)}`
          : '',
      ].filter(Boolean),
    };
    desglose = [{ etiqueta: 'Subtotal', monto: total }];
  } else if (pago.reservaCancha) {
    const r = pago.reservaCancha;
    concepto = {
      titulo: `Reserva de cancha${r.cancha?.nombre ? ` · ${sanear(r.cancha.nombre)}` : ''}`,
      detalle: [
        `Fecha: ${fechaLarga(r.fecha)} (${fechaCorta(r.fecha)})`,
        `Horario: ${hhmm(r.horaInicio)} a ${hhmm(r.horaFin)} hs`,
      ],
    };
    desglose = desgloseCancha(r.estrategiaPrecio, total);
  } else if (pago.reservaClase) {
    concepto = { titulo: 'Reserva de clase', detalle: [] };
    desglose = [{ etiqueta: 'Subtotal', monto: total }];
  } else {
    concepto = { titulo: 'Pago', detalle: [] };
    desglose = [{ etiqueta: 'Subtotal', monto: total }];
  }

  const cobrador = pago.registradoPor;
  return {
    codigo: `FZ-${pago.id.slice(0, 8).toUpperCase()}`,
    fechaHora: fechaHoraArgentina(pago.pagadoEn ?? pago.creadoEn ?? new Date()),
    estado: pago.estado,
    sede: sedeEntidad
      ? {
          nombre: sanear(sedeEntidad.nombre),
          direccion: sanear(sedeEntidad.direccion),
        }
      : null,
    cliente: {
      nombre: sanear(`${pago.usuario.nombre} ${pago.usuario.apellido}`),
      dni: enmascararDni(pago.usuario.dni),
    },
    concepto,
    metodo: NOMBRE_METODO[pago.metodo] ?? sanear(pago.metodo),
    cobradoPor:
      pago.metodo === 'EFECTIVO' && cobrador
        ? sanear(`${cobrador.nombre} ${cobrador.apellido}`)
        : null,
    desglose,
    total,
  };
}
