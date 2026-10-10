import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  Cancha,
  Pago,
  Sede,
  BloqueoCancha,
  ReservaCancha,
  TipoCancha,
} from '../entities';
import {
  EstadoCancha,
  EstadoPago,
  EstadoResCancha,
  TipoActor,
} from '../entities/enums';
import {
  ahoraArgentina,
  fechaCorta,
  terminaDespuesDe,
} from '../common/helpers/hora-argentina.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

export interface ReservasFuturas {
  cantidad: number;
  fechas: string[]; // YYYY-MM-DD, únicas y ordenadas
}

// Aviso informativo (no bloqueante) al pasar una cancha a mantenimiento.
export interface AvisoMantenimiento {
  cantidad: number;
  fechas: string[];
  mensaje: string;
}

export type CanchaActualizada = Cancha & { aviso?: AvisoMantenimiento };

const MAX_FECHAS_EN_MENSAJE = 5;

function textoFechas(fechas: string[]): string {
  const visibles = fechas.slice(0, MAX_FECHAS_EN_MENSAJE).map(fechaCorta);
  const resto = fechas.length - visibles.length;
  return resto > 0
    ? `${visibles.join(', ')} y ${resto} más`
    : visibles.join(', ');
}

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

function mensajeNoEliminable(
  historial: number,
  futuras: ReservasFuturas,
): string {
  if (futuras.cantidad > 0) {
    return (
      `No se puede eliminar: la cancha tiene ${futuras.cantidad} reserva(s) confirmada(s) ` +
      `por cumplirse (${textoFechas(futuras.fechas)}). Ponela en mantenimiento: ` +
      `se respetan las reservas ya tomadas y no se ofrecen turnos nuevos.`
    );
  }
  return (
    `No se puede eliminar: la cancha no tiene reservas por cumplirse, pero conserva ` +
    `${historial} reserva(s) en su historial (ya cumplidas o canceladas). ` +
    `Ponela en mantenimiento en su lugar.`
  );
}

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
    @InjectRepository(ReservaCancha)
    private readonly reservasRepo: Repository<ReservaCancha>,
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
    // Socios y Externos no ven canchas en mantenimiento como opción reservable.
    const soloActivas =
      currentUser?.tipoActor === TipoActor.SOCIO ||
      currentUser?.tipoActor === TipoActor.EXTERNO;
    const [data, total] = await this.canchasRepo.findAndCount({
      where: soloActivas ? { estado: EstadoCancha.ACTIVA } : {},
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

  // Lectura para el controlador: el Gerente de Sede solo ve canchas de su sede
  // (igual que su listado). Socios y Externos ven el catálogo completo.
  async findOneVisible(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<Cancha> {
    const cancha = await this.findOne(id);
    if (currentUser?.tipoActor === TipoActor.GERENTE_SEDE) {
      assertSedeScope(currentUser, cancha.sede.id);
    }
    return cancha;
  }

  // Scope contra la sede ACTUAL del recurso. UpdateCanchaDto acepta
  // sedeId (vía PartialType de CreateCanchaDto): un no-GG no puede
  // cambiarlo (403); solo GG puede mover una cancha de sede.
  async update(
    id: string,
    dto: UpdateCanchaDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<CanchaActualizada> {
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
    const guardada: CanchaActualizada = await this.canchasRepo.save(cancha);
    // Pasar a mantenimiento NO se bloquea ni toca las reservas ya tomadas:
    // solo se avisa cuántas siguen vigentes (informativo).
    if (dto.estado === EstadoCancha.MANTENIMIENTO) {
      const futuras = await this.reservasFuturasActivas(id);
      if (futuras.cantidad > 0) {
        guardada.aviso = {
          ...futuras,
          mensaje:
            `La cancha pasó a mantenimiento. Ya no se ofrecerá para nuevas reservas, ` +
            `pero se respetan ${futuras.cantidad} reserva(s) confirmada(s) por cumplirse ` +
            `(${textoFechas(futuras.fechas)}). No se modificó ninguna.`,
        };
      }
    }
    return guardada;
  }

  // Reservas CONFIRMADA de la cancha cuyo horario de fin es posterior a
  // "ahora" en hora de Argentina. CANCELADA y las ya terminadas no cuentan.
  async reservasFuturasActivas(
    canchaId: string,
    manager?: EntityManager,
  ): Promise<ReservasFuturas> {
    const ahora = ahoraArgentina();
    const repo = manager
      ? manager.getRepository(ReservaCancha)
      : this.reservasRepo;
    const candidatas = await repo.find({
      where: {
        cancha: { id: canchaId },
        estado: EstadoResCancha.CONFIRMADA,
        fecha: MoreThanOrEqual(ahora.fecha),
      },
      select: { id: true, fecha: true, horaFin: true },
    });
    const vigentes = candidatas.filter((r) =>
      terminaDespuesDe(r.fecha, r.horaFin, ahora),
    );
    const fechas = [...new Set(vigentes.map((r) => r.fecha))].sort();
    return { cantidad: vigentes.length, fechas };
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
          const futuras = await this.reservasFuturasActivas(id, manager);
          throw new BadRequestException(
            mensajeNoEliminable(historial, futuras),
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
          mensajeNoEliminable(historial, { cantidad: 0, fechas: [] }),
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
