import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Cancha,
  ClaseOcurrencia,
  EstadoResCancha,
  EstadoResClase,
  EstadoMembresia,
  EstadoPago,
  Membresia,
  Pago,
  Sede,
  ReservaCancha,
  ReservaClase,
} from '../entities';
import { EstadoOcurrenciaClase, TipoActor } from '../entities/enums';
import { esVigente, esProxima, estadoEfectivo, hoyArgentina, sqlVigente } from '../membresias/vigencia';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { paginarArray } from '../common/helpers/paginate.helper';

export interface DashboardResumen {
  clasesHoy: number;
  horasCanchasAgendadasHoy: number;
}

export interface ReservaClaseAdmin {
  id: string;
  clase: string;
  sede: string;
  usuario: string;
  fecha: string;
  horario: string;
  estado: EstadoResClase;
  ocupadas: number;
  capacidad: number;
}

export interface ReservaCanchaAdmin {
  id: string;
  cancha: string;
  sede: string;
  usuario: string;
  fecha: string;
  horario: string;
  estado: EstadoResCancha;
  precioFinal: string;
}

export interface ReservasAdmin {
  resumen: {
    canchasReservadas: number;
    clasesConOcupacionAlta: number;
  };
  clases: PaginatedResponse<ReservaClaseAdmin>;
  canchas: PaginatedResponse<ReservaCanchaAdmin>;
}

export interface ReporteFinanciero {
  ingresosHoy: number;
  ingresosMes: number;
  ingresosMesAnterior: number;
  porMetodo: Array<{ metodo: string; total: number }>;
  porSede: Array<{ sedeId: string; sede: string; total: number }>;
}

export interface MembresiaPorSede {
  sedeId: string;
  sede: string;
  /** Vigentes hoy (fecha_inicio <= hoy < fecha_fin). */
  activas: number;
  vencidas: number;
  suspendidas: number;
  /** Compradas que todavía no empezaron (próximas). */
  programadas: number;
  socios: Array<{
    usuarioId: string;
    nombre: string;
    dni: string | null;
    plan: string;
    estado: EstadoMembresia;
    fechaFin: string;
    fechaInicio: string;
    /** Vigente hoy. */
    vigente: boolean;
    /** Todavía no empezó. */
    proxima: boolean;
  }>;
}

export interface PlanPopularidad {
  plan: string;
  socios: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(ClaseOcurrencia)
    private readonly ocurrenciasRepo: Repository<ClaseOcurrencia>,
    @InjectRepository(Cancha)
    private readonly canchasRepo: Repository<Cancha>,
    @InjectRepository(ReservaClase)
    private readonly reservasClaseRepo: Repository<ReservaClase>,
    @InjectRepository(ReservaCancha)
    private readonly reservasCanchaRepo: Repository<ReservaCancha>,
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
  ) {}

  async obtenerDashboardResumen(
    currentUser: UsuarioAutenticado,
  ): Promise<DashboardResumen> {
    // Fail-closed: cualquiera que no sea GG ve solo su sede (nunca
    // el consolidado). Sin sede asignada el WHERE no matchea nada.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const filtrarPorSede = currentUser.tipoActor !== TipoActor.GERENTE_GENERAL;

    // Las "clases de hoy" son ocurrencias (instancias en una fecha), no la
    // plantilla Clase: se cuenta ClaseOcurrencia con fecha = hoy y PROGRAMADA.
    const clasesQuery = this.ocurrenciasRepo
      .createQueryBuilder('ocurrencia')
      .where('ocurrencia.fecha = CURRENT_DATE')
      .andWhere('ocurrencia.estado = :estado', {
        estado: EstadoOcurrenciaClase.PROGRAMADA,
      });
    if (filtrarPorSede) {
      clasesQuery
        .innerJoin('ocurrencia.clase', 'clase')
        .innerJoin('clase.sede', 'sede')
        .andWhere('sede.id = :sedeId', {
          sedeId: currentUser.sedeId,
        });
    }
    const clasesHoy = await clasesQuery.getCount();

    const horasQuery = this.canchasRepo
      .createQueryBuilder('cancha')
      .innerJoin('cancha.reservas', 'reserva')
      .select(
        `COALESCE(SUM(EXTRACT(EPOCH FROM (reserva.hora_fin - reserva.hora_inicio)) / 3600), 0)`,
        'horas',
      )
      .where('reserva.fecha = CURRENT_DATE')
      .andWhere('reserva.estado = :estado', {
        estado: EstadoResCancha.CONFIRMADA,
      });
    if (filtrarPorSede) {
      horasQuery.andWhere('cancha.sede_id = :sedeId', {
        sedeId: currentUser.sedeId,
      });
    }
    const horasAgendadas = await horasQuery.getRawOne<{ horas: string }>();

    return {
      clasesHoy,
      horasCanchasAgendadasHoy: Number(horasAgendadas?.horas ?? 0),
    };
  }

  async obtenerReservas(
    currentUser: UsuarioAutenticado,
    query?: PaginationQueryDto,
  ): Promise<ReservasAdmin> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const filtrarPorSede = currentUser.tipoActor !== TipoActor.GERENTE_GENERAL;

    const reservasClaseQuery = this.reservasClaseRepo
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.ocurrencia', 'ocurrencia')
      .leftJoinAndSelect('ocurrencia.clase', 'clase')
      .leftJoinAndSelect('clase.sede', 'sede')
      .leftJoinAndSelect('reserva.usuario', 'usuario')
      .orderBy('reserva.creadaEn', 'DESC');
    if (filtrarPorSede) {
      reservasClaseQuery.andWhere('sede.id = :sedeId', {
        sedeId: currentUser.sedeId,
      });
    }
    const reservasClase = await reservasClaseQuery.getMany();

    const reservasCanchaQuery = this.reservasCanchaRepo
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.cancha', 'cancha')
      .leftJoinAndSelect('cancha.sede', 'sede')
      .leftJoinAndSelect('reserva.usuario', 'usuario')
      .orderBy('reserva.fecha', 'DESC')
      .addOrderBy('reserva.horaInicio', 'DESC');
    if (filtrarPorSede) {
      reservasCanchaQuery.andWhere('sede.id = :sedeId', {
        sedeId: currentUser.sedeId,
      });
    }
    const reservasCancha = await reservasCanchaQuery.getMany();

    const ocupacion = new Map<string, number>();
    for (const reserva of reservasClase) {
      if (reserva.estado === EstadoResClase.RESERVADA) {
        ocupacion.set(
          reserva.ocurrencia.id,
          (ocupacion.get(reserva.ocurrencia.id) ?? 0) + 1,
        );
      }
    }

    const clases = reservasClase.map((reserva) => ({
      id: reserva.id,
      clase: reserva.ocurrencia.clase.tipoClase,
      sede: reserva.ocurrencia.clase.sede.nombre,
      usuario: `${reserva.usuario.nombre} ${reserva.usuario.apellido}`,
      fecha: reserva.ocurrencia.fecha,
      horario: `${reserva.ocurrencia.horaInicio.slice(0, 5)} - ${reserva.ocurrencia.horaFin.slice(0, 5)}`,
      estado: reserva.estado,
      ocupadas: ocupacion.get(reserva.ocurrencia.id) ?? 0,
      capacidad: reserva.ocurrencia.clase.capacidad,
    }));

    const clasesConOcupacionAlta = new Set(
      reservasClase
        .filter((reserva) => {
          const cantidad = ocupacion.get(reserva.ocurrencia.id) ?? 0;
          return cantidad / reserva.ocurrencia.clase.capacidad >= 0.8;
        })
        .map((reserva) => reserva.ocurrencia.id),
    ).size;

    const canchas = reservasCancha.map((reserva) => ({
      id: reserva.id,
      cancha: reserva.cancha.nombre,
      sede: reserva.cancha.sede.nombre,
      usuario: `${reserva.usuario.nombre} ${reserva.usuario.apellido}`,
      fecha: reserva.fecha,
      horario: `${reserva.horaInicio.slice(0, 5)} - ${reserva.horaFin.slice(0, 5)}`,
      estado: reserva.estado,
      precioFinal: reserva.precioFinal,
    }));

    return {
      resumen: {
        canchasReservadas: canchas.filter(
          (r) => r.estado === EstadoResCancha.CONFIRMADA,
        ).length,
        clasesConOcupacionAlta,
      },
      // Un solo page/limit para ambos arrays. Se pagina el mapeo final
      // en memoria (no en la query) para que resumen y ocupación sigan
      // calculados sobre el total filtrado por sede, no sobre la página.
      clases: paginarArray(clases, page, limit),
      canchas: paginarArray(canchas, page, limit),
    };
  }

  // Base de pagos APROBADOS con la sede resuelta (misma resolución que
  // el desglose por sede: membresía → sedeAlta, clase → sede de la
  // clase, cancha → sede de la cancha). Con sedeId, filtra en el WHERE.
  private basePagos(sedeId?: string) {
    const qb = this.pagosRepo
      .createQueryBuilder('pago')
      .where('pago.estado = :estado', { estado: EstadoPago.APROBADO })
      .leftJoin('pago.membresia', 'membresia')
      .leftJoin('pago.reservaClase', 'reservaClase')
      .leftJoin('reservaClase.ocurrencia', 'ocurrenciaDeReserva')
      .leftJoin('ocurrenciaDeReserva.clase', 'claseDeReserva')
      .leftJoin('pago.reservaCancha', 'reservaCancha')
      .leftJoin('reservaCancha.cancha', 'canchaDeReserva');
    if (sedeId) {
      qb.leftJoin('membresia.sedeAlta', 'sedeMembresia')
        .leftJoin('claseDeReserva.sede', 'sedeClase')
        .leftJoin('canchaDeReserva.sede', 'sedeCancha')
        .andWhere(
          'COALESCE(sedeMembresia.id, sedeClase.id, sedeCancha.id) = :sedeId',
          { sedeId },
        );
    }
    return qb;
  }

  // Sede efectiva para reportes: GG ve todo (sin filtro); GS solo su
  // sede (403 sin sede asignada, nunca el consolidado).
  private sedeParaReporte(currentUser: UsuarioAutenticado): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.GERENTE_GENERAL) return undefined;
    if (!currentUser.sedeId) {
      throw new ForbiddenException('Tu usuario no tiene una sede asignada');
    }
    return currentUser.sedeId;
  }

  async obtenerReporteFinanciero(
    currentUser: UsuarioAutenticado,
  ): Promise<ReporteFinanciero> {
    const sedeId = this.sedeParaReporte(currentUser);
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const inicioMesAnterior = new Date(inicioMes);
    inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);
    const finMesAnterior = new Date(inicioMes);

    const base = () => this.basePagos(sedeId);

    const ingresosHoyRaw = await base()
      .andWhere('pago.pagado_en >= :inicioHoy', { inicioHoy })
      .select('COALESCE(SUM(pago.monto), 0)', 'total')
      .getRawOne<{ total: string }>();

    const ingresosMesRaw = await base()
      .andWhere('pago.pagado_en >= :inicioMes', { inicioMes })
      .select('COALESCE(SUM(pago.monto), 0)', 'total')
      .getRawOne<{ total: string }>();

    const ingresosMesAnteriorRaw = await base()
      .andWhere('pago.pagado_en >= :inicioMesAnterior', { inicioMesAnterior })
      .andWhere('pago.pagado_en < :finMesAnterior', { finMesAnterior })
      .select('COALESCE(SUM(pago.monto), 0)', 'total')
      .getRawOne<{ total: string }>();

    const porMetodoRaw = await base()
      .andWhere('pago.pagado_en >= :inicioMes', { inicioMes })
      .select('pago.metodo', 'metodo')
      .addSelect('COALESCE(SUM(pago.monto), 0)', 'total')
      .groupBy('pago.metodo')
      .getRawMany<{ metodo: string; total: string }>();

    const porSedeQb = await this.pagosRepo.manager
      .createQueryBuilder()
      .select('sede.id', 'sedeId')
      .addSelect('sede.nombre', 'sede')
      .addSelect('COALESCE(SUM(pago.monto), 0)', 'total')
      .from(Pago, 'pago')
      .leftJoin('pago.membresia', 'membresia')
      .leftJoin('membresia.sedeAlta', 'sedeMembresia')
      .leftJoin('pago.reservaClase', 'reservaClase')
      .leftJoin('reservaClase.ocurrencia', 'ocurrenciaDeReserva')
      .leftJoin('ocurrenciaDeReserva.clase', 'claseDeReserva')
      .leftJoin('claseDeReserva.sede', 'sedeClase')
      .leftJoin('pago.reservaCancha', 'reservaCancha')
      .leftJoin('reservaCancha.cancha', 'canchaDeReserva')
      .leftJoin('canchaDeReserva.sede', 'sedeCancha')
      .leftJoin(
        Sede,
        'sede',
        'sede.id = COALESCE(sedeMembresia.id, sedeClase.id, sedeCancha.id)',
      )
      .where('pago.estado = :estado', { estado: EstadoPago.APROBADO })
      .andWhere('pago.pagado_en >= :inicioMes', { inicioMes })
      .andWhere('sede.id IS NOT NULL');
    if (sedeId) {
      porSedeQb.andWhere('sede.id = :sedeId', { sedeId });
    }
    const porSedeRaw = await porSedeQb
      .groupBy('sede.id')
      .addGroupBy('sede.nombre')
      .getRawMany<{ sedeId: string; sede: string; total: string }>();

    return {
      ingresosHoy: Number(ingresosHoyRaw?.total ?? 0),
      ingresosMes: Number(ingresosMesRaw?.total ?? 0),
      ingresosMesAnterior: Number(ingresosMesAnteriorRaw?.total ?? 0),
      porMetodo: porMetodoRaw.map((r) => ({
        metodo: r.metodo,
        total: Number(r.total),
      })),
      porSede: porSedeRaw.map((r) => ({
        sedeId: r.sedeId,
        sede: r.sede,
        total: Number(r.total),
      })),
    };
  }

  async obtenerMembresiasPorSede(
    sedeId: string | undefined,
    currentUser: UsuarioAutenticado,
  ): Promise<MembresiaPorSede[]> {
    // GS solo su sede (ignora el parámetro, nunca el consolidado).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor !== TipoActor.GERENTE_GENERAL) {
      if (!currentUser.sedeId) {
        throw new ForbiddenException('Tu usuario no tiene una sede asignada');
      }
      sedeId = currentUser.sedeId;
    }
    const sedes = sedeId
      ? await this.sedesRepo.find({ where: { id: sedeId } })
      : await this.sedesRepo.find();

    const resultado: MembresiaPorSede[] = [];
    const hoy = hoyArgentina();

    for (const sede of sedes) {
      const membresias = await this.membresiasRepo.find({
        where: { sedeAlta: { id: sede.id } },
        relations: { usuario: true },
        order: { fechaFin: 'DESC' },
      });

      resultado.push({
        sedeId: sede.id,
        sede: sede.nombre,
        activas: membresias.filter((m) => esVigente(m, hoy)).length,
        vencidas: membresias.filter(
          (m) => estadoEfectivo(m, hoy) === EstadoMembresia.VENCIDO,
        ).length,
        suspendidas: membresias.filter(
          (m) => m.estado === EstadoMembresia.SUSPENDIDO,
        ).length,
        programadas: membresias.filter((m) => esProxima(m, hoy)).length,
        socios: membresias.map((m) => ({
          usuarioId: m.usuario.id,
          nombre: `${m.usuario.nombre} ${m.usuario.apellido}`,
          dni: m.usuario.dni ?? null,
          plan: m.plan,
          estado: estadoEfectivo(m, hoy),
          fechaFin: m.fechaFin,
          fechaInicio: m.fechaInicio,
          vigente: esVigente(m, hoy),
          proxima: esProxima(m, hoy),
        })),
      });
    }

    return resultado;
  }

  async obtenerPopularidadPlanes(
    currentUser: UsuarioAutenticado,
  ): Promise<PlanPopularidad[]> {
    const sedeId = this.sedeParaReporte(currentUser);
    const qb = this.membresiasRepo
      .createQueryBuilder('m')
      .select('m.plan', 'plan')
      .addSelect('COUNT(*)', 'socios')
      .where(sqlVigente('m', ':hoy'), { hoy: hoyArgentina() });
    if (sedeId) {
      qb.innerJoin('m.sedeAlta', 'sede').andWhere('sede.id = :sedeId', {
        sedeId,
      });
    }
    const raw = await qb
      .groupBy('m.plan')
      .getRawMany<{ plan: string; socios: string }>();

    return raw.map((r) => ({ plan: r.plan, socios: Number(r.socios) }));
  }
}
