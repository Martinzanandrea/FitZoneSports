import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
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

export interface ResumenClasePublica {
  tipoClase: string;
  sedesQueOfrecen: number;
  horasSemanalesTotales: number;
}
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { paginarQueryBuilder } from '../common/helpers/paginate.helper';

@Injectable()
export class ClasesService {
  private readonly logger = new Logger(ClasesService.name);

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
  // Scope por exclusión: si NO es GG, solo la sedeId del body == su sede.
  async create(
    dto: CreateClaseDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase & { ocurrenciasGeneradas: boolean }> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, dto.sedeId);
    }
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
    // Si la generación falla, la clase YA quedó guardada: se loguea y
    // se devuelve igual con ocurrenciasGeneradas:false (el cliente NO
    // debe reintentar el POST, duplicaría la clase; usa el endpoint
    // POST /clases/:id/generar-ocurrencias para completar).
    let ocurrenciasGeneradas = true;
    try {
      const generadas = await this.generacion.generarParaClase(claseId);
      if (generadas === 0) {
        this.logger.warn(
          `generarParaClase devolvió 0 ocurrencias para la clase ${claseId}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Fallo generarParaClase para la clase ${claseId}`,
        err instanceof Error ? err.stack : String(err),
      );
      ocurrenciasGeneradas = false;
    }
    const clase = await this.findOne(claseId);
    return { ...clase, ocurrenciasGeneradas };
  }

  // Regeneración idempotente (reutiliza generarParaClase, que saltea las
  // ya existentes): completa una clase cuya generación inicial falló.
  async generarOcurrencias(
    id: string,
    currentUser: UsuarioAutenticado,
  ): Promise<{ claseId: string; ocurrenciasGeneradas: number }> {
    const clase = await this.clasesRepo.findOne({
      where: { id },
      relations: { sede: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${id} no encontrada`);
    assertSedeScope(currentUser, clase.sede.id);
    const generadas = await this.generacion.generarParaClase(id);
    return { claseId: id, ocurrenciasGeneradas: generadas };
  }

  // Resumen público para la landing: por cada tipo de clase activa,
  // cuántas sedes lo ofrecen y la carga horaria total. Agregado a
  // propósito: el detalle (horarios/instructores) sigue siendo logueado.
  async resumenPublico(): Promise<ResumenClasePublica[]> {
    const clases = await this.clasesRepo.find({
      where: { activa: true },
      relations: { sede: true },
    });
    const mapa = new Map<string, { sedes: Set<string>; horas: number }>();
    for (const c of clases) {
      const actual = mapa.get(c.tipoClase) ?? { sedes: new Set<string>(), horas: 0 };
      actual.sedes.add(c.sede.id);
      actual.horas += Number(c.horasSemanalesTotales);
      mapa.set(c.tipoClase, actual);
    }
    return [...mapa.entries()]
      .map(([tipoClase, v]) => ({
        tipoClase,
        sedesQueOfrecen: v.sedes.size,
        horasSemanalesTotales: Math.round(v.horas * 10) / 10,
      }))
      .sort((a, b) => a.tipoClase.localeCompare(b.tipoClase));
  }

  // El filtro por sede se aplica SOLO cuando quien llama es GERENTE_SEDE
  // (se fuerza su sede, ignorando el query). Socios, externos,
  // recepcionistas y GG ven lo mismo que antes. Un GS sin sedeId ve vacío.
  async findAll(
    sedeId?: string,
    query?: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Clase>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser?.tipoActor === TipoActor.GERENTE_SEDE) {
      if (!currentUser.sedeId) {
        return { data: [], total: 0, page, limit, totalPages: 1 };
      }
      sedeId = currentUser.sedeId;
    }
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

  // Scope contra la sede ACTUAL del recurso. UpdateClaseDto NO acepta
  // sedeId (solo tipoClase/instructorId/capacidad), así que no hay cambio
  // de sede que bloquear: solo se valida el scope.
  async update(
    id: string,
    dto: UpdateClaseDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase> {
    const clase = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, clase.sede.id);
    }
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
  async desactivar(id: string, currentUser?: UsuarioAutenticado): Promise<Clase> {
    const clase = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, clase.sede.id);
    }
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

  // Acción acotada, distinta de update(): GG y GS con scope a la sede de
  // la clase. RECEPCIONISTA ya no accede.
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
    if (currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
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
