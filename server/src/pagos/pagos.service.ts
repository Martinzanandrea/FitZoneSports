import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Pago,
  Usuario,
  Membresia,
  ReservaClase,
  ReservaCancha,
} from '../entities';
import { EstadoPago, MetodoPago, TipoActor } from '../entities/enums';
import { PasarelaMockService } from './gateway/pasarela-mock.service';
import { ComprobantesService } from './comprobantes.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { RegistrarPagoEfectivoDto } from './dto/registrar-pago-efectivo.dto';

@Injectable()
export class PagosService {
  constructor(
    @InjectRepository(Pago)
    private readonly pagosRepo: Repository<Pago>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    @InjectRepository(ReservaClase)
    private readonly reservasClaseRepo: Repository<ReservaClase>,
    @InjectRepository(ReservaCancha)
    private readonly reservasCanchaRepo: Repository<ReservaCancha>,
    private readonly pasarela: PasarelaMockService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  private async resolverReferencia(dto: {
    membresiaId?: string;
    reservaClaseId?: string;
    reservaCanchaId?: string;
  }): Promise<{
    membresia?: Membresia;
    reservaClase?: ReservaClase;
    reservaCancha?: ReservaCancha;
  }> {
    const referencias = [
      dto.membresiaId,
      dto.reservaClaseId,
      dto.reservaCanchaId,
    ].filter(Boolean);
    if (referencias.length !== 1) {
      throw new BadRequestException(
        'Debe indicarse exactamente una referencia: membresiaId, reservaClaseId o reservaCanchaId',
      );
    }

    if (dto.membresiaId) {
      const membresia = await this.membresiasRepo.findOne({
        where: { id: dto.membresiaId },
      });
      if (!membresia)
        throw new NotFoundException(
          `Membresía ${dto.membresiaId} no encontrada`,
        );
      return { membresia };
    }
    if (dto.reservaClaseId) {
      const reservaClase = await this.reservasClaseRepo.findOne({
        where: { id: dto.reservaClaseId },
      });
      if (!reservaClase)
        throw new NotFoundException(
          `Reserva de clase ${dto.reservaClaseId} no encontrada`,
        );
      return { reservaClase };
    }
    const reservaCancha = await this.reservasCanchaRepo.findOne({
      where: { id: dto.reservaCanchaId },
    });
    if (!reservaCancha)
      throw new NotFoundException(
        `Reserva de cancha ${dto.reservaCanchaId} no encontrada`,
      );
    return { reservaCancha };
  }

  async pagarConPasarela(dto: CreatePagoDto): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const referencia = await this.resolverReferencia(dto);

    const { aprobado, token } = await this.pasarela.procesarPago(
      dto.monto,
      dto.metodo,
    );

    const pago = this.pagosRepo.create({
      usuario,
      ...referencia,
      metodo: dto.metodo,
      monto: String(dto.monto),
      tokenPasarela: token,
      estado: aprobado ? EstadoPago.APROBADO : EstadoPago.RECHAZADO,
      pagadoEn: aprobado ? new Date() : undefined,
    });
    const guardado = await this.pagosRepo.save(pago);

    if (aprobado) {
      await this.comprobantes.generar(guardado);
    }

    return guardado;
  }

  async registrarPagoEfectivo(
    dto: RegistrarPagoEfectivoDto,
    id: string,
  ): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const registradoPor = await this.usuariosRepo.findOne({
      where: { id: dto.registradoPorId },
    });
    if (!registradoPor)
      throw new NotFoundException(
        `Usuario ${dto.registradoPorId} no encontrado`,
      );

    if (
      registradoPor.tipoActor !== TipoActor.RECEPCIONISTA &&
      registradoPor.tipoActor !== TipoActor.GERENTE
    ) {
      throw new BadRequestException(
        'Solo un recepcionista o gerente puede registrar un pago en efectivo',
      );
    }

    const referencia = await this.resolverReferencia(dto);

    const pago = this.pagosRepo.create({
      usuario,
      registradoPor,
      ...referencia,
      metodo: MetodoPago.EFECTIVO,
      monto: String(dto.monto),
      estado: EstadoPago.APROBADO,
      pagadoEn: new Date(),
    });
    const guardado = await this.pagosRepo.save(pago);
    await this.comprobantes.generar(guardado);

    return guardado;
  }

  findPorUsuario(usuarioId: string): Promise<Pago[]> {
    return this.pagosRepo.find({
      where: { usuario: { id: usuarioId } },
      relations: { comprobante: true, registradoPor: true },
      order: { creadoEn: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Pago> {
    const pago = await this.pagosRepo.findOne({
      where: { id },
      relations: { comprobante: true, usuario: true, registradoPor: true },
    });
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
    return pago;
  }
}
