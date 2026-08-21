import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ControlAcceso, Usuario, Sede } from '../entities';

interface QrPayload {
  usuarioId: string;
  tipo: 'qr-acceso';
}

@Injectable()
export class AccesoService {
  constructor(
    @InjectRepository(ControlAcceso)
    private readonly accesoRepo: Repository<ControlAcceso>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(Sede)
    private readonly sedesRepo: Repository<Sede>,
    private readonly jwtService: JwtService,
  ) {}

  // RF04: QR dinámico que rota cada minuto. Se firma con el mismo secret
  // de JWT_SECRET, pero con expiración corta e independiente del login.
  async generarQr(
    usuarioId: string,
  ): Promise<{ qrToken: string; expiraEn: number }> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    const payload: QrPayload = { usuarioId, tipo: 'qr-acceso' };
    const qrToken = this.jwtService.sign(payload, { expiresIn: '60s' });
    return { qrToken, expiraEn: 60 };
  }

  async obtenerAforo(
    sedeId: string,
  ): Promise<{ actual: number; maximo: number }> {
    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);

    const actual = await this.accesoRepo
      .createQueryBuilder('a')
      .where('a.sede_id = :sedeId', { sedeId })
      .andWhere('a.hora_egreso IS NULL')
      .getCount();

    return { actual, maximo: sede.aforoMaximo };
  }

  async validarIngreso(
    qrToken: string,
    sedeId: string,
  ): Promise<ControlAcceso> {
    let payload: QrPayload;
    try {
      payload = this.jwtService.verify<QrPayload>(qrToken);
    } catch {
      throw new BadRequestException('QR inválido o expirado');
    }
    if (payload.tipo !== 'qr-acceso') {
      throw new BadRequestException('QR inválido');
    }

    const usuario = await this.usuariosRepo.findOne({
      where: { id: payload.usuarioId },
    });
    if (!usuario) throw new NotFoundException('Usuario del QR no encontrado');
    if (!usuario.activo) throw new BadRequestException('Usuario inactivo');

    const sede = await this.sedesRepo.findOne({ where: { id: sedeId } });
    if (!sede) throw new NotFoundException(`Sede ${sedeId} no encontrada`);

    // Chequeo de aforo (RF05): no dejar entrar si ya está al máximo.
    const { actual, maximo } = await this.obtenerAforo(sedeId);
    if (actual >= maximo) {
      throw new ConflictException('La sede alcanzó su aforo máximo');
    }

    // RN01: el índice único parcial de la base es la garantía real; acá
    // hacemos además un chequeo explícito para devolver un error claro
    // (en vez de que el usuario reciba un 500 crudo de Postgres).
    const sesionAbierta = await this.accesoRepo
      .createQueryBuilder('a')
      .where('a.usuario_id = :usuarioId', { usuarioId: usuario.id })
      .andWhere('a.hora_egreso IS NULL')
      .getOne();

    if (sesionAbierta) {
      throw new ConflictException(
        'El usuario ya tiene un ingreso abierto en otra sede (o en esta misma sin egreso registrado)',
      );
    }

    const registro = this.accesoRepo.create({ usuario, sede });
    return this.accesoRepo.save(registro);
  }

  async registrarEgreso(usuarioId: string): Promise<ControlAcceso> {
    const sesionAbierta = await this.accesoRepo
      .createQueryBuilder('a')
      .where('a.usuario_id = :usuarioId', { usuarioId })
      .andWhere('a.hora_egreso IS NULL')
      .getOne();

    if (!sesionAbierta) {
      throw new NotFoundException('El usuario no tiene ningún ingreso abierto');
    }

    sesionAbierta.horaEgreso = new Date();
    return this.accesoRepo.save(sesionAbierta);
  }

  findHistorialPorUsuario(usuarioId: string): Promise<ControlAcceso[]> {
    return this.accesoRepo.find({
      where: { usuario: { id: usuarioId } },
      relations: { sede: true },
      order: { horaIngreso: 'DESC' },
    });
  }
}
