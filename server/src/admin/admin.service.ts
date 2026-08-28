import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Cancha,
  Clase,
  EstadoResCancha,
  EstadoResClase,
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
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
}
