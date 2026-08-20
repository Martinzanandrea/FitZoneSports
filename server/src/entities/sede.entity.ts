import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Membresia } from './membresia.entity';
import { ControlAcceso } from './control-acceso.entity';
import { Clase } from './clase.entity';
import { Cancha } from './cancha.entity';

@Entity('sedes')
export class Sede {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ length: 255 })
  direccion!: string;

  @Column('int', { name: 'aforo_maximo' })
  aforoMaximo!: number;

  @Column({ default: true })
  activa!: boolean;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  // --- Relaciones 1:N (lado "1") ---
  @OneToMany(() => Usuario, (usuario) => usuario.sede)
  usuarios!: Usuario[];

  @OneToMany(() => Membresia, (membresia) => membresia.sedeAlta)
  membresias!: Membresia[];

  @OneToMany(() => ControlAcceso, (acceso) => acceso.sede)
  controlesAcceso!: ControlAcceso[];

  @OneToMany(() => Clase, (clase) => clase.sede)
  clases!: Clase[];

  @OneToMany(() => Cancha, (cancha) => cancha.sede)
  canchas!: Cancha[];
}
