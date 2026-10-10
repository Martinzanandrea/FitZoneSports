import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, type FindOptionsWhere } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { EmailVerificacionService } from './email-verificacion.service';
import { Sede, TipoActor, Usuario } from '../entities';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ConfigService } from '@nestjs/config';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { escaparLike } from '../common/helpers/like.helper';
import { assertAccesoPerfil } from '../auth/helpers/ownership.helper';
import { conflictoPorUnique } from '../common/helpers/db-errors.helper';

const MSG_DNI_DUPLICADO = 'Ya existe un usuario registrado con ese DNI';
const MSG_EMAIL_DUPLICADO = 'Ya existe un usuario registrado con ese email';
// Roles que se dan de alta desde el panel de personal. SOCIO y EXTERNO se
// registran solos; un SOCIO nace de pagar una membresía (ADR 0011).
const ROLES_ALTA_STAFF: TipoActor[] = [
  TipoActor.RECEPCIONISTA,
  TipoActor.GERENTE_SEDE,
  TipoActor.GERENTE_GENERAL,
];

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

  // Chequeo previo (mensaje claro, y antes de subir la foto). La carrera entre
  // dos altas simultáneas la cierra el UNIQUE de la base: ver guardarUnico.
  private async asegurarUnicos(
    datos: { dni?: string | null; email?: string | null },
    excluirId?: string,
  ): Promise<void> {
    const condiciones: FindOptionsWhere<Usuario>[] = [];
    if (datos.dni) condiciones.push({ dni: datos.dni });
    if (datos.email) condiciones.push({ email: datos.email });
    if (!condiciones.length) return;
    const existentes = await this.usuariosRepo.find({
      where: condiciones,
      select: { id: true, dni: true, email: true },
    });
    for (const u of existentes) {
      if (u.id === excluirId) continue;
      if (datos.dni && u.dni === datos.dni) {
        throw new ConflictException(MSG_DNI_DUPLICADO);
      }
      if (datos.email && u.email === datos.email) {
        throw new ConflictException(MSG_EMAIL_DUPLICADO);
      }
    }
  }

  // save() que traduce una violación de UNIQUE (carrera) a 409 en vez de 500.
  private async guardarUnico(usuario: Usuario): Promise<Usuario> {
    try {
      return await this.usuariosRepo.save(usuario);
    } catch (err) {
      throw (
        conflictoPorUnique(err, {
          dni: MSG_DNI_DUPLICADO,
          email: MSG_EMAIL_DUPLICADO,
        }) ?? err
      );
    }
  }

  // Registro público (sin login). Nunca confía en el rol del body: todo el
  // mundo nace EXTERNO y pasa a SOCIO recién al pagar una membresía (ADR 0011).
  // Tampoco acepta sede: sin esto cualquiera podría registrarse como gerente.
  registrarPublico(
    dto: CreateUsuarioDto,
    foto?: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<Usuario> {
    return this.create(
      { ...dto, tipoActor: TipoActor.EXTERNO, sedeId: undefined },
      foto,
    );
  }

  async create(
    dto: CreateUsuarioDto,
    foto?: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
  ): Promise<Usuario> {
    const { password, sedeId, ...resto } = dto;
    // GERENTE_SEDE opera con scope a una sede (ver assertSedeScope):
    // sin sede asignada no podría operar nada, así que se exige acá.
    if (dto.tipoActor === TipoActor.GERENTE_SEDE && !sedeId) {
      throw new BadRequestException(
        'sedeId es obligatorio para un GERENTE_SEDE',
      );
    }
    await this.asegurarUnicos({ dni: dto.dni, email: dto.email });
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

    const guardado = await this.guardarUnico(usuario);

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
        // Solo el id y el tipo de error: el mensaje del SMTP puede traer el email.
        this.logger.warn(
          `No se pudo enviar verificación al usuario ${guardado.id} (${err instanceof Error ? err.name : 'error'})`,
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
        `No se pudo reenviar verificación al usuario ${usuario.id} (${err instanceof Error ? err.name : 'error'})`,
      );
    }
    return generico;
  }

  // Scope de Gerente de Sede: solo puede operar sobre recepcionistas
  // de SU sede. Fail-closed: sin sede propia o con otro rol/sede → 403.
  private exigirRecepcionistaDeSede(
    actor: UsuarioAutenticado,
    usuario: Usuario,
  ): void {
    if (!actor.sedeId) {
      throw new ForbiddenException('No tenés sede asignada');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esRecepcionista = usuario.tipoActor === TipoActor.RECEPCIONISTA;
    if (!esRecepcionista || usuario.sede?.id !== actor.sedeId) {
      throw new ForbiddenException(
        'Solo podés operar sobre recepcionistas de tu sede',
      );
    }
  }

  // Alta de staff con reglas por rol: GG crea cualquier tipo; GS solo
  // RECEPCIONISTA y siempre en su propia sede (sedeId forzado).
  async crearStaff(
    dto: CreateUsuarioDto,
    actor: UsuarioAutenticado,
  ): Promise<Usuario> {
    if (!ROLES_ALTA_STAFF.includes(dto.tipoActor)) {
      throw new BadRequestException(
        'Por acá solo se dan de alta Recepcionistas y Gerentes',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (actor.tipoActor === TipoActor.GERENTE_SEDE) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      if (dto.tipoActor !== TipoActor.RECEPCIONISTA) {
        throw new ForbiddenException('Solo podés dar de alta Recepcionistas');
      }
      if (!actor.sedeId) {
        throw new ForbiddenException('No tenés sede asignada');
      }
      if (dto.sedeId && dto.sedeId !== actor.sedeId) {
        throw new ForbiddenException(
          'Solo podés dar de alta en tu propia sede',
        );
      }
      return this.create({ ...dto, sedeId: actor.sedeId });
    }
    return this.create(dto);
  }

  async findAll(
    query: PaginationQueryDto,
    actor?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Usuario>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esGS = actor?.tipoActor === TipoActor.GERENTE_SEDE;
    // GS: solo recepcionistas de su sede + socios/externos (sin sede
    // propia). GG: todo, como antes.
    const where: FindOptionsWhere<Usuario>[] | undefined = esGS
      ? actor?.sedeId
        ? [
            { tipoActor: TipoActor.SOCIO },
            { tipoActor: TipoActor.EXTERNO },
            {
              tipoActor: TipoActor.RECEPCIONISTA,
              sede: { id: actor.sedeId },
            },
          ]
        : undefined
      : undefined;
    if (esGS && !where) {
      throw new ForbiddenException('No tenés sede asignada');
    }
    // passwordHash no viene igual, porque en la entidad tiene select:false.
    const [data, total] = await this.usuariosRepo.findAndCount({
      ...(where ? { where } : {}),
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
  // Lista el personal interno con su sede cargada. GG ve todo
  // (incluidos GERENTE_SEDE); GS ve solo recepcionistas de su sede.
  async findStaff(
    query: PaginationQueryDto,
    actor?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Usuario>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const esGS = actor?.tipoActor === TipoActor.GERENTE_SEDE;
    if (esGS) {
      if (!actor?.sedeId) {
        throw new ForbiddenException('No tenés sede asignada');
      }
      const [data, total] = await this.usuariosRepo.findAndCount({
        where: [
          {
            tipoActor: TipoActor.RECEPCIONISTA,
            sede: { id: actor.sedeId },
          },
        ],
        relations: { sede: true },
        // Activos primero, bajas al final; luego apellido y nombre (sobre el total, no por página).
        order: { activo: 'DESC', apellido: 'ASC', nombre: 'ASC', id: 'ASC' },
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
    const [data, total] = await this.usuariosRepo.findAndCount({
      where: [
        { tipoActor: TipoActor.RECEPCIONISTA },
        { tipoActor: TipoActor.GERENTE_GENERAL },
        { tipoActor: TipoActor.GERENTE_SEDE },
      ],
      relations: { sede: true },
      // Activos primero, bajas al final; luego apellido y nombre (sobre el total, no por página).
      order: { activo: 'DESC', apellido: 'ASC', nombre: 'ASC', id: 'ASC' },
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

  // Reasigna la sede. Solo la llama GG (el endpoint es GG-only):
  // vale para Recepcionistas y para Gerentes de Sede. No aplica a
  // GERENTE_GENERAL (sin sede fija) ni a Socio/Externo.
  async asignarSede(usuarioId: string, sedeId: string): Promise<Usuario> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    const reubicable =
      usuario.tipoActor === TipoActor.RECEPCIONISTA ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
      usuario.tipoActor === TipoActor.GERENTE_SEDE;
    if (!reubicable) {
      throw new BadRequestException(
        'Solo se puede asignar sede a un Recepcionista o Gerente de Sede',
      );
    }

    if (!usuario.activo) {
      throw new BadRequestException(
        'No se puede asignar sede a un usuario dado de baja',
      );
    }
    // Validar antes de guardar: una sede inexistente rompería la FK (500) en vez de un 404 claro.
    const sedeExiste = await this.usuariosRepo.manager.exists(Sede, {
      where: { id: sedeId },
    });
    if (!sedeExiste) {
      throw new NotFoundException(`Sede ${sedeId} no encontrada`);
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    usuario.sede = { id: sedeId } as any;
    await this.usuariosRepo.save(usuario);
    return this.findOne(usuarioId); // recarga con la relación sede ya poblada
  }

  // Actualiza solo el DNI (endpoint dedicado). GG sobre cualquiera;
  // GS solo sobre recepcionistas de su sede. El PATCH general lo
  // rechaza con 400 por ser campo sensible.
  async actualizarDni(
    usuarioId: string,
    dni: string,
    actor?: UsuarioAutenticado,
  ): Promise<Usuario> {
    const usuario = await this.usuariosRepo.findOne({
      where: { id: usuarioId },
      relations: { sede: true },
    });
    if (!usuario)
      throw new NotFoundException(`Usuario ${usuarioId} no encontrado`);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (actor?.tipoActor === TipoActor.GERENTE_SEDE) {
      this.exigirRecepcionistaDeSede(actor, usuario);
    }

    const existente = await this.usuariosRepo.findOne({ where: { dni } });
    if (existente && existente.id !== usuarioId) {
      throw new ConflictException(
        'Ese DNI ya está registrado por otro usuario',
      );
    }

    usuario.dni = dni;
    await this.guardarUnico(usuario);
    return this.findOne(usuarioId);
  }
  // Lectura/edición de perfil con matriz por rol (REGLAS GERENTE_SEDE):
  // propio siempre, GG todo, GS recepcionistas propios + clientes,
  // RECEPCIONISTA solo propio. No usar findOne crudo en endpoints.
  async leerPerfil(id: string, actor: UsuarioAutenticado): Promise<Usuario> {
    const usuario = await this.findOne(id);
    assertAccesoPerfil(actor, usuario);
    return usuario;
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

  async update(
    id: string,
    dto: UpdateUsuarioDto,
    actor: UsuarioAutenticado,
  ): Promise<Usuario> {
    const usuario = await this.findOne(id);
    assertAccesoPerfil(actor, usuario);
    // Asignación explícita campo por campo (nunca spread del DTO): si en el
    // futuro alguien agrega un campo sensible al DTO, no se aplica solo.
    if (dto.nombre !== undefined) usuario.nombre = dto.nombre;
    if (dto.apellido !== undefined) usuario.apellido = dto.apellido;
    if (dto.email !== undefined && dto.email !== usuario.email) {
      await this.asegurarUnicos({ email: dto.email }, id);
      usuario.email = dto.email;
    }
    if (dto.telefono !== undefined) usuario.telefono = dto.telefono;
    if (dto.fotoUrl !== undefined) usuario.fotoUrl = dto.fotoUrl;
    return this.guardarUnico(usuario);
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
    actor: UsuarioAutenticado,
  ): Promise<Usuario> {
    const usuario = await this.findOne(id);
    assertAccesoPerfil(actor, usuario);
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

  async remove(id: string, actor?: UsuarioAutenticado): Promise<void> {
    const usuario = await this.findOne(id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (actor?.tipoActor === TipoActor.GERENTE_SEDE) {
      this.exigirRecepcionistaDeSede(actor, usuario);
    }
    // Baja lógica: un usuario con membresías/reservas/pagos asociados
    // no se puede borrar físicamente sin romper integridad referencial.
    usuario.activo = false;
    await this.usuariosRepo.save(usuario);
  }

  // Búsqueda para el mostrador (recepción): solo SOCIO y EXTERNO, con
  // campos mínimos (nunca personal ni emails/teléfonos). Mínimo 3
  // caracteres, máximo 20 resultados.
  async buscarClientes(
    q: string,
  ): Promise<
    Pick<Usuario, 'id' | 'nombre' | 'apellido' | 'dni' | 'tipoActor'>[]
  > {
    const texto = (q ?? '').trim();
    if (texto.length < 3) {
      throw new BadRequestException(
        'La búsqueda requiere al menos 3 caracteres',
      );
    }
    return this.usuariosRepo
      .createQueryBuilder('u')
      .select(['u.id', 'u.nombre', 'u.apellido', 'u.dni', 'u.tipoActor'])
      .where('u.tipoActor IN (:...roles)', {
        roles: [TipoActor.SOCIO, TipoActor.EXTERNO],
      })
      .andWhere('u.activo = true')
      .andWhere(
        '(u.nombre ILIKE :q OR u.apellido ILIKE :q OR u.dni ILIKE :q)',
        { q: `%${escaparLike(texto)}%` },
      )
      .orderBy('u.apellido', 'ASC')
      .addOrderBy('u.nombre', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .take(20)
      .getMany();
  }
}
