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
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';

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

  // RF04: QR dinámico que rota cada minuto.
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

  // RN01 + RF04/RF05: valida el QR, chequea aforo, y ahora también
  // que el recepcionista que valida pertenezca a ESA sede (o sea Gerente).
  async validarIngreso(
    qrToken: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    assertSedeScope(currentUser, sedeId);

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

    const { actual, maximo } = await this.obtenerAforo(sedeId);
    if (actual >= maximo) {
      throw new ConflictException('La sede alcanzó su aforo máximo');
    }

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

  // Ahora recibe currentUser para validar que el recepcionista que cierra
  // la sesión pertenezca a la sede donde el usuario está registrado como
  // "dentro". Un Gerente puede hacerlo desde cualquier sede.
  async registrarEgreso(
    usuarioId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    const sesionAbierta = await this.accesoRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sede', 'sede')
      .where('a.usuario_id = :usuarioId', { usuarioId })
      .andWhere('a.hora_egreso IS NULL')
      .getOne();

    if (!sesionAbierta) {
      throw new NotFoundException('El usuario no tiene ningún ingreso abierto');
    }

    assertSedeScope(currentUser, sesionAbierta.sede.id);

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
