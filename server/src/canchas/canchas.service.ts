import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Cancha,
  Pago,
  Sede,
  BloqueoCancha,
  ReservaCancha,
  TipoCancha,
} from '../entities';
import { EstadoCancha, EstadoPago, TipoActor } from '../entities/enums';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
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
    private readonly dataSource: DataSource,
  ) {}

  // Scope por exclusión: si NO es GG, se fuerza sedeId = su propia sede y
  // se rechaza con 403 si manda otra. Sin sedeId -> 403 (fail-closed).
  async create(dto: CreateCanchaDto, currentUser?: UsuarioAutenticado): Promise<Cancha> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!currentUser.sedeId) {
        throw new ForbiddenException('No tenés sede asignada');
      }
      if (dto.sedeId !== currentUser.sedeId) {
        throw new ForbiddenException('No tenés permisos sobre esta sede');
      }
      dto.sedeId = currentUser.sedeId;
    }
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

  // El filtro por sede se aplica SOLO cuando quien llama es GERENTE_SEDE.
  // Socios, externos, recepcionistas y GG ven lo mismo que antes (lo usan
  // la reserva de canchas y los selectores). Un GS sin sedeId ve vacío.
  async findAll(
    query: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Cancha>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser?.tipoActor === TipoActor.GERENTE_SEDE) {
      if (!currentUser.sedeId) {
        return { data: [], total: 0, page, limit, totalPages: 1 };
      }
      const [data, total] = await this.canchasRepo.findAndCount({
        where: { sede: { id: currentUser.sedeId } },
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

  // Scope contra la sede ACTUAL del recurso. UpdateCanchaDto acepta
  // sedeId (vía PartialType de CreateCanchaDto): un no-GG no puede
  // cambiarlo (403); solo GG puede mover una cancha de sede.
  async update(
    id: string,
    dto: UpdateCanchaDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Cancha> {
    const cancha = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, cancha.sede.id);
      if (dto.sedeId !== undefined && dto.sedeId !== cancha.sede.id) {
        throw new ForbiddenException(
          'Solo GERENTE_GENERAL puede cambiar la sede de una cancha',
        );
      }
    }
    const { costoHoraBase, tipoId, sedeId, ...resto } = dto;
    Object.assign(cancha, resto);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (sedeId !== undefined && currentUser?.tipoActor === TipoActor.GERENTE_GENERAL) {
      const nuevaSede = await this.sedesRepo.findOne({ where: { id: sedeId } });
      if (!nuevaSede)
        throw new NotFoundException(`Sede ${sedeId} no encontrada`);
      cancha.sede = nuevaSede;
    }
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
    currentUser?: UsuarioAutenticado,
  ): Promise<BloqueoCancha> {
    const cancha = await this.findOne(canchaId);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, cancha.sede.id);
    }
    const bloqueo = this.bloqueosRepo.create({
      cancha,
      desde: new Date(dto.desde),
      hasta: new Date(dto.hasta),
      motivo: dto.motivo,
    });
    return this.bloqueosRepo.save(bloqueo);
  }

  // Borrado real solo si la cancha no tiene reservas en ningún estado
  // (incluidas CANCELADAs: cuentan como historial). Conteo y borrado en
  // la misma transacción; si la FK de reservas_cancha rechaza (23503,
  // p. ej. por una reserva creada en una race), se devuelve el mismo 400
  // con el conteo en vez de un 500. 404 si no existe.
  async eliminar(id: string, currentUser: UsuarioAutenticado): Promise<void> {
    let historial = 0;
    try {
      await this.dataSource.transaction(async (manager) => {
        const cancha = await manager.findOne(Cancha, {
          where: { id },
          relations: { sede: true },
        });
        if (!cancha) throw new NotFoundException(`Cancha ${id} no encontrada`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        if (currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
          assertSedeScope(currentUser, cancha.sede.id);
        }
        historial = await manager.count(ReservaCancha, {
          where: { cancha: { id } },
        });
        if (historial > 0) {
          throw new BadRequestException(
            `No se puede eliminar: la cancha tiene ${historial} reserva(s) en su historial. Ponela en mantenimiento en su lugar.`,
          );
        }
        await manager.delete(BloqueoCancha, { cancha: { id } });
        await manager.remove(cancha);
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      // Violación de FK (reservas_cancha_cancha_id_fkey): una reserva
      // apareció entre el conteo y el borrado. Mismo 400, no 500.
      const code = (error as { code?: string })?.code;
      if (code === '23503') {
        throw new BadRequestException(
          `No se puede eliminar: la cancha tiene ${historial} reserva(s) en su historial. Ponela en mantenimiento en su lugar.`,
        );
      }
      throw error;
    }
  }

  // Suma de pagos APROBADO del mes actual ligados a reservas de cancha
  // (mismo criterio que el reporte financiero: sin pago real no cuenta).
  // Scope por exclusión: si NO es GG, solo su sede. Sin sedeId -> 403
  // (fail-closed). RECEPCIONISTA ya no accede (se saca del endpoint).
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
    if (currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!currentUser.sedeId) {
        throw new ForbiddenException('No tenés sede asignada');
      }
      qb.andWhere('sede.id = :sedeId', { sedeId: currentUser.sedeId });
    }

    const raw = await qb.getRawOne<{ total: string }>();
    return { total: Number(raw?.total ?? 0) };
  }
}
