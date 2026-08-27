import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TipoActor, Usuario } from '../entities';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { SupabaseStorageService } from '../storage/supabase-storage.service';
import { ConfigService } from '@nestjs/config';

const SALT_ROUNDS = 10; // "costo" del hasheo: más alto = más lento pero más seguro. 10 es el estándar razonable hoy.

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly storageService: SupabaseStorageService,
    private readonly config: ConfigService,
  ) {}

  async create(
    dto: CreateUsuarioDto,
    foto?: Express.Multer.File,
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

    return this.usuariosRepo.save(usuario);
  }

  findAll(): Promise<Usuario[]> {
    // passwordHash no viene igual, porque en la entidad tiene select:false.
    return this.usuariosRepo.find({ relations: { sede: true } });
  }
  // Lista solo el personal interno (RECEPCIONISTA/GERENTE), con su sede
  // cargada, para el panel de "Personal" del Gerente.
  findStaff(): Promise<Usuario[]> {
    return this.usuariosRepo.find({
      where: [
        { tipoActor: TipoActor.RECEPCIONISTA },
        { tipoActor: TipoActor.GERENTE },
      ],
      relations: { sede: true },
      order: { creadoEn: 'DESC' },
    });
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
      },
      relations: { sede: true },
    });
  }

  async update(id: string, dto: UpdateUsuarioDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    const { sedeId, ...resto } = dto;
    Object.assign(usuario, resto);
    if (sedeId !== undefined) {
      usuario.sede = sedeId ? ({ id: sedeId } as any) : undefined;
    }
    return this.usuariosRepo.save(usuario);
  }

  async assignRole(id: string, dto: AssignRoleDto): Promise<Usuario> {
    const usuario = await this.findOne(id);
    usuario.tipoActor = dto.tipoActor;
    usuario.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.usuariosRepo.save(usuario);
  }

  async changePassword(id: string, password: string): Promise<void> {
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
