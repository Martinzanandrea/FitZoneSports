import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Clase,
  ClaseHorarioSemanal,
  ClaseOcurrencia,
  Sede,
  Instructor,
} from '../entities';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';
import { TipoActor } from '../entities/enums';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { RepartoHorasService } from './reparto-horas.service';
import { GeneracionOcurrenciasService } from './generacion-ocurrencias.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { paginarQueryBuilder } from '../common/helpers/paginate.helper';

@Injectable()
export class ClasesService {
  constructor(
    @InjectRepository(Clase)
    private readonly clasesRepo: Repository<Clase>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    @InjectRepository(Instructor)
    private readonly instructoresRepo: Repository<Instructor>,
    @InjectRepository(ClaseOcurrencia)
    private readonly ocurrenciasRepo: Repository<ClaseOcurrencia>,
    private readonly dataSource: DataSource,
    private readonly reparto: RepartoHorasService,
    private readonly generacion: GeneracionOcurrenciasService,
  ) {}

  // El array horarios es la propuesta YA confirmada por el Gerente.
  // Igual se revalida todo acá (defensa server-side, no se confía en el frontend).
  async create(dto: CreateClaseDto): Promise<Clase> {
    const sede = await this.sedesRepo.findOne({ where: { id: dto.sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${dto.sedeId} no encontrada`);

    const instructor = await this.instructoresRepo.findOne({
      where: { id: dto.instructorId },
    });
    if (!instructor)
      throw new NotFoundException(
        `Instructor ${dto.instructorId} no encontrado`,
      );

    const conflictos = await this.reparto.validarHuecosLibres(
      dto.sedeId,
      dto.horarios,
    );
    // Chequeo interno: los renglones de la propuesta tampoco pueden
    // solaparse entre sí.
    for (let i = 0; i < dto.horarios.length; i++) {
      for (let j = i + 1; j < dto.horarios.length; j++) {
        const a = dto.horarios[i];
        const b = dto.horarios[j];
        if (
          a.diaSemana === b.diaSemana &&
          a.horaInicio < b.horaFin &&
          b.horaInicio < a.horaFin
        ) {
          conflictos.push(
            `Día ${a.diaSemana}: los horarios ${a.horaInicio}-${a.horaFin} y ${b.horaInicio}-${b.horaFin} se superponen entre sí`,
          );
        }
      }
    }
    if (conflictos.length > 0) {
      throw new ConflictException(conflictos);
    }

    const claseId = await this.dataSource.transaction(async (manager) => {
      const clase = await manager.save(
        manager.create(Clase, {
          sede,
          instructor,
          tipoClase: dto.tipoClase,
          capacidad: dto.capacidad,
          horasSemanalesTotales: String(dto.horasSemanalesTotales),
        }),
      );
      await manager.save(
        dto.horarios.map((h) =>
          manager.create(ClaseHorarioSemanal, {
            clase,
            diaSemana: h.diaSemana,
            horaInicio: h.horaInicio,
            horaFin: h.horaFin,
          }),
        ),
      );
      return clase.id;
    });

    // Genera las próximas 4 semanas para que se pueda reservar ya mismo.
    await this.generacion.generarParaClase(claseId);
    return this.findOne(claseId);
  }

  async findAll(sedeId?: string, query?: PaginationQueryDto): Promise<PaginatedResponse<Clase>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const [data, total] = await this.clasesRepo.findAndCount({
      where: sedeId ? { sede: { id: sedeId } } : {},
      relations: { sede: true, instructor: true, horariosSemanales: true },
      order: { tipoClase: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  async findOne(id: string): Promise<Clase> {
    const clase = await this.clasesRepo.findOne({
      where: { id },
      relations: { sede: true, instructor: true, horariosSemanales: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${id} no encontrada`);
    return clase;
  }

  async update(id: string, dto: UpdateClaseDto): Promise<Clase> {
    const clase = await this.findOne(id);
    if (dto.tipoClase !== undefined) clase.tipoClase = dto.tipoClase;
    if (dto.capacidad !== undefined) clase.capacidad = dto.capacidad;
    if (dto.instructorId !== undefined) {
      const instructor = await this.instructoresRepo.findOne({
        where: { id: dto.instructorId },
      });
      if (!instructor)
        throw new NotFoundException(
          `Instructor ${dto.instructorId} no encontrado`,
        );
      clase.instructor = instructor;
    }
    return this.clasesRepo.save(clase);
  }

  // Baja lógica: no borra nada, lo ya generado y reservado queda intacto
  // (mismo criterio que RF-12 con canchas). El cron solo genera para activas.
  async desactivar(id: string): Promise<Clase> {
    const clase = await this.findOne(id);
    clase.activa = false;
    return this.clasesRepo.save(clase);
  }

  async listarOcurrencias(
    id: string,
    desde?: string,
    hasta?: string,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<ClaseOcurrencia>> {
    await this.findOne(id);
    for (const fecha of [desde, hasta]) {
      if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        throw new BadRequestException(
          'Los filtros desde/hasta deben tener formato YYYY-MM-DD',
        );
      }
    }
    const qb = this.ocurrenciasRepo
      .createQueryBuilder('ocurrencia')
      .innerJoin('ocurrencia.clase', 'clase')
      .where('clase.id = :id', { id })
      .orderBy('ocurrencia.fecha', 'ASC')
      .addOrderBy('ocurrencia.horaInicio', 'ASC');
    if (desde) qb.andWhere('ocurrencia.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('ocurrencia.fecha <= :hasta', { hasta });
    return paginarQueryBuilder(qb, query?.page ?? 1, query?.limit ?? 20);
  }

  // Acción acotada, distinta de update(): el Recepcionista puede
  // reasignar el instructor de una clase de SU sede sin poder tocar
  // capacidad ni tipo (eso sigue siendo exclusivo de Gerente).
  async asignarInstructor(
    claseId: string,
    instructorId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<Clase> {
    const clase = await this.clasesRepo.findOne({
      where: { id: claseId },
      relations: { sede: true, instructor: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${claseId} no encontrada`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.RECEPCIONISTA) {
      assertSedeScope(currentUser, clase.sede.id);
    }

    const instructor = await this.instructoresRepo.findOne({
      where: { id: instructorId },
    });
    if (!instructor)
      throw new NotFoundException(`Instructor ${instructorId} no encontrado`);

    clase.instructor = instructor;
    return this.clasesRepo.save(clase);
  }
}
