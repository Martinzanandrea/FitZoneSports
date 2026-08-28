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
import { PreciosService } from '../precios/precios.service';
import { CreatePagoDto } from './dto/create-pago.dto';
import { RegistrarPagoEfectivoDto } from './dto/registrar-pago-efectivo.dto';
import { assertOwnerOrStaff } from '../auth/helpers/ownership.helper';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

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
    private readonly preciosService: PreciosService,
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

  private async calcularMonto(
    montoRecibido: number | undefined,
    referencia: {
      membresia?: Membresia;
      reservaClase?: ReservaClase;
      reservaCancha?: ReservaCancha;
    },
  ): Promise<number> {
    if (referencia.membresia) {
      return this.preciosService.obtenerPrecio(referencia.membresia.plan);
    }
    if (referencia.reservaCancha) {
      return Number(referencia.reservaCancha.precioFinal);
    }
    if (montoRecibido === undefined) {
      throw new BadRequestException(
        'Debe indicarse el monto para este tipo de pago',
      );
    }
    return montoRecibido;
  }

  private async obtenerSedeDeReferencia(referencia: {
    membresia?: Membresia;
    reservaClase?: ReservaClase;
    reservaCancha?: ReservaCancha;
  }): Promise<string | null> {
    if (referencia.membresia) {
      const m = await this.membresiasRepo.findOne({
        where: { id: referencia.membresia.id },
        relations: { sedeAlta: true },
      });
      return m?.sedeAlta.id ?? null;
    }
    if (referencia.reservaClase) {
      const r = await this.reservasClaseRepo.findOne({
        where: { id: referencia.reservaClase.id },
        relations: { clase: { sede: true } },
      });
      return r?.clase.sede.id ?? null;
    }
    if (referencia.reservaCancha) {
      const r = await this.reservasCanchaRepo.findOne({
        where: { id: referencia.reservaCancha.id },
        relations: { cancha: { sede: true } },
      });
      return r?.cancha.sede.id ?? null;
    }
    return null;
  }

  async pagarConPasarela(dto: CreatePagoDto): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const referencia = await this.resolverReferencia(dto);
    const monto = await this.calcularMonto(dto.monto, referencia);

    const { aprobado, token } = await this.pasarela.procesarPago(
      monto,
      dto.metodo,
    );

    const pago = this.pagosRepo.create({
      usuario,
      ...referencia,
      metodo: dto.metodo,
      monto: String(monto),
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
    registradoPorId: string,
  ): Promise<Pago> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${dto.usuarioId} no encontrado`);

    const registradoPor = await this.usuariosRepo.findOne({
      where: { id: registradoPorId },
      relations: { sede: true },
    });
    if (!registradoPor)
      throw new NotFoundException(`Usuario ${registradoPorId} no encontrado`);

    if (
      registradoPor.tipoActor !== TipoActor.RECEPCIONISTA &&
      registradoPor.tipoActor !== TipoActor.GERENTE
    ) {
      throw new BadRequestException(
        'Solo un recepcionista o gerente puede registrar un pago en efectivo',
      );
    }

    const referencia = await this.resolverReferencia(dto);
    const monto = await this.calcularMonto(dto.monto, referencia);

    if (registradoPor.tipoActor === TipoActor.RECEPCIONISTA) {
      const sedeDeLaOperacion = await this.obtenerSedeDeReferencia(referencia);
      if (sedeDeLaOperacion) {
        const currentUser: UsuarioAutenticado = {
          id: registradoPor.id,
          tipoActor: registradoPor.tipoActor,
          email: registradoPor.email ?? '',
          sedeId: registradoPor.sede?.id ?? null,
        };
        assertSedeScope(currentUser, sedeDeLaOperacion);
      }
    }

    const pago = this.pagosRepo.create({
      usuario,
      registradoPor,
      ...referencia,
      metodo: MetodoPago.EFECTIVO,
      monto: String(monto),
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

  async findOne(id: string, currentUser: UsuarioAutenticado): Promise<Pago> {
    const pago = await this.pagosRepo.findOne({
      where: { id },
      relations: { comprobante: true, usuario: true, registradoPor: true },
    });
    if (!pago) throw new NotFoundException(`Pago ${id} no encontrado`);
    assertOwnerOrStaff(currentUser, pago.usuario.id);
    return pago;
  }
}
