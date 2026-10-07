import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../entities';
import { TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { paginarQueryBuilder } from '../common/helpers/paginate.helper';

interface RegistrarInput {
  actorId?: string;
  accion: string;
  entidad: string;
  entidadId?: string;
  detalle?: Record<string, unknown>;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);
  constructor(
    @InjectRepository(Auditoria)
    private readonly auditoriaRepo: Repository<Auditoria>,
  ) {}

  async registrar(input: RegistrarInput): Promise<void> {
    try {
      const registro = this.auditoriaRepo.create({
        actor: input.actorId ? ({ id: input.actorId } as any) : undefined,
        accion: input.accion,
        entidad: input.entidad,
        entidadId: input.entidadId,
        detalle: input.detalle,
      });
      await this.auditoriaRepo.save(registro);
    } catch (err) {
      this.logger.warn(`No se pudo registrar auditoría: ${err}`);
    }
  }

  findAll(
    filtros: { entidad?: string; desde?: string; hasta?: string },
    query: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Auditoria>> {
    const qb = this.auditoriaRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.actor', 'actor')
      .orderBy('a.creado_en', 'DESC');
    if (filtros.entidad) qb.andWhere('a.entidad = :entidad', { entidad: filtros.entidad });
    if (filtros.desde) qb.andWhere('a.creado_en >= :desde', { desde: filtros.desde });
    if (filtros.hasta) qb.andWhere('a.creado_en <= :hasta', { hasta: filtros.hasta });
    // La tabla no tiene sede propia: se filtra por la sede del actor.
    // Registros sin actor (sistema) no pertenecen a ninguna sede y GS no los ve.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!currentUser.sedeId) {
        throw new ForbiddenException('Tu usuario no tiene una sede asignada');
      }
      qb.leftJoin('actor.sede', 'sedeActor').andWhere('sedeActor.id = :sedeId', {
        sedeId: currentUser.sedeId,
      });
    }
    return paginarQueryBuilder(qb, query.page ?? 1, query.limit ?? 20);
  }
}
