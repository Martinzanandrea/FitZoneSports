import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  Clase,
  ClaseHorarioSemanal,
  ClaseOcurrencia,
  ReservaClase,
  Sede,
  Instructor,
} from '../entities';
import { CreateClaseDto } from './dto/create-clase.dto';
import { UpdateClaseDto } from './dto/update-clase.dto';
import {
  EstadoOcurrenciaClase,
  EstadoResClase,
  TipoActor,
} from '../entities/enums';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { RepartoHorasService } from './reparto-horas.service';
import { GeneracionOcurrenciasService } from './generacion-ocurrencias.service';
import {
  ahoraArgentina,
  type AhoraArgentina,
} from '../common/helpers/hora-argentina.helper';
import {
  CLASE_DADA_DE_BAJA,
  type ClaseDadaDeBajaPayload,
} from './events/clase.events';

export interface ResumenClasePublica {
  tipoClase: string;
  sedesQueOfrecen: number;
  horasSemanalesTotales: number;
}

export interface ResumenBaja {
  ocurrenciasCanceladas: number;
  reservasCanceladas: number;
  sociosAfectados: number;
}

export interface ImpactoBaja {
  ocurrenciasFuturas: number;
  reservasFuturas: number;
  sociosAfectados: number;
}
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { paginarQueryBuilder } from '../common/helpers/paginate.helper';

// Lo que ven Socios y Externos: sin la sede completa (dirección, aforo...) ni el
// instructor completo (teléfono, estado). Solo lo necesario para elegir y reservar.
export interface ClaseVistaCliente {
  id: string;
  tipoClase: string;
  capacidad: number;
  horasSemanalesTotales: string;
  activa: boolean;
  sede: { id: string; nombre: string };
  instructor: { id: string; nombre: string; especialidad: string | null };
  horariosSemanales: Array<{
    id: string;
    diaSemana: number;
    horaInicio: string;
    horaFin: string;
  }>;
}

export interface OcurrenciaVistaCliente {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoOcurrenciaClase;
  cupoOcupado?: number;
}

function esCliente(user?: UsuarioAutenticado): boolean {
  return (
    user?.tipoActor === TipoActor.SOCIO ||
    user?.tipoActor === TipoActor.EXTERNO
  );
}

function vistaCliente(c: Clase): ClaseVistaCliente {
  return {
    id: c.id,
    tipoClase: c.tipoClase,
    capacidad: c.capacidad,
    horasSemanalesTotales: c.horasSemanalesTotales,
    activa: c.activa,
    sede: { id: c.sede.id, nombre: c.sede.nombre },
    instructor: {
      id: c.instructor.id,
      nombre: c.instructor.nombre,
      especialidad: c.instructor.especialidad ?? null,
    },
    horariosSemanales: (c.horariosSemanales ?? []).map((h) => ({
      id: h.id,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
    })),
  };
}

function esGerente(user?: UsuarioAutenticado): boolean {
  return (
    user?.tipoActor === TipoActor.GERENTE_GENERAL ||
    user?.tipoActor === TipoActor.GERENTE_SEDE
  );
}

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
    private readonly eventEmitter: EventEmitter2,
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
    if (!clase.activa) {
      throw new BadRequestException(
        'La clase está dada de baja: reactivala para generar sus fechas',
      );
    }
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
      const actual = mapa.get(c.tipoClase) ?? {
        sedes: new Set<string>(),
        horas: 0,
      };
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

  // Conteo de clases ACTIVAS por tipo para la pantalla de configuración. Lo
  // calcula la base (no el cliente sobre una página). El GS queda acotado a su sede.
  async resumenPorTipo(
    sedeId: string | undefined,
    currentUser: UsuarioAutenticado,
  ): Promise<Array<{ tipoClase: string; activas: number }>> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.GERENTE_SEDE) {
      if (!currentUser.sedeId) return [];
      sedeId = currentUser.sedeId;
    }
    const qb = this.clasesRepo
      .createQueryBuilder('c')
      .select('c.tipo_clase', 'tipoClase')
      .addSelect('COUNT(*)', 'activas')
      .where('c.activa = true')
      .groupBy('c.tipo_clase')
      .orderBy('COUNT(*)', 'DESC')
      .addOrderBy('c.tipo_clase', 'ASC');
    if (sedeId) qb.andWhere('c.sede_id = :sedeId', { sedeId });
    const filas = await qb.getRawMany<{ tipoClase: string; activas: string }>();
    return filas.map((f) => ({
      tipoClase: f.tipoClase,
      activas: Number(f.activas),
    }));
  }

  // El filtro por sede se aplica SOLO cuando quien llama es GERENTE_SEDE
  // (se fuerza su sede, ignorando el query). Las clases dadas de baja las ven
  // solo los gerentes; para el resto (socios, externos, recepción) no existen.
  async findAll(
    sedeId?: string,
    query?: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
    activa?: boolean,
  ): Promise<PaginatedResponse<Clase | ClaseVistaCliente>> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    // El personal de sede (GS y Recepción) queda acotado a SU sede; sin sede
    // asignada no ve nada (fail-closed).
    if (
      currentUser?.tipoActor === TipoActor.GERENTE_SEDE ||
      currentUser?.tipoActor === TipoActor.RECEPCIONISTA
    ) {
      if (!currentUser.sedeId) {
        return { data: [], total: 0, page, limit, totalPages: 1 };
      }
      sedeId = currentUser.sedeId;
    }
    const soloActivas = !esGerente(currentUser);
    const where: Record<string, unknown> = {};
    if (sedeId) where.sede = { id: sedeId };
    if (soloActivas) where.activa = true;
    else if (activa !== undefined) where.activa = activa;
    const [data, total] = await this.clasesRepo.findAndCount({
      where,
      relations: { sede: true, instructor: true, horariosSemanales: true },
      order: { tipoClase: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: esCliente(currentUser) ? data.map(vistaCliente) : data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string): Promise<Clase> {
    const clase = await this.clasesRepo.findOne({
      where: { id },
      relations: { sede: true, instructor: true, horariosSemanales: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${id} no encontrada`);
    return clase;
  }

  // Lectura para el controlador: una clase dada de baja solo la ven los gerentes.
  async findOneVisible(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase | ClaseVistaCliente> {
    const clase = await this.leerVisible(id, currentUser);
    return esCliente(currentUser) ? vistaCliente(clase) : clase;
  }

  // Misma regla de visibilidad para el detalle y las ocurrencias: una clase de
  // baja solo la ven los gerentes, y el personal de sede solo las de su sede.
  private async leerVisible(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase> {
    const clase = await this.findOne(id);
    if (!clase.activa && !esGerente(currentUser)) {
      throw new NotFoundException(`Clase ${id} no encontrada`);
    }
    if (
      currentUser?.tipoActor === TipoActor.GERENTE_SEDE ||
      currentUser?.tipoActor === TipoActor.RECEPCIONISTA
    ) {
      assertSedeScope(currentUser, clase.sede.id);
    }
    return clase;
  }

  private async cargarConScope(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase> {
    const clase = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser && currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      assertSedeScope(currentUser, clase.sede.id);
    }
    return clase;
  }

  // ───────────── Ocurrencias futuras (hora de Argentina) ─────────────

  // Ocurrencias de la clase que todavía no empezaron, bloqueadas FOR UPDATE:
  // las reservas nuevas (que bloquean la misma fila) esperan a que termine
  // esta transacción y recién ahí ven el estado final.
  private bloquearOcurrenciasFuturas(
    manager: EntityManager,
    claseId: string,
    ahora: AhoraArgentina,
  ): Promise<ClaseOcurrencia[]> {
    return manager
      .createQueryBuilder(ClaseOcurrencia, 'oc')
      .setLock('pessimistic_write')
      .where('oc.clase_id = :claseId', { claseId })
      .andWhere(
        '(oc.fecha > :hoy OR (oc.fecha = :hoy AND oc.hora_inicio > :hora))',
        { hoy: ahora.fecha, hora: ahora.hora },
      )
      .getMany();
  }

  private async maxReservadas(
    manager: EntityManager,
    ocurrenciaIds: string[],
  ): Promise<number> {
    if (!ocurrenciaIds.length) return 0;
    const filas = await manager
      .createQueryBuilder(ReservaClase, 'r')
      .select('r.ocurrencia_id', 'ocurrenciaId')
      .addSelect('COUNT(*)', 'cupo')
      .where('r.ocurrencia_id IN (:...ids)', { ids: ocurrenciaIds })
      .andWhere('r.estado = :estado', { estado: EstadoResClase.RESERVADA })
      .groupBy('r.ocurrencia_id')
      .getRawMany<{ ocurrenciaId: string; cupo: string }>();
    return filas.reduce((max, f) => Math.max(max, Number(f.cupo)), 0);
  }

  // Scope contra la sede ACTUAL del recurso. UpdateClaseDto NO acepta
  // sedeId (solo tipoClase/instructorId/capacidad), así que no hay cambio
  // de sede que bloquear: solo se valida el scope. La capacidad no puede
  // quedar por debajo de las reservas confirmadas (RESERVADA) de la ocurrencia
  // futura más llena; la lista de espera no cuenta.
  async update(
    id: string,
    dto: UpdateClaseDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase> {
    const clase = await this.cargarConScope(id, currentUser);
    return this.dataSource.transaction(async (manager) => {
      if (dto.capacidad !== undefined) {
        const futuras = (
          await this.bloquearOcurrenciasFuturas(manager, id, ahoraArgentina())
        ).filter((o) => o.estado === EstadoOcurrenciaClase.PROGRAMADA);
        const maximo = await this.maxReservadas(
          manager,
          futuras.map((o) => o.id),
        );
        if (dto.capacidad < maximo) {
          throw new BadRequestException(
            `La capacidad no puede ser menor que las reservas ya confirmadas: una de las próximas clases tiene ${maximo} reserva(s)`,
          );
        }
        clase.capacidad = dto.capacidad;
      }
      if (dto.tipoClase !== undefined) clase.tipoClase = dto.tipoClase;
      if (dto.instructorId !== undefined) {
        clase.instructor = await this.instructorActivo(
          dto.instructorId,
          manager,
        );
      }
      return manager.save(clase);
    });
  }

  private async instructorActivo(
    id: string,
    manager?: EntityManager,
  ): Promise<Instructor> {
    const repo = manager
      ? manager.getRepository(Instructor)
      : this.instructoresRepo;
    const instructor = await repo.findOne({ where: { id } });
    if (!instructor)
      throw new NotFoundException(`Instructor ${id} no encontrado`);
    if (!instructor.activo) {
      throw new BadRequestException('El instructor está dado de baja');
    }
    return instructor;
  }

  // Cuánto se cancelaría con la baja: para la confirmación explícita en pantalla.
  async impactoBaja(
    id: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ImpactoBaja> {
    await this.cargarConScope(id, currentUser);
    const ahora = ahoraArgentina();
    const fila = await this.ocurrenciasRepo
      .createQueryBuilder('oc')
      .leftJoin('oc.reservas', 'r', 'r.estado IN (:...estados)', {
        estados: [EstadoResClase.RESERVADA, EstadoResClase.LISTA_ESPERA],
      })
      .select('COUNT(DISTINCT oc.id)', 'ocurrencias')
      .addSelect('COUNT(r.id)', 'reservas')
      .addSelect('COUNT(DISTINCT r.usuario_id)', 'socios')
      .where('oc.clase_id = :id', { id })
      .andWhere('oc.estado = :programada', {
        programada: EstadoOcurrenciaClase.PROGRAMADA,
      })
      .andWhere(
        '(oc.fecha > :hoy OR (oc.fecha = :hoy AND oc.hora_inicio > :hora))',
        { hoy: ahora.fecha, hora: ahora.hora },
      )
      .getRawOne<{ ocurrencias: string; reservas: string; socios: string }>();
    return {
      ocurrenciasFuturas: Number(fila?.ocurrencias ?? 0),
      reservasFuturas: Number(fila?.reservas ?? 0),
      sociosAfectados: Number(fila?.socios ?? 0),
    };
  }

  // Baja lógica (activa = false). En UNA transacción, con las filas bloqueadas
  // para que no entren reservas durante la baja: cancela las ocurrencias
  // futuras y pasa a CANCELADA las reservas RESERVADA y LISTA_ESPERA de esas
  // ocurrencias. No toca el pasado ni las asistencias. NO emite el evento de
  // cupo liberado: es una cancelación masiva, no hay a quién promover. El
  // aviso a los socios sale DESPUÉS del commit y su fallo no revierte nada.
  async desactivar(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<Clase & { resumenBaja: ResumenBaja }> {
    await this.cargarConScope(id, currentUser);
    const ahora = ahoraArgentina();

    const { resumen, payload } = await this.dataSource.transaction(
      async (manager) => {
        const clase = await manager
          .createQueryBuilder(Clase, 'c')
          .setLock('pessimistic_write')
          .where('c.id = :id', { id })
          .getOne();
        if (!clase) throw new NotFoundException(`Clase ${id} no encontrada`);
        if (!clase.activa) {
          throw new BadRequestException('La clase ya está dada de baja');
        }
        await manager.update(Clase, { id }, { activa: false });

        const futuras = (
          await this.bloquearOcurrenciasFuturas(manager, id, ahora)
        ).filter((o) => o.estado === EstadoOcurrenciaClase.PROGRAMADA);
        const ocurrenciaIds = futuras.map((o) => o.id);

        const reservas = ocurrenciaIds.length
          ? await manager.find(ReservaClase, {
              where: {
                ocurrencia: { id: In(ocurrenciaIds) },
                estado: In([
                  EstadoResClase.RESERVADA,
                  EstadoResClase.LISTA_ESPERA,
                ]),
              },
              relations: { usuario: true, ocurrencia: true },
              select: {
                id: true,
                usuario: { id: true },
                ocurrencia: { id: true },
              },
            })
          : [];

        if (ocurrenciaIds.length) {
          await manager.update(
            ClaseOcurrencia,
            { id: In(ocurrenciaIds) },
            { estado: EstadoOcurrenciaClase.CANCELADA },
          );
        }
        if (reservas.length) {
          await manager.update(
            ReservaClase,
            { id: In(reservas.map((r) => r.id)) },
            { estado: EstadoResClase.CANCELADA, canceladaEn: new Date() },
          );
        }

        const porOcurrencia = new Map(futuras.map((o) => [o.id, o]));
        const porSocio = new Map<
          string,
          ClaseDadaDeBajaPayload['afectados'][number]['ocurrencias']
        >();
        for (const r of reservas) {
          const o = porOcurrencia.get(r.ocurrencia.id);
          if (!o) continue;
          const lista = porSocio.get(r.usuario.id) ?? [];
          lista.push({
            fecha: o.fecha,
            horaInicio: o.horaInicio,
            horaFin: o.horaFin,
          });
          porSocio.set(r.usuario.id, lista);
        }
        return {
          resumen: {
            ocurrenciasCanceladas: ocurrenciaIds.length,
            reservasCanceladas: reservas.length,
            sociosAfectados: porSocio.size,
          },
          payload: {
            claseId: id,
            tipoClase: clase.tipoClase,
            afectados: [...porSocio.entries()].map(
              ([usuarioId, ocurrencias]) => ({ usuarioId, ocurrencias }),
            ),
          } satisfies ClaseDadaDeBajaPayload,
        };
      },
    );

    // Ya confirmada la baja: avisar. Un fallo acá nunca la revierte.
    try {
      this.eventEmitter.emit(CLASE_DADA_DE_BAJA, payload);
    } catch {
      this.logger.warn(`No se pudo emitir el aviso de baja de la clase ${id}`);
    }
    const clase = await this.findOne(id);
    return Object.assign(clase, { resumenBaja: resumen });
  }

  // Reactivar: vuelve a ofrecer la clase. Las reservas canceladas por la baja
  // NO se restauran (cada socio vuelve a reservar). Se reabren las fechas
  // futuras que la baja había cancelado y se generan las que falten con el
  // servicio de siempre. Antes se revalida que el horario siga libre: mientras
  // estuvo de baja otra clase pudo ocupar la sede.
  async reactivar(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<
    Clase & {
      ocurrenciasReabiertas: number;
      ocurrenciasGeneradas: number | null;
    }
  > {
    const previa = await this.cargarConScope(id, currentUser);
    if (previa.activa) {
      throw new BadRequestException('La clase ya está activa');
    }
    const conflictos = await this.reparto.validarHuecosLibres(
      previa.sede.id,
      previa.horariosSemanales.map((h) => ({
        diaSemana: h.diaSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
      })),
      id,
    );
    if (conflictos.length > 0) throw new ConflictException(conflictos);

    const ahora = ahoraArgentina();
    const reabiertas = await this.dataSource.transaction(async (manager) => {
      const clase = await manager
        .createQueryBuilder(Clase, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :id', { id })
        .getOne();
      if (!clase) throw new NotFoundException(`Clase ${id} no encontrada`);
      if (clase.activa) {
        throw new BadRequestException('La clase ya está activa');
      }
      await manager.update(Clase, { id }, { activa: true });
      const futuras = (
        await this.bloquearOcurrenciasFuturas(manager, id, ahora)
      ).filter((o) => o.estado === EstadoOcurrenciaClase.CANCELADA);
      if (futuras.length) {
        await manager.update(
          ClaseOcurrencia,
          { id: In(futuras.map((o) => o.id)) },
          { estado: EstadoOcurrenciaClase.PROGRAMADA },
        );
      }
      return futuras.length;
    });

    let generadas: number | null = null;
    try {
      generadas = await this.generacion.generarParaClase(id);
    } catch (err) {
      // La clase ya quedó activa; se completa con POST /clases/:id/generar-ocurrencias.
      this.logger.error(
        `Fallo generarParaClase al reactivar la clase ${id}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
    const clase = await this.findOne(id);
    return Object.assign(clase, {
      ocurrenciasReabiertas: reabiertas,
      ocurrenciasGeneradas: generadas,
    });
  }

  async listarOcurrencias(
    id: string,
    desde?: string,
    hasta?: string,
    query?: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<ClaseOcurrencia | OcurrenciaVistaCliente>> {
    await this.leerVisible(id, currentUser);
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
    // Las fechas canceladas solo las ven los gerentes.
    if (!esGerente(currentUser)) {
      qb.andWhere('ocurrencia.estado = :programada', {
        programada: EstadoOcurrenciaClase.PROGRAMADA,
      });
    }
    if (desde) qb.andWhere('ocurrencia.fecha >= :desde', { desde });
    if (hasta) qb.andWhere('ocurrencia.fecha <= :hasta', { hasta });
    const pagina = await paginarQueryBuilder(
      qb,
      query?.page ?? 1,
      query?.limit ?? 20,
    );
    // Cupo ocupado agregado (solo RESERVADA): el Socio calcula lugares sin
    // ver las reservas de otros usuarios.
    if (pagina.data.length > 0) {
      const filas = await this.ocurrenciasRepo.manager
        .createQueryBuilder(ReservaClase, 'r')
        .select('r.ocurrencia_id', 'ocurrenciaId')
        .addSelect('COUNT(*)', 'cupo')
        .where('r.ocurrencia_id IN (:...ids)', {
          ids: pagina.data.map((o) => o.id),
        })
        .andWhere('r.estado = :estado', { estado: EstadoResClase.RESERVADA })
        .groupBy('r.ocurrencia_id')
        .getRawMany<{ ocurrenciaId: string; cupo: string }>();
      const porId = new Map(filas.map((f) => [f.ocurrenciaId, Number(f.cupo)]));
      for (const o of pagina.data) o.cupoOcupado = porId.get(o.id) ?? 0;
    }
    if (esCliente(currentUser)) {
      return {
        ...pagina,
        data: pagina.data.map((o) => ({
          id: o.id,
          fecha: o.fecha,
          horaInicio: o.horaInicio,
          horaFin: o.horaFin,
          estado: o.estado,
          cupoOcupado: o.cupoOcupado,
        })),
      };
    }
    return pagina;
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

    clase.instructor = await this.instructorActivo(instructorId);
    return this.clasesRepo.save(clase);
  }
}
