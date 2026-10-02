import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ControlAcceso, Membresia, Usuario, Sede } from '../entities';
import { EstadoMembresia, TipoActor } from '../entities/enums';
import { estadoDesde } from '../membresias/estado-membresia';
import { assertSedeScope } from '../auth/helpers/sede-scope.helper';
import { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';

interface QrPayload {
  usuarioId: string;
  tipo: 'qr-acceso';
}

interface CodigoCorto {
  usuarioId: string;
  expiraEnMs: number;
}

// 60 segundos, igual que el QR (ambos se generan y vencen juntos).
const CODIGO_CORTO_TTL_MS = 60_000;

export interface ResumenAccesoSede {
  sedeId: string;
  sede: string;
  aforoActual: number;
  aforoMaximo: number;
  ingresosHoy: number;
  egresosHoy: number;
}

export interface ResumenAccesos {
  porSede: ResumenAccesoSede[];
  totalIngresosHoy: number;
  totalEgresosHoy: number;
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
    @InjectRepository(Membresia)
    private readonly membresiasRepo: Repository<Membresia>,
    private readonly jwtService: JwtService,
  ) {}

  // RF-04: el QR de acceso es exclusivo de Socios con membresía activa.
  // Mismo criterio que RN-03 en reserva-clase.service.ts.
  private async exigirSocioConMembresiaActiva(
    usuario: Usuario,
  ): Promise<void> {
    if (usuario.tipoActor !== TipoActor.SOCIO) {
      throw new ForbiddenException('El acceso por QR es exclusivo de socios');
    }
    const membresia = await this.membresiasRepo.findOne({
      where: {
        usuario: { id: usuario.id },
        estado: EstadoMembresia.ACTIVO,
      },
    });
    if (!membresia || !estadoDesde(membresia).puedeGenerarQr()) {
      throw new ForbiddenException(
        'Necesitás una membresía activa para generar tu código de acceso',
      );
    }
  }

  // Códigos cortos de 6 dígitos, alternativa práctica al token largo.
  // En memoria (no sobrevive reinicios ni se comparte entre instancias).
  private readonly codigosCortos = new Map<string, CodigoCorto>();

  // RF04: QR dinámico que rota cada minuto.
  async generarQr(
    usuarioId: string,
  ): Promise<{ qrToken: string; codigoCorto: string; expiraEn: number }> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    await this.exigirSocioConMembresiaActiva(usuario);

    this.purgarCodigosExpirados();

    const payload: QrPayload = { usuarioId, tipo: 'qr-acceso' };
    const qrToken = this.jwtService.sign(payload, { expiresIn: '60s' });
    const codigoCorto = this.generarCodigoCortoUnico();
    this.codigosCortos.set(codigoCorto, {
      usuarioId,
      expiraEnMs: Date.now() + CODIGO_CORTO_TTL_MS,
    });
    return { qrToken, codigoCorto, expiraEn: 60 };
  }

  private purgarCodigosExpirados(): void {
    const ahora = Date.now();
    for (const [codigo, entrada] of this.codigosCortos) {
      if (entrada.expiraEnMs <= ahora) this.codigosCortos.delete(codigo);
    }
  }

  private generarCodigoCortoUnico(): string {
    for (let i = 0; i < 10; i++) {
      const codigo = String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0');
      if (!this.codigosCortos.has(codigo)) return codigo;
    }
    throw new ConflictException('No se pudo generar un código, reintentá');
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

  // Lista quiénes están DENTRO de una sede ahora mismo (sesión abierta,
  // hora_egreso IS NULL), con el que lleva más tiempo primero. Solo
  // lectura; el recepcionista queda limitado a su propia sede.
  // Paginado: en una sede concurrida la lista puede tener cientos de filas.
  async listarDentro(
    sedeId: string,
    currentUser: UsuarioAutenticado,
    query?: PaginationQueryDto,
  ): Promise<PaginatedResponse<ControlAcceso>> {
    assertSedeScope(currentUser, sedeId);
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;
    const [data, total] = await this.accesoRepo.findAndCount({
      where: { sede: { id: sedeId }, horaEgreso: IsNull() },
      relations: { usuario: true },
      order: { horaIngreso: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }

  // RN01 + RF04/RF05: valida el QR, chequea aforo, y ahora también
  // que el recepcionista que valida pertenezca a ESA sede (o sea Gerente).
  async validarIngreso(
    qrToken: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
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

    return this.registrarIngresoValidado(
      payload.usuarioId,
      sedeId,
      currentUser,
      'Usuario del QR no encontrado',
    );
  }

  // Alternativa práctica al token largo: código de 6 dígitos de un solo
  // uso, con la misma expiración de 60 segundos que el QR.
  async validarCodigo(
    codigo: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
  ): Promise<ControlAcceso> {
    const entrada = this.codigosCortos.get(codigo);
    if (!entrada || entrada.expiraEnMs <= Date.now()) {
      if (entrada) this.codigosCortos.delete(codigo);
      throw new BadRequestException('Código inválido o expirado');
    }

    const registro = await this.registrarIngresoValidado(
      entrada.usuarioId,
      sedeId,
      currentUser,
      'Usuario del código no encontrado',
    );
    // Un solo uso: recién se borra con la validación exitosa.
    this.codigosCortos.delete(codigo);
    return registro;
  }

  // Lógica compartida de validación de ingreso (sede-scope, membresía,
  // aforo, RN-01 y registro). Recibe el usuarioId ya resuelto — sea
  // desde el JWT del QR o desde el código corto.
  private async registrarIngresoValidado(
    usuarioId: string,
    sedeId: string,
    currentUser: UsuarioAutenticado,
    mensajeUsuarioNoEncontrado: string,
  ): Promise<ControlAcceso> {
    assertSedeScope(currentUser, sedeId);

    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario) throw new NotFoundException(mensajeUsuarioNoEncontrado);
    if (!usuario.activo) throw new BadRequestException('Usuario inactivo');

    // Defensa en profundidad: el código pudo generarse cuando la membresía
    // estaba activa y vencer en los 60 segundos intermedios.
    await this.exigirSocioConMembresiaActiva(usuario);

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

  // Agregado de solo lectura para el Gerente: métricas de accesos de
  // todas las sedes activas. Reusa el criterio de obtenerAforo
  // (hora_egreso IS NULL) para el aforo actual.
  async obtenerResumenAccesos(): Promise<ResumenAccesos> {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    const sedes = await this.sedesRepo.find({
      where: { activa: true },
      order: { nombre: 'ASC' },
    });

    const porSede: ResumenAccesoSede[] = [];
    for (const sede of sedes) {
      const [aforoActual, ingresosHoy, egresosHoy] = await Promise.all([
        this.accesoRepo
          .createQueryBuilder('a')
          .where('a.sede_id = :sedeId', { sedeId: sede.id })
          .andWhere('a.hora_egreso IS NULL')
          .getCount(),
        this.accesoRepo
          .createQueryBuilder('a')
          .where('a.sede_id = :sedeId', { sedeId: sede.id })
          .andWhere('a.hora_ingreso >= :inicioHoy', { inicioHoy })
          .getCount(),
        this.accesoRepo
          .createQueryBuilder('a')
          .where('a.sede_id = :sedeId', { sedeId: sede.id })
          .andWhere('a.hora_egreso >= :inicioHoy', { inicioHoy })
          .getCount(),
      ]);
      porSede.push({
        sedeId: sede.id,
        sede: sede.nombre,
        aforoActual,
        aforoMaximo: sede.aforoMaximo,
        ingresosHoy,
        egresosHoy,
      });
    }

    return {
      porSede,
      totalIngresosHoy: porSede.reduce((acc, s) => acc + s.ingresosHoy, 0),
      totalEgresosHoy: porSede.reduce((acc, s) => acc + s.egresosHoy, 0),
    };
  }

  async findHistorialPorUsuario(
    usuarioId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<ControlAcceso>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.accesoRepo.findAndCount({
      where: { usuario: { id: usuarioId } },
      relations: { sede: true },
      order: { horaIngreso: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) || 1 };
  }
}
