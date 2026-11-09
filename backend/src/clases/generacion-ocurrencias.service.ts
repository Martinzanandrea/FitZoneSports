import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Clase, ClaseOcurrencia } from '../entities';
import { SEMANAS_VENTANA_OCURRENCIAS } from './reglas-clases';
import {
  ahoraArgentina,
  diaSemanaDe,
  instanteArgentina,
  sumarDias,
} from '../common/helpers/hora-argentina.helper';

@Injectable()
export class GeneracionOcurrenciasService {
  private readonly logger = new Logger(GeneracionOcurrenciasService.name);

  constructor(
    @InjectRepository(Clase)
    private readonly clasesRepo: Repository<Clase>,
    @InjectRepository(ClaseOcurrencia)
    private readonly ocurrenciasRepo: Repository<ClaseOcurrencia>,
  ) {}

  // Genera las ocurrencias concretas de una clase para las próximas N
  // semanas según su grilla semanal. Si una ocurrencia ya existe (porque
  // se generó antes), se saltea sin fallar toda la operación.
  async generarParaClase(
    claseId: string,
    semanasHaciaAdelante = SEMANAS_VENTANA_OCURRENCIAS,
    ahora: Date = new Date(),
  ): Promise<number> {
    const clase = await this.clasesRepo.findOne({
      where: { id: claseId },
      relations: { horariosSemanales: true },
    });
    if (!clase) throw new NotFoundException(`Clase ${claseId} no encontrada`);

    const porDia = new Map<number, { horaInicio: string; horaFin: string }[]>();
    for (const h of clase.horariosSemanales) {
      const lista = porDia.get(h.diaSemana) ?? [];
      lista.push({ horaInicio: h.horaInicio, horaFin: h.horaFin });
      porDia.set(h.diaSemana, lista);
    }

    // Fechas y horas son de pared en Argentina: "hoy", el día de la semana y
    // "ya empezó" se calculan con esa hora, no con la del servidor (UTC).
    const hoy = ahoraArgentina(ahora).fecha;
    let nuevas = 0;
    for (let d = 0; d < semanasHaciaAdelante * 7; d++) {
      const fechaDia = sumarDias(hoy, d);
      const horarios = porDia.get(diaSemanaDe(fechaDia)) ?? [];
      for (const h of horarios) {
        // No generar ocurrencias que ya empezaron (hoy con horario pasado).
        if (
          instanteArgentina(fechaDia, h.horaInicio).getTime() <= ahora.getTime()
        ) {
          continue;
        }
        const existe = await this.ocurrenciasRepo.findOne({
          where: {
            clase: { id: claseId },
            fecha: fechaDia,
            horaInicio: h.horaInicio,
          },
        });
        if (existe) continue;
        try {
          await this.ocurrenciasRepo.save(
            this.ocurrenciasRepo.create({
              clase,
              fecha: fechaDia,
              horaInicio: h.horaInicio,
              horaFin: h.horaFin,
            }),
          );
          nuevas++;
        } catch (error) {
          // Carreras entre ejecuciones: el UNIQUE ya la generó otro proceso.
          if (
            error instanceof QueryFailedError &&
            error.driverError?.code === '23505'
          ) {
            continue;
          }
          throw error;
        }
      }
    }
    return nuevas;
  }

  // La llama el cron: mantiene generadas las próximas semanas de todas
  // las clases activas (las desactivadas dejan de generarse a futuro,
  // pero sus ocurrencias y reservas ya creadas quedan intactas).
  async generarParaTodasLasActivas(): Promise<number> {
    const activas = await this.clasesRepo.find({
      where: { activa: true },
      select: { id: true },
    });
    let total = 0;
    for (const clase of activas) {
      total += await this.generarParaClase(clase.id);
    }
    return total;
  }

  @Cron(CronExpression.EVERY_WEEK)
  async generarSemanal(): Promise<void> {
    const total = await this.generarParaTodasLasActivas();
    this.logger.log(
      `Generación semanal de ocurrencias: ${total} ocurrencia(s) nueva(s)`,
    );
  }
}
