import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Usuario } from '../entities';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const SALT_ROUNDS = 10; // "costo" del hasheo: más alto = más lento pero más seguro. 10 es el estándar razonable hoy.

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
  ) {}

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    const { password, sedeId, ...resto } = dto;

    const usuario = this.usuariosRepo.create({
      ...resto,
      sede: sedeId ? { id: sedeId } : undefined,
      passwordHash: await bcrypt.hash(password, SALT_ROUNDS),
    });

    return this.usuariosRepo.save(usuario);
  }

  findAll(): Promise<Usuario[]> {
    // passwordHash no viene igual, porque en la entidad tiene select:false.
    return this.usuariosRepo.find({ relations: { sede: true } });
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
