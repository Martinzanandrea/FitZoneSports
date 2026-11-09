import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Instructor } from '../entities';
import { TipoActor } from '../entities/enums';
import type { UsuarioAutenticado } from '../auth/types/usuario-autenticado.type';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import type { PaginatedResponse } from '../common/types/paginated-response.type';
import { CreateInstructorDto } from './dto/create-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';

export interface InstructorVistaReducida {
  id: string;
  nombre: string;
  especialidad: string | null;
}

function verVistaCompleta(user?: UsuarioAutenticado): boolean {
  return (
    user?.tipoActor === TipoActor.GERENTE_GENERAL ||
    user?.tipoActor === TipoActor.GERENTE_SEDE
  );
}

function vistaReducida(i: Instructor): InstructorVistaReducida {
  return {
    id: i.id,
    nombre: i.nombre,
    especialidad: i.especialidad ?? null,
  };
}

@Injectable()
export class InstructoresService {
  constructor(
    @InjectRepository(Instructor)
    private readonly instructoresRepo: Repository<Instructor>,
  ) {}

  // Instructor es global (sin sede): un GS editándolo afecta a todas
  // las sedes. Por eso `activo` es solo GG: un no-GG que lo envíe
  // recibe 403. Nombre, especialidad y teléfono siguen para GG y GS.
  create(
    dto: CreateInstructorDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Instructor> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (
      currentUser &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL &&
      dto.activo !== undefined
    ) {
      throw new ForbiddenException(
        'Solo GERENTE_GENERAL puede activar o desactivar un instructor',
      );
    }
    const instructor = this.instructoresRepo.create(dto);
    return this.instructoresRepo.save(instructor);
  }

  // Los gerentes ven la entidad completa (incluye teléfono y estado). Todos los
  // demás (Socio, Externo, Recepcionista) reciben solo id, nombre y especialidad
  // de los instructores ACTIVOS: el teléfono es un dato personal del instructor.
  // La entidad no tiene apellido; el nombre completo va en `nombre`.
  async findAll(
    query: PaginationQueryDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<PaginatedResponse<Instructor | InstructorVistaReducida>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const completa = verVistaCompleta(currentUser);
    const [data, total] = await this.instructoresRepo.findAndCount({
      ...(completa ? {} : { where: { activo: true } }),
      order: { nombre: 'ASC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: completa ? data : data.map(vistaReducida),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findOneVisible(
    id: string,
    currentUser?: UsuarioAutenticado,
  ): Promise<Instructor | InstructorVistaReducida> {
    const instructor = await this.findOne(id);
    if (verVistaCompleta(currentUser)) return instructor;
    if (!instructor.activo) {
      throw new NotFoundException(`Instructor ${id} no encontrado`);
    }
    return vistaReducida(instructor);
  }

  async findOne(id: string): Promise<Instructor> {
    const instructor = await this.instructoresRepo.findOne({ where: { id } });
    if (!instructor) {
      throw new NotFoundException(`Instructor ${id} no encontrado`);
    }
    return instructor;
  }

  async update(
    id: string,
    dto: UpdateInstructorDto,
    currentUser?: UsuarioAutenticado,
  ): Promise<Instructor> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    if (
      currentUser &&
      currentUser.tipoActor !== TipoActor.GERENTE_GENERAL &&
      dto.activo !== undefined
    ) {
      throw new ForbiddenException(
        'Solo GERENTE_GENERAL puede activar o desactivar un instructor',
      );
    }
    const instructor = await this.findOne(id);
    Object.assign(instructor, dto);
    return this.instructoresRepo.save(instructor);
  }

  async remove(id: string): Promise<void> {
    const instructor = await this.findOne(id);
    instructor.activo = false;
    await this.instructoresRepo.save(instructor);
  }
}
