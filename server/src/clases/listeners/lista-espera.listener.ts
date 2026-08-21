import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservaClase } from '../../entities';
import { EstadoResClase } from '../../entities/enums';

// Este es el "Observer" del patrón: no lo llama nadie directamente,
// reacciona solo cuando alguien emite el evento 'clase.cupo-liberado'.
@Injectable()
export class ListaEsperaListener {
  private readonly logger = new Logger(ListaEsperaListener.name);

  constructor(
    @InjectRepository(ReservaClase)
    private readonly reservasRepo: Repository<ReservaClase>,
  ) {}

  @OnEvent('clase.cupo-liberado')
  async promoverSiguienteEnEspera(payload: { claseId: string }) {
    const siguiente = await this.reservasRepo.findOne({
      where: {
        clase: { id: payload.claseId },
        estado: EstadoResClase.LISTA_ESPERA,
      },
      order: { creadaEn: 'ASC' }, // el que se anotó primero a la espera, entra primero
      relations: { usuario: true },
    });

    if (!siguiente) return; // nadie esperando, no hay nada que hacer

    siguiente.estado = EstadoResClase.RESERVADA;
    siguiente.notificado = true;
    await this.reservasRepo.save(siguiente);
    this.logger.log(
      `Notificado a ${siguiente.usuario.nombre} ${siguiente.usuario.apellido}: se liberó un cupo en su clase.`,
    );
  }
}
