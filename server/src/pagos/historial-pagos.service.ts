import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { escaparLike } from '../common/helpers/like.helper';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import type {
  HistorialPagosQueryDto,
  MisPagosQueryDto,
} from './dto/historial-pagos-query.dto';

const TZ = 'America/Argentina/Buenos_Aires';

interface FilaPago {
  id: string;
  fecha: Date;
  usuario_id: string;
  nombre: string;
  apellido: string;
  metodo: string;
  monto: string;
  estado: string;
  tipo: 'MEMBRESIA' | 'CANCHA' | 'CLASE';
  plan: string | null;
  cancha_nombre: string | null;
  res_fecha: string | null;
  res_hora_inicio: string | null;
  sede_id: string | null;
  sede_nombre: string | null;
  cobrador_nombre: string | null;
  cobrador_apellido: string | null;
  comprobante_id: string | null;
}

export interface PagoHistorial {
  id: string;
  fecha: Date;
  cliente: { id: string; nombre: string; apellido: string };
  concepto: string;
  tipo: string;
  metodo: string;
  monto: string;
  estado: string;
  sede: { id: string; nombre: string } | null;
  cobradoPor: string | null;
  comprobanteId: string | null;
}

export interface PagoPropio {
  id: string;
  fecha: Date;
  concepto: string;
  tipo: string;
  metodo: string;
  monto: string;
  estado: string;
  comprobanteId: string | null;
}

export interface TotalesHistorial {
  cantidad: number;
  montoAprobado: string;
  montoEfectivo: string;
  montoOnline: string;
}

// Un pago pertenece a la sede de su membresía o de la cancha reservada.
const FROM_PAGOS = `
  FROM pagos p
  JOIN usuarios u ON u.id = p.usuario_id
  LEFT JOIN membresias m ON m.id = p.membresia_id
  LEFT JOIN reservas_cancha r ON r.id = p.reserva_cancha_id
  LEFT JOIN canchas ca ON ca.id = r.cancha_id
  LEFT JOIN sedes s ON s.id = COALESCE(m.sede_alta_id, ca.sede_id)
  LEFT JOIN usuarios cob ON cob.id = p.registrado_por_id
  LEFT JOIN comprobantes c ON c.pago_id = p.id`;

const COLUMNAS = `
  p.id, p.creado_en AS fecha, p.usuario_id, u.nombre, u.apellido,
  p.metodo::text AS metodo, p.monto::text AS monto, p.estado::text AS estado,
  CASE WHEN p.membresia_id IS NOT NULL THEN 'MEMBRESIA'
       WHEN p.reserva_cancha_id IS NOT NULL THEN 'CANCHA' ELSE 'CLASE' END AS tipo,
  m.plan::text AS plan, ca.nombre AS cancha_nombre,
  r.fecha::text AS res_fecha, r.hora_inicio::text AS res_hora_inicio,
  s.id AS sede_id, s.nombre AS sede_nombre,
  cob.nombre AS cobrador_nombre, cob.apellido AS cobrador_apellido,
  c.id AS comprobante_id`;

function concepto(f: FilaPago): string {
  if (f.tipo === 'MEMBRESIA') {
    const plan = f.plan ? f.plan.charAt(0) + f.plan.slice(1).toLowerCase() : '';
    return `Membresía ${plan}`.trim();
  }
  if (f.tipo === 'CANCHA') {
    const cuando = f.res_fecha
      ? ` · ${f.res_fecha} ${(f.res_hora_inicio ?? '').slice(0, 5)}`.trimEnd()
      : '';
    return `Cancha ${f.cancha_nombre ?? ''}${cuando}`.trim();
  }
  return 'Clase';
}

// ¿Puede este usuario ver un recurso de pago? Dueño (Socio/Externo), personal de
// la sede del pago o Gerente General. Fail-closed: sin sede no hay acceso de sede.
export function puedeVerPago(
  user: UsuarioAutenticado,
  pago: { usuarioId: string; sedeId: string | null },
): boolean {
  if (user.tipoActor === TipoActor.GERENTE_GENERAL) return true;
  if (
    user.tipoActor === TipoActor.SOCIO ||
    user.tipoActor === TipoActor.EXTERNO
  )
    return pago.usuarioId === user.id;
  if (
    user.tipoActor === TipoActor.RECEPCIONISTA ||
    user.tipoActor === TipoActor.GERENTE_SEDE
  )
    return !!user.sedeId && !!pago.sedeId && user.sedeId === pago.sedeId;
  return false;
}

@Injectable()
export class HistorialPagosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  // Historial del personal: GG ve todas las sedes (filtro opcional); recepcionista
  // y gerente de sede, solo la suya.
  async listar(
    query: HistorialPagosQueryDto,
    user: UsuarioAutenticado,
  ): Promise<PaginatedResponse<PagoHistorial> & { totales: TotalesHistorial }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const params: unknown[] = [];
    const donde: string[] = [];
    const p = (valor: unknown) => {
      params.push(valor);
      return `$${params.length}`;
    };

    if (user.tipoActor === TipoActor.GERENTE_GENERAL) {
      if (query.sedeId) donde.push(`s.id = ${p(query.sedeId)}`);
    } else {
      if (!user.sedeId) {
        throw new ForbiddenException('Tu usuario no tiene una sede asignada');
      }
      donde.push(`s.id = ${p(user.sedeId)}`);
    }
    if (query.desde) {
      donde.push(
        `p.creado_en >= (${p(query.desde)}::date)::timestamp AT TIME ZONE '${TZ}'`,
      );
    }
    if (query.hasta) {
      donde.push(
        `p.creado_en < ((${p(query.hasta)}::date + 1))::timestamp AT TIME ZONE '${TZ}'`,
      );
    }
    if (query.metodo === 'EFECTIVO') donde.push(`p.metodo = 'EFECTIVO'`);
    if (query.metodo === 'ONLINE') donde.push(`p.metodo <> 'EFECTIVO'`);
    if (query.tipo === 'MEMBRESIA') donde.push('p.membresia_id IS NOT NULL');
    if (query.tipo === 'CANCHA') donde.push('p.reserva_cancha_id IS NOT NULL');
    if (query.estado) donde.push(`p.estado::text = ${p(query.estado)}`);
    const q = (query.q ?? '').trim();
    if (q) {
      if (q.length < 3) {
        throw new BadRequestException(
          'La búsqueda necesita al menos 3 caracteres',
        );
      }
      const ref = p(`%${escaparLike(q)}%`);
      donde.push(
        `(u.nombre ILIKE ${ref} OR u.apellido ILIKE ${ref} OR u.dni ILIKE ${ref} OR (u.nombre || ' ' || u.apellido) ILIKE ${ref})`,
      );
    }
    const where = donde.length ? `WHERE ${donde.join(' AND ')}` : '';

    const [tot] = await this.dataSource.query<
      { cantidad: string; aprobado: string; efectivo: string; online: string }[]
    >(
      `SELECT COUNT(*)::text AS cantidad,
              COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'APROBADO'), 0)::text AS aprobado,
              COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'APROBADO' AND p.metodo = 'EFECTIVO'), 0)::text AS efectivo,
              COALESCE(SUM(p.monto) FILTER (WHERE p.estado = 'APROBADO' AND p.metodo <> 'EFECTIVO'), 0)::text AS online
       ${FROM_PAGOS} ${where}`,
      params,
    );
    const paramsFilas = [...params];
    paramsFilas.push(limit, (page - 1) * limit);
    const filas = await this.dataSource.query<FilaPago[]>(
      `SELECT ${COLUMNAS} ${FROM_PAGOS} ${where}
       ORDER BY p.creado_en DESC, p.id
       LIMIT $${paramsFilas.length - 1} OFFSET $${paramsFilas.length}`,
      paramsFilas,
    );
    const total = Number(tot?.cantidad ?? 0);
    return {
      data: filas.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        cliente: { id: f.usuario_id, nombre: f.nombre, apellido: f.apellido },
        concepto: concepto(f),
        tipo: f.tipo,
        metodo: f.metodo,
        monto: f.monto,
        estado: f.estado,
        sede: f.sede_id ? { id: f.sede_id, nombre: f.sede_nombre ?? '' } : null,
        cobradoPor:
          f.metodo === 'EFECTIVO' && f.cobrador_nombre
            ? `${f.cobrador_nombre} ${f.cobrador_apellido ?? ''}`.trim()
            : null,
        comprobanteId: f.comprobante_id,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      totales: {
        cantidad: total,
        montoAprobado: tot?.aprobado ?? '0',
        montoEfectivo: tot?.efectivo ?? '0',
        montoOnline: tot?.online ?? '0',
      },
    };
  }

  // Historial propio: el usuario sale SIEMPRE del JWT. Sin datos de terceros ni
  // de quién cobró en el mostrador.
  async listarMios(
    query: MisPagosQueryDto,
    user: UsuarioAutenticado,
  ): Promise<PaginatedResponse<PagoPropio>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [{ total }] = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM pagos p WHERE p.usuario_id = $1`,
      [user.id],
    );
    const filas = await this.dataSource.query<FilaPago[]>(
      `SELECT ${COLUMNAS} ${FROM_PAGOS} WHERE p.usuario_id = $1
       ORDER BY p.creado_en DESC, p.id LIMIT $2 OFFSET $3`,
      [user.id, limit, (page - 1) * limit],
    );
    const totalNum = Number(total);
    return {
      data: filas.map((f) => ({
        id: f.id,
        fecha: f.fecha,
        concepto: concepto(f),
        tipo: f.tipo,
        metodo: f.metodo,
        monto: f.monto,
        estado: f.estado,
        comprobanteId: f.comprobante_id,
      })),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit) || 1,
    };
  }

  // Resuelve el comprobante validando el acceso. 404 (no 403) si no es del
  // usuario o de su sede, para no confirmar que existe.
  //
  // LIMITACIÓN CONOCIDA: `pdf_path` guarda la URL pública del bucket de Supabase;
  // quien la tenga puede abrirla sin sesión (el nombre es un UUID aleatorio, pero
  // no hay autorización). Este endpoint controla el acceso desde la app, no
  // protege el archivo. Cerrarlo requiere un bucket privado + URLs firmadas.
  async obtenerArchivo(
    comprobanteId: string,
    user: UsuarioAutenticado,
  ): Promise<{ buffer: Buffer }> {
    const [fila] = await this.dataSource.query<
      { pdf_path: string; usuario_id: string; sede_id: string | null }[]
    >(
      `SELECT c.pdf_path, p.usuario_id, COALESCE(m.sede_alta_id, ca.sede_id) AS sede_id
       FROM comprobantes c
       JOIN pagos p ON p.id = c.pago_id
       LEFT JOIN membresias m ON m.id = p.membresia_id
       LEFT JOIN reservas_cancha r ON r.id = p.reserva_cancha_id
       LEFT JOIN canchas ca ON ca.id = r.cancha_id
       WHERE c.id = $1`,
      [comprobanteId],
    );
    if (
      !fila ||
      !puedeVerPago(user, { usuarioId: fila.usuario_id, sedeId: fila.sede_id })
    ) {
      throw new NotFoundException('Comprobante no encontrado');
    }
    const base = this.config.get<string>('SUPABASE_URL') ?? '';
    // Solo se descarga de nuestro propio Supabase.
    if (!base || !fila.pdf_path.startsWith(base)) {
      throw new NotFoundException('Comprobante no disponible');
    }
    const res = await fetch(fila.pdf_path);
    if (!res.ok) throw new NotFoundException('Comprobante no disponible');
    return { buffer: Buffer.from(await res.arrayBuffer()) };
  }
}
