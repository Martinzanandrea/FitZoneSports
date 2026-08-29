import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from '../entities';

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

  findAll(filtros: { entidad?: string; desde?: string; hasta?: string }) {
    const qb = this.auditoriaRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.actor', 'actor')
      .orderBy('a.creado_en', 'DESC')
      .limit(200);
    if (filtros.entidad) qb.andWhere('a.entidad = :entidad', { entidad: filtros.entidad });
    if (filtros.desde) qb.andWhere('a.creado_en >= :desde', { desde: filtros.desde });
    if (filtros.hasta) qb.andWhere('a.creado_en <= :hasta', { hasta: filtros.hasta });
    return qb.getMany();
  }
}
