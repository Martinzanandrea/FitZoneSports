import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ClaseHorarioSemanal,
  FranjaHoraria,
  Sede,
} from '../entities';

// Días candidatos en orden de preferencia: lunes a viernes.
// (diaSemana sigue la convención JS: 0 = domingo, 1 = lunes, ... 6 = sábado)
const DIAS_CANDIDATOS = [1, 2, 3, 4, 5];

export interface HorarioSugerido {
  diaSemana: number;
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM"
  horas: number;
}

export interface SugerenciaReparto {
  viable: boolean;
  motivo?: string;
  horarios: HorarioSugerido[];
}

export interface HorarioPropuesto {
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

interface Intervalo {
  inicio: number; // minutos desde las 00:00
  fin: number;
}

function aMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function seSolapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

@Injectable()
export class RepartoHorasService {
  constructor(
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    @InjectRepository(FranjaHoraria)
    private readonly franjasRepo: Repository<FranjaHoraria>,
    @InjectRepository(ClaseHorarioSemanal)
    private readonly horariosRepo: Repository<ClaseHorarioSemanal>,
  ) {}

  roundHalf(n: number): number {
    return Math.round(n * 2) / 2;
  }

  // Solo calcula una propuesta, no persiste nada. El Gerente la revisa
  // y edita en el frontend antes de crear la clase de verdad.
  async sugerir(
    sedeId: string,
    horasSemanalesTotales: number,
    numDias: number,
  ): Promise<SugerenciaReparto> {
    if (!Number.isInteger(numDias) || numDias < 1 || numDias > 5) {
      throw new BadRequestException('numDias debe ser un entero entre 1 y 5');
    }
    if (!(horasSemanalesTotales > 0)) {
      throw new BadRequestException(
        'horasSemanalesTotales debe ser mayor a 0',
      );
    }
    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);

    // Reparto: los primeros días llevan el promedio redondeado a media
    // hora; lo que sobra o falta por el redondeo se ajusta en el último día.
    const porDia = this.roundHalf(horasSemanalesTotales / numDias);
    if (porDia <= 0) {
      return {
        viable: false,
        motivo: `Con ${horasSemanalesTotales}hs semanales no alcanza para repartir en ${numDias} días`,
        horarios: [],
      };
    }
    const horasPorDia: number[] = [];
    for (let i = 0; i < numDias - 1; i++) horasPorDia.push(porDia);
    horasPorDia.push(
      this.roundHalf(horasSemanalesTotales - porDia * (numDias - 1)),
    );

    const franjas = await this.franjasRepo.find({
      where: { sede: { id: sedeId } },
      order: { apertura: 'ASC' },
    });
    if (franjas.length === 0) {
      return {
        viable: false,
        motivo: 'La sede no tiene franjas horarias cargadas',
        horarios: [],
      };
    }
    const ocupados = await this.ocupadosPorDia(sedeId);

    const dias = DIAS_CANDIDATOS.slice(0, numDias);
    const horarios: HorarioSugerido[] = [];
    let diasSinLugar = 0;
    dias.forEach((diaSemana, i) => {
      const hueco = this.primerHuecoLibre(
        franjas.map((f) => ({
          inicio: aMinutos(f.apertura),
          fin: aMinutos(f.cierre),
        })),
        ocupados.get(diaSemana) ?? [],
        horasPorDia[i] * 60,
      );
      if (!hueco) {
        diasSinLugar++;
        return;
      }
      horarios.push({
        diaSemana,
        horaInicio: aHora(hueco.inicio),
        horaFin: aHora(hueco.fin),
        horas: horasPorDia[i],
      });
    });

    if (diasSinLugar > 0) {
      return {
        viable: false,
        motivo: `Solo hay lugar para ${horarios.length} de los ${numDias} días pedidos (una sola sala por sede, sin solape)`,
        horarios,
      };
    }
    return { viable: true, horarios };
  }

  // Defensa server-side para create(): devuelve la lista de conflictos de
  // la propuesta contra las franjas de la sede y los horarios de las demás
  // clases activas. excluirClaseId se usa si algún día se permite editar.
  async validarHuecosLibres(
    sedeId: string,
    horarios: HorarioPropuesto[],
    excluirClaseId?: string,
  ): Promise<string[]> {
    const franjas = await this.franjasRepo.find({
      where: { sede: { id: sedeId } },
    });
    const ventanas = franjas.map((f) => ({
      inicio: aMinutos(f.apertura),
      fin: aMinutos(f.cierre),
    }));
    const ocupados = await this.ocupadosPorDia(sedeId, excluirClaseId);
    const conflictos: string[] = [];
    for (const h of horarios) {
      const intervalo = {
        inicio: aMinutos(h.horaInicio),
        fin: aMinutos(h.horaFin),
      };
      if (!(intervalo.inicio < intervalo.fin)) {
        conflictos.push(
          `Día ${h.diaSemana}: la hora de inicio debe ser anterior a la de fin`,
        );
        continue;
      }
      const dentroDeFranja = ventanas.some(
        (v) => v.inicio <= intervalo.inicio && intervalo.fin <= v.fin,
      );
      if (!dentroDeFranja) {
        conflictos.push(
          `Día ${h.diaSemana} ${h.horaInicio}-${h.horaFin}: fuera de las franjas de apertura de la sede`,
        );
        continue;
      }
      const choca = (ocupados.get(h.diaSemana) ?? []).some((o) =>
        seSolapan(o, intervalo),
      );
      if (choca) {
        conflictos.push(
          `Día ${h.diaSemana} ${h.horaInicio}-${h.horaFin}: se solapa con otra clase activa de la sede`,
        );
      }
    }
    return conflictos;
  }

  private async ocupadosPorDia(
    sedeId: string,
    excluirClaseId?: string,
  ): Promise<Map<number, Intervalo[]>> {
    const filas = await this.horariosRepo
      .createQueryBuilder('horario')
      .innerJoin('horario.clase', 'clase')
      .innerJoin('clase.sede', 'sede')
      .where('sede.id = :sedeId', { sedeId })
      .andWhere('clase.activa = :activa', { activa: true })
      .select([
        'horario.diaSemana AS "diaSemana"',
        'horario.horaInicio AS "horaInicio"',
        'horario.horaFin AS "horaFin"',
      ])
      .andWhere(
        excluirClaseId ? 'clase.id != :excluir' : '1 = 1',
        excluirClaseId ? { excluir: excluirClaseId } : {},
      )
      .getRawMany<{ diaSemana: number; horaInicio: string; horaFin: string }>();
    const mapa = new Map<number, Intervalo[]>();
    for (const f of filas) {
      const lista = mapa.get(Number(f.diaSemana)) ?? [];
      lista.push({
        inicio: aMinutos(f.horaInicio),
        fin: aMinutos(f.horaFin),
      });
      mapa.set(Number(f.diaSemana), lista);
    }
    return mapa;
  }

  private primerHuecoLibre(
    ventanas: Intervalo[],
    ocupados: Intervalo[],
    duracionMin: number,
  ): Intervalo | null {
    // Resta los ocupados de cada ventana y devuelve el primer hueco
    // donde entra la duración pedida (arrancando desde el inicio).
    const libres: Intervalo[] = [];
    for (const v of ventanas) {
      let cursor = v.inicio;
      const choques = ocupados
        .filter((o) => seSolapan(o, v))
        .sort((a, b) => a.inicio - b.inicio);
      for (const c of choques) {
        if (c.inicio > cursor) libres.push({ inicio: cursor, fin: c.inicio });
        cursor = Math.max(cursor, c.fin);
      }
      if (cursor < v.fin) libres.push({ inicio: cursor, fin: v.fin });
    }
    libres.sort((a, b) => a.inicio - b.inicio);
    for (const l of libres) {
      if (l.fin - l.inicio >= duracionMin) {
        return { inicio: l.inicio, fin: l.inicio + duracionMin };
      }
    }
    return null;
  }
}
