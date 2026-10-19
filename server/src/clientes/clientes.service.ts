import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { escaparLike } from '../common/helpers/like.helper';
import { ClientesQueryDto } from './dto/clientes-query.dto';
import { hoyArgentina } from '../membresias/vigencia';

export interface ClienteAfiliado {
  id: string;
  tipo: 'SOCIO' | 'EXTERNO' | 'INSTRUCTOR';
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  sede: { id: string; nombre: string } | null;
  /**
   * Solo socios con alguna membresía: plan y vencimiento (fecha_fin, exclusiva)
   * de la vigente hoy; sin vigente, de la más reciente que no sea una próxima.
   */
  membresia: { plan: string; vencimiento: string } | null;
}

// Socios y externos viven en `usuarios`; los instructores en su propia tabla
// (sin apellido, DNI, email ni sede). Se unifican en una sola consulta para
// filtrar, ordenar y paginar en la base sobre el conjunto completo.
// Solo se seleccionan columnas explícitas: nunca password_hash.
// `hoy` es la fecha argentina generada por el servidor (formato validado), nunca
// texto del usuario.
export function baseClientes(hoy: string): string {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(hoy)) throw new Error('Fecha inválida');
  return `
  SELECT u.id, u.tipo_actor::text AS tipo, u.nombre, u.apellido, u.dni, u.email,
         u.telefono, u.activo, s.id AS sede_id, s.nombre AS sede_nombre,
         m.plan AS plan, m.fecha_fin AS vencimiento
  FROM usuarios u
  LEFT JOIN sedes s ON s.id = u.sede_id
  LEFT JOIN LATERAL (
    SELECT mm.plan::text AS plan, mm.fecha_fin::text AS fecha_fin
    FROM membresias mm
    WHERE mm.usuario_id = u.id
      AND NOT (mm.estado = 'ACTIVO' AND mm.fecha_inicio > '${hoy}'::date)
    ORDER BY (mm.estado = 'ACTIVO' AND mm.fecha_inicio <= '${hoy}'::date AND mm.fecha_fin > '${hoy}'::date) DESC,
             mm.fecha_fin DESC
    LIMIT 1
  ) m ON u.tipo_actor = 'SOCIO'
  WHERE u.tipo_actor IN ('SOCIO', 'EXTERNO')
  UNION ALL
  SELECT i.id, 'INSTRUCTOR'::text, i.nombre, NULL::text, NULL::text, NULL::text,
         i.telefono, i.activo, NULL::uuid, NULL::text, NULL::text, NULL::text
  FROM instructores i
`;
}

export function armarConsultaClientes(query: ClientesQueryDto): {
  where: string;
  params: unknown[];
} {
  const condiciones: string[] = [];
  const params: unknown[] = [];
  const texto = (query.q ?? '').trim();
  if (texto) {
    params.push(`%${escaparLike(texto)}%`);
    const p = `$${params.length}`;
    condiciones.push(
      `(c.nombre ILIKE ${p} OR c.apellido ILIKE ${p} OR c.dni ILIKE ${p} OR c.email ILIKE ${p} ` +
        `OR (c.nombre || ' ' || COALESCE(c.apellido, '')) ILIKE ${p})`,
    );
  }
  if (query.tipo) {
    params.push(query.tipo);
    condiciones.push(`c.tipo = $${params.length}`);
  }
  if (query.estado) {
    condiciones.push(query.estado === 'ACTIVO' ? 'c.activo' : 'NOT c.activo');
  }
  return {
    where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '',
    params,
  };
}

// Activos primero, luego apellido y nombre (en instructores, que no tienen
// apellido, se ordena por nombre); `id` desempata para que la paginación sea estable.
export const ORDEN_CLIENTES = `ORDER BY c.activo DESC, lower(COALESCE(c.apellido, c.nombre)), lower(c.nombre), c.id`;

interface FilaCliente {
  id: string;
  tipo: ClienteAfiliado['tipo'];
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  telefono: string | null;
  activo: boolean;
  sede_id: string | null;
  sede_nombre: string | null;
  plan: string | null;
  vencimiento: string | null;
}

@Injectable()
export class ClientesService {
  constructor(private readonly dataSource: DataSource) {}

  async listar(
    query: ClientesQueryDto,
  ): Promise<PaginatedResponse<ClienteAfiliado>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { where, params } = armarConsultaClientes(query);
    const BASE = baseClientes(hoyArgentina());

    const [{ total }] = await this.dataSource.query<{ total: string }[]>(
      `SELECT COUNT(*)::text AS total FROM (${BASE}) c ${where}`,
      params,
    );
    const filas = await this.dataSource.query<FilaCliente[]>(
      `SELECT c.* FROM (${BASE}) c ${where} ${ORDEN_CLIENTES} ` +
        `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit],
    );

    const totalNum = Number(total);
    return {
      data: filas.map((f) => ({
        id: f.id,
        tipo: f.tipo,
        nombre: f.nombre,
        apellido: f.apellido,
        dni: f.dni,
        email: f.email,
        telefono: f.telefono,
        activo: f.activo,
        sede: f.sede_id ? { id: f.sede_id, nombre: f.sede_nombre ?? '' } : null,
        membresia:
          f.plan && f.vencimiento
            ? { plan: f.plan, vencimiento: f.vencimiento }
            : null,
      })),
      total: totalNum,
      page,
      limit,
      totalPages: Math.ceil(totalNum / limit) || 1,
    };
  }
}
