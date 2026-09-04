import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cancha, Usuario, ReservaCancha } from '../entities';
import { TipoActor, EstadoMembresia, EstadoResCancha } from '../entities/enums';
import { MembresiasService } from '../membresias/membresias.service';
import { BookingCanchaRepository } from './booking-cancha.repository';
import { PricingCalculatorService } from './pricing/pricing-calculator.service';
import { CreateReservaCanchaDto } from './dto/create-reserva-cancha.dto';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

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

  async reservar(
    dto: CreateReservaCanchaDto,
    currentUser: UsuarioAutenticado,
  ): Promise<ReservaCancha> {
    const cancha = await this.canchasRepo.findOne({
      where: { id: dto.canchaId },
      relations: { sede: true },
    });
    if (!cancha)
      throw new NotFoundException(`Cancha ${dto.canchaId} no encontrada`);

    // Un Recepcionista solo puede operar reservas de SU sede.
    // Un Gerente no tiene restricción. Un Socio/Externo reservando para
    // sí mismo tampoco (puede reservar en cualquier sede, RF03).
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (currentUser.tipoActor === TipoActor.RECEPCIONISTA) {
      assertSedeScope(currentUser, cancha.sede.id);
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const inicio = new Date(`${dto.fecha}T${dto.horaInicio}:00`);
    if (inicio.getTime() <= Date.now()) {
      throw new BadRequestException('No se puede reservar un horario que ya comenzó');
    }

    const { precioFinal, estrategia } = await this.calcularPrecio(
      cancha,
      usuario,
      dto.horaInicio,
    );

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

  async cotizar(dto: CreateReservaCanchaDto, currentUser: UsuarioAutenticado) {
    assertOwnerOrStaff(currentUser, dto.usuarioId);
    const cancha = await this.canchasRepo.findOne({
      where: { id: dto.canchaId },
      relations: { sede: true },
    });
    if (!cancha) throw new NotFoundException(`Cancha ${dto.canchaId} no encontrada`);

    const usuario = await this.usuariosRepo.findOne({ where: { id: dto.usuarioId } });
    if (!usuario) throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const inicio = new Date(`${dto.fecha}T${dto.horaInicio}:00`);
    if (inicio.getTime() <= Date.now()) {
      throw new BadRequestException('No se puede reservar un horario que ya comenzó');
    }

    return this.calcularPrecio(cancha, usuario, dto.horaInicio);
  }

  private async calcularPrecio(cancha: Cancha, usuario: Usuario, horaInicio: string) {
    let esSocioActivo = false;
    if (usuario.tipoActor === TipoActor.SOCIO) {
      const membresia = await this.membresiasService.obtenerMembresiaVigente(usuario.id);
      esSocioActivo = !!membresia && membresia.estado === EstadoMembresia.ACTIVO;
    }

    return this.pricingCalculator.calcular(Number(cancha.costoHoraBase), {
      esSocioActivo,
      esHoraPico: this.pricingCalculator.esHoraPico(horaInicio),
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
