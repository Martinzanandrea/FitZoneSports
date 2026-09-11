import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { PaginatedResponse } from '../types/paginated-response.type';

export function paginarArray<T>(
  items: T[],
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const total = items.length;
  const start = (page - 1) * limit;
  return {
    data: items.slice(start, start + limit),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

// Para usar con QueryBuilder de TypeORM (más eficiente, pagina en la
// base en vez de traer todo a memoria):
export async function paginarQueryBuilder<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  page: number,
  limit: number,
): Promise<PaginatedResponse<T>> {
  const [data, total] = await qb
    .skip((page - 1) * limit)
    .take(limit)
    .getManyAndCount();
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
