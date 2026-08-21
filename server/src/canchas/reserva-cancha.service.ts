import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancha, Usuario, ReservaCancha } from '../entities';
import { TipoActor, EstadoMembresia, EstadoResCancha } from '../entities/enums';
import { MembresiasService } from '../membresias/membresias.service';
import { BookingCanchaRepository } from './booking-cancha.repository';
import { PricingCalculatorService } from './pricing/pricing-calculator.service';
import { CreateReservaCanchaDto } from './dto/create-reserva-cancha.dto';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';

@Injectable()
export class ReservasCanchaService {
  constructor(
    @InjectRepository(Cancha)
    private readonly canchasRepo: Repository<Cancha>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(ReservaCancha)
    private readonly reservasRepo: Repository<ReservaCancha>,
    private readonly bookingRepo: BookingCanchaRepository,
    private readonly pricingCalculator: PricingCalculatorService,
    private readonly membresiasService: MembresiasService,
  ) {}

  async reservar(dto: CreateReservaCanchaDto): Promise<ReservaCancha> {
    const cancha = await this.canchasRepo.findOne({
      where: { id: dto.canchaId },
    });
    if (!cancha)
      throw new NotFoundException(`Cancha ${dto.canchaId} no encontrada`);

    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    // RN03: el descuento de socio solo aplica si es SOCIO y su membresía
    // vigente está ACTIVA (no vencida). Un externo, o un socio vencido,
    // paga el precio "estándar" (con recargo pico si corresponde).
    let esSocioActivo = false;
    if (usuario.tipoActor === TipoActor.SOCIO) {
      const membresia = await this.membresiasService.obtenerMembresiaVigente(
        usuario.id,
      );
      esSocioActivo =
        !!membresia && membresia.estado === EstadoMembresia.ACTIVO;
    }

    const esHoraPico = this.pricingCalculator.esHoraPico(dto.horaInicio);
    const { precioFinal, estrategia } = this.pricingCalculator.calcular(
      Number(cancha.costoHoraBase),
      { esSocioActivo, esHoraPico },
    );

    // A partir de acá, el BookingCanchaRepository maneja la transacción
    // y el lock — este service no sabe nada de eso, solo le pide el resultado.
    return this.bookingRepo.crearReservaSegura({
      canchaId: dto.canchaId,
      usuario,
      fecha: dto.fecha,
      horaInicio: dto.horaInicio,
      horaFin: dto.horaFin,
      precioFinal,
      estrategiaPrecio: estrategia,
    });
  }

  findPorCancha(canchaId: string, fecha?: string): Promise<ReservaCancha[]> {
    return this.reservasRepo.find({
      where: fecha
        ? { cancha: { id: canchaId }, fecha }
        : { cancha: { id: canchaId } },
      relations: { usuario: true },
      order: { horaInicio: 'ASC' },
    });
  }

  async cancelar(
    reservaId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaCancha> {
    const reserva = await this.reservasRepo.findOne({
      where: { id: reservaId },
      relations: { usuario: true },
    });
    if (!reserva)
      throw new NotFoundException(`Reserva ${reservaId} no encontrada`);

    assertOwnerOrStaff(currentUser, reserva.usuario.id);

    reserva.estado = EstadoResCancha.CANCELADA;
    reserva.canceladaEn = new Date();
    return this.reservasRepo.save(reserva);
  }
}
