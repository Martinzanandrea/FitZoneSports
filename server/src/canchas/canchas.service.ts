import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancha, Pago, Sede, BloqueoCancha, TipoCancha } from '../entities';
import { EstadoCancha, EstadoPago, TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

export interface CanchaPublica {
  sede: string;
  tipo: { nombre: string; imagenUrl: string | null };
  costoHoraBase: string;
}
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { CreateCanchaDto } from './dto/create-cancha.dto';
import { UpdateCanchaDto } from './dto/update-cancha.dto';
import { CreateBloqueoDto } from './dto/create-bloqueo.dto';

@Injectable()
export class CanchasService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchasRepo: Repository<Cancha>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    @InjectRepository(BloqueoCancha)
    private readonly bloqueosRepo: Repository<BloqueoCancha>,
    @InjectRepository(TipoCancha)
    private readonly tiposRepo: Repository<TipoCancha>,
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
  ) {}

  async create(dto: CreateCanchaDto): Promise<Cancha> {
    const sede = await this.sedesRepo.findOne({ where: { id: dto.sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${dto.sedeId} no encontrada`);

    const tipo = await this.tiposRepo.findOne({ where: { id: dto.tipoId } });
    if (!tipo) throw new NotFoundException(`Tipo de cancha ${dto.tipoId} no encontrado`);

    const cancha = this.canchasRepo.create({
      sede,
      nombre: dto.nombre,
      tipo,
      costoHoraBase: String(dto.costoHoraBase),
    });
    return this.canchasRepo.save(cancha);
  }

  // Catálogo público para la landing: solo canchas activas, sin
  // disponibilidad ni reservas (eso sigue siendo solo para logueados).
  async findAllPublico(): Promise<CanchaPublica[]> {
    const canchas = await this.canchasRepo.find({
      where: { estado: EstadoCancha.ACTIVA },
      relations: { sede: true, tipo: true },
      order: { sede: { nombre: 'ASC' } },
    });
    return canchas.map((c) => ({
      sede: c.sede.nombre,
      tipo: { nombre: c.tipo.nombre, imagenUrl: c.tipo.imagenUrl },
      costoHoraBase: c.costoHoraBase,
    }));
  }

  async findAll(query: PaginationQueryDto): Promise<PaginatedResponse<Cancha>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.canchasRepo.findAndCount({
      relations: { sede: true, tipo: true },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Cancha> {
    const cancha = await this.canchasRepo.findOne({
      where: { id },
      relations: { sede: true, tipo: true },
    });
    if (!cancha) throw new NotFoundException(`Cancha ${id} no encontrada`);
    return cancha;
  }

  async update(id: string, dto: UpdateCanchaDto): Promise<Cancha> {
    const cancha = await this.findOne(id);
    const { costoHoraBase, tipoId, ...resto } = dto;
    Object.assign(cancha, resto);
    if (tipoId !== undefined) {
      const tipo = await this.tiposRepo.findOne({ where: { id: tipoId } });
      if (!tipo) throw new NotFoundException(`Tipo de cancha ${tipoId} no encontrado`);
      cancha.tipo = tipo;
    }
    if (costoHoraBase !== undefined)
      cancha.costoHoraBase = String(costoHoraBase);
    return this.canchasRepo.save(cancha);
  }

  async crearBloqueo(
    canchaId: string,
    dto: CreateBloqueoDto,
  ): Promise<BloqueoCancha> {
    const cancha = await this.findOne(canchaId);
    const bloqueo = this.bloqueosRepo.create({
      cancha,
      desde: new Date(dto.desde),
      hasta: new Date(dto.hasta),
      motivo: dto.motivo,
    });
    return this.bloqueosRepo.save(bloqueo);
  }

  // Suma de pagos APROBADO del mes actual ligados a reservas de cancha
  // (mismo criterio que el reporte financiero: sin pago real no cuenta).
  // Recepcionista ve solo su sede; Gerente, todas.
  async obtenerIngresosMes(
    currentUser: UsuarioAutenticado,
  ): Promise<{ total: number }> {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const qb = this.pagosRepo
      .createQueryBuilder('pago')
      .innerJoin('pago.reservaCancha', 'reservaCancha')
      .innerJoin('reservaCancha.cancha', 'cancha')
      .innerJoin('cancha.sede', 'sede')
      .where('pago.estado = :estado', { estado: EstadoPago.APROBADO })
      .andWhere('pago.pagado_en >= :inicioMes', { inicioMes })
      .select('COALESCE(SUM(pago.monto), 0)', 'total');

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.RECEPCIONISTA) {
      qb.andWhere('sede.id = :sedeId', { sedeId: currentUser.sedeId });
    }

    const raw = await qb.getRawOne<{ total: string }>();
    return { total: Number(raw?.total ?? 0) };
  }
}
