import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Cancha,
  Clase,
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
import { TipoActor } from '../entities/enums';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

export interface DashboardResumen {
  clasesHoy: number;
  horasCanchasAgendadasHoy: number;
}

export interface ReservasAdmin {
  resumen: {
    canchasReservadas: number;
    clasesConOcupacionAlta: number;
  };
  clases: Array<{
    id: string;
    clase: string;
    sede: string;
    usuario: string;
    fecha: string;
    horario: string;
    estado: EstadoResClase;
    ocupadas: number;
    capacidad: number;
  }>;
  canchas: Array<{
    id: string;
    cancha: string;
    sede: string;
    usuario: string;
    fecha: string;
    horario: string;
    estado: EstadoResCancha;
    precioFinal: string;
  }>;
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
  activas: number;
  vencidas: number;
  suspendidas: number;
  socios: Array<{
    usuarioId: string;
    nombre: string;
    dni: string | null;
    plan: string;
    estado: EstadoMembresia;
    fechaFin: string;
  }>;
}

export interface PlanPopularidad {
  plan: string;
  socios: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Clase)
    private readonly clasesRepo: Repository<Clase>,
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
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);
    const finHoy = new Date(inicioHoy);
    finHoy.setDate(finHoy.getDate() + 1);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const filtrarPorSede = currentUser.tipoActor === TipoActor.RECEPCIONISTA;

    const clasesQuery = this.clasesRepo
      .createQueryBuilder('clase')
      .where('clase.horarioInicio >= :inicioHoy', { inicioHoy })
      .andWhere('clase.horarioInicio < :finHoy', { finHoy });
    if (filtrarPorSede) {
      clasesQuery.andWhere('clase.sede_id = :sedeId', {
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
  ): Promise<ReservasAdmin> {
    const filtrarPorSede = currentUser.tipoActor === TipoActor.RECEPCIONISTA;

    const reservasClaseQuery = this.reservasClaseRepo
      .createQueryBuilder('reserva')
      .leftJoinAndSelect('reserva.clase', 'clase')
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
          reserva.clase.id,
          (ocupacion.get(reserva.clase.id) ?? 0) + 1,
        );
      }
    }

    const clases = reservasClase.map((reserva) => ({
      id: reserva.id,
      clase: reserva.clase.tipoClase,
      sede: reserva.clase.sede.nombre,
      usuario: `${reserva.usuario.nombre} ${reserva.usuario.apellido}`,
      fecha: reserva.clase.horarioInicio.toISOString().slice(0, 10),
      horario: `${reserva.clase.horarioInicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} - ${reserva.clase.horarioFin.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      estado: reserva.estado,
      ocupadas: ocupacion.get(reserva.clase.id) ?? 0,
      capacidad: reserva.clase.capacidad,
    }));

    const clasesConOcupacionAlta = new Set(
      reservasClase
        .filter((reserva) => {
          const cantidad = ocupacion.get(reserva.clase.id) ?? 0;
          return cantidad / reserva.clase.capacidad >= 0.8;
        })
        .map((reserva) => reserva.clase.id),
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
      clases,
      canchas,
    };
  }

  async obtenerReporteFinanciero(): Promise<ReporteFinanciero> {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);

    const inicioMesAnterior = new Date(inicioMes);
    inicioMesAnterior.setMonth(inicioMesAnterior.getMonth() - 1);
    const finMesAnterior = new Date(inicioMes);

    const base = () =>
      this.pagosRepo
        .createQueryBuilder('pago')
        .where('pago.estado = :estado', { estado: EstadoPago.APROBADO });

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

    const porSedeRaw = await this.pagosRepo.manager
      .createQueryBuilder()
      .select('sede.id', 'sedeId')
      .addSelect('sede.nombre', 'sede')
      .addSelect('COALESCE(SUM(pago.monto), 0)', 'total')
      .from(Pago, 'pago')
      .leftJoin('pago.membresia', 'membresia')
      .leftJoin('membresia.sedeAlta', 'sedeMembresia')
      .leftJoin('pago.reservaClase', 'reservaClase')
      .leftJoin('reservaClase.clase', 'claseDeReserva')
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
      .andWhere('sede.id IS NOT NULL')
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

  async obtenerMembresiasPorSede(sedeId?: string): Promise<MembresiaPorSede[]> {
    const sedes = sedeId
      ? await this.sedesRepo.find({ where: { id: sedeId } })
      : await this.sedesRepo.find();

    const resultado: MembresiaPorSede[] = [];

    for (const sede of sedes) {
      const membresias = await this.membresiasRepo.find({
        where: { sedeAlta: { id: sede.id } },
        relations: { usuario: true },
        order: { fechaFin: 'DESC' },
      });

      resultado.push({
        sedeId: sede.id,
        sede: sede.nombre,
        activas: membresias.filter((m) => m.estado === EstadoMembresia.ACTIVO)
          .length,
        vencidas: membresias.filter((m) => m.estado === EstadoMembresia.VENCIDO)
          .length,
        suspendidas: membresias.filter(
          (m) => m.estado === EstadoMembresia.SUSPENDIDO,
        ).length,
        socios: membresias.map((m) => ({
          usuarioId: m.usuario.id,
          nombre: `${m.usuario.nombre} ${m.usuario.apellido}`,
          dni: m.usuario.dni ?? null,
          plan: m.plan,
          estado: m.estado,
          fechaFin: m.fechaFin,
        })),
      });
    }

    return resultado;
  }

  async obtenerPopularidadPlanes(): Promise<PlanPopularidad[]> {
    const raw = await this.membresiasRepo
      .createQueryBuilder('m')
      .select('m.plan', 'plan')
      .addSelect('COUNT(*)', 'socios')
      .where('m.estado = :estado', { estado: EstadoMembresia.ACTIVO })
      .groupBy('m.plan')
      .getRawMany<{ plan: string; socios: string }>();

    return raw.map((r) => ({ plan: r.plan, socios: Number(r.socios) }));
  }
}
