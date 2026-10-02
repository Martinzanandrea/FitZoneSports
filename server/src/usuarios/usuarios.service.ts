import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailVerificacionService } from './email-verificacion.service';
import { TipoActor, Usuario } from '../entities';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';

const SALT_ROUNDS = 10; // "costo" del hasheo: más alto = más lento pero más seguro. 10 es el estándar razonable hoy.

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly storageService: SupabaseStorageService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailVerificacion: EmailVerificacionService,
  ) {}

  async create(
    dto: CreateUsuarioDto,
    foto?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
  ): Promise<Usuario> {
    const { password, sedeId, ...resto } = dto;
    const fotoUrl = foto
      ? await this.storageService.subirArchivo(
          this.config.getOrThrow<string>('SUPABASE_BUCKET_FOTOS'),

          foto.buffer,

          foto.originalname.split('.').pop() ?? 'jpg',

          foto.mimetype,
        )
      : undefined;
    const usuario = this.usuariosRepo.create({
      ...resto,
      fotoUrl,
      sede: sedeId ? { id: sedeId } : undefined,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    });

    const guardado = await this.usuariosRepo.save(usuario);

    // El registro no falla si el envío del email falla: solo se loguea, el usuario
    // puede pedir reenvío después (POST /usuarios/reenviar-verificacion).
    if (guardado.email) {
      try {
        const token = this.generarTokenVerificacion(guardado.id);
        await this.emailVerificacion.enviarVerificacion(
          guardado.email,
          guardado.nombre,
          token,
        );
      } catch (err) {
        this.logger.warn(
          `No se pudo enviar verificación a ${guardado.email}: ${err}`,
        );
      }
    }

    return guardado;
  }

  // Mismo mecanismo JWT que el QR de acceso (mismo JWT_SECRET), con
  // tipo propio para que no se confunda con otro tipo de token.
  generarTokenVerificacion(usuarioId: string): string {
    return this.jwtService.sign(
      { sub: usuarioId, tipo: 'email-verificacion' },
      { expiresIn: '24h' },
    );
  }

  async verificarEmail(token: string): Promise<{ verificado: boolean }> {
    let payload: { sub: string; tipo: string };
    try {
      payload = this.jwtService.verify<{ sub: string; tipo: string }>(token);
    } catch (err) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw new BadRequestException(
          'El link expiró, pedí uno nuevo con reenviar-verificacion',
        );
      }
      throw new BadRequestException('Token inválido');
    }
    if (payload.tipo !== 'email-verificacion') {
      throw new BadRequestException('Token inválido');
    }
    const usuario = await this.usuariosRepo.findOne({
      where: { id: payload.sub },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado');
    }
    if (!usuario.emailVerificado) {
      usuario.emailVerificado = true;
      await this.usuariosRepo.save(usuario);
    }
    return { verificado: true };
  }

  async reenviarVerificacion(email: string): Promise<{ message: string }> {
    const generico = {
      message: 'Si el email existe, te enviamos un nuevo link',
    };
    const usuario = await this.usuariosRepo.findOne({ where: { email } });
    // Respuesta idéntica exista o no el email / esté o no verificado:
    // no revelar usuarios registrados (evita enumeración).
    if (!usuario || usuario.emailVerificado || !usuario.email) {
      return generico;
    }
    try {
      const token = this.generarTokenVerificacion(usuario.id);
      await this.emailVerificacion.enviarVerificacion(
        usuario.email,
        usuario.nombre,
        token,
      );
    } catch (err) {
      this.logger.warn(
        `No se pudo reenviar verificación a ${email}: ${err}`,
      );
    }
    return generico;
  }

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Usuario>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // passwordHash no viene igual, porque en la entidad tiene select:false.
    const [data, total] = await this.usuariosRepo.findAndCount({
      relations: { sede: true },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }
  // Lista solo el personal interno (RECEPCIONISTA/GERENTE), con su sede
  // cargada, para el panel de "Personal" del Gerente.
  async findStaff(
    query: PaginationQueryDto,
  ): Promise<PaginatedResponse<Usuario>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [data, total] = await this.usuariosRepo.findAndCount({
      where: [
        { tipoActor: TipoActor.RECEPCIONISTA },
        { tipoActor: TipoActor.GERENTE },
      ],
      relations: { sede: true },
      order: { creadoEn: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // Reasigna la sede de un Recepcionista. No aplica a Gerente (no tiene
  // sede fija) ni a Socio/Externo (no corresponde).
  async asignarSede(usuarioId: string, sedeId: string): Promise<Usuario> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    if (usuario.tipoActor !== TipoActor.RECEPCIONISTA) {
      throw new BadRequestException(
        'Solo se puede asignar sede a un Recepcionista',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    usuario.sede = { id: sedeId } as any;
    await this.usuariosRepo.save(usuario);
    return this.findOne(usuarioId); // recarga con la relación sede ya poblada
  }

  // Actualiza solo el DNI (endpoint dedicado, solo GERENTE). El PATCH
  // general lo rechaza con 400 por ser campo sensible.
  async actualizarDni(usuarioId: string, dni: string): Promise<Usuario> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    const existente = await this.usuariosRepo.findOne({ where: { dni } });
    if (existente && existente.id !== usuarioId) {
      throw new ConflictException('Ese DNI ya está registrado por otro usuario');
    }

    usuario.dni = dni;
    await this.usuariosRepo.save(usuario);
    return this.findOne(usuarioId);
  }
  async findOne(id: string): Promise<Usuario> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id },
      relations: { sede: true },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
    return usuario;
  }

  // Usado por el futuro AuthModule para el login: ahí SÍ necesitamos el hash.
  async findByEmailConPassword(email: string): Promise<Usuario | null> {
    return this.usuariosRepo.findOne({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        tipoActor: true,
        nombre: true,
        apellido: true,
        activo: true,
        emailVerificado: true,
      },
      relations: { sede: true },
    });
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    // Asignación explícita campo por campo (nunca spread del DTO): si en el
    // futuro alguien agrega un campo sensible al DTO, no se aplica solo.
    if (dto.nombre !== undefined) usuario.nombre = dto.nombre;
    if (dto.apellido !== undefined) usuario.apellido = dto.apellido;
    if (dto.email !== undefined) usuario.email = dto.email;
    if (dto.telefono !== undefined) usuario.telefono = dto.telefono;
    if (dto.fotoUrl !== undefined) usuario.fotoUrl = dto.fotoUrl;
    return this.usuariosRepo.save(usuario);
  }

  async assignRole(id: string, dto: AssignRoleDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    usuario.tipoActor = dto.tipoActor;
    usuario.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.usuariosRepo.save(usuario);
  }

  async actualizarFoto(
    id: string,
    foto: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
  ): Promise<Usuario> {
    const usuario = await this.findOne(id);
    usuario.fotoUrl = await this.storageService.subirArchivo(
      this.config.getOrThrow<string>('SUPABASE_BUCKET_FOTOS'),
      foto.buffer,
      foto.originalname.split('.').pop() ?? 'jpg',
      foto.mimetype,
    );
    return this.usuariosRepo.save(usuario);
  }

  async changePassword(
    id: string,
    passwordActual: string,
    password: string,
  ): Promise<void> {
    // El hash tiene select:false, hay que pedirlo explícito (igual que en el login).
    const usuario = await this.usuariosRepo.findOne({
      where: { id },
      select: { id: true, passwordHash: true },
    });
    if (!usuario) {
      throw new NotFoundException(`Usuario ${id} no encontrado`);
    }
    const coincide =
      !!usuario.passwordHash &&
      (await bcrypt.compare(passwordActual, usuario.passwordHash));
    if (!coincide) {
      throw new BadRequestException('La contraseña actual no es correcta');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await this.usuariosRepo.update(id, { passwordHash });
  }

  async remove(id: string): Promise<void> {
    const usuario = await this.findOne(id);
    // Baja lógica: un usuario con membresías/reservas/pagos asociados
    // no se puede borrar físicamente sin romper integridad referencial.
    usuario.activo = false;
    await this.usuariosRepo.save(usuario);
  }
}
