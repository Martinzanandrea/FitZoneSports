import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Clase } from './clase.entity';

@Entity('instructores')
export class Instructor {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  nombre!: string;

  @Column({ length: 120, nullable: true })
  especialidad?: string;

  @Column({ length: 30, nullable: true })
  telefono?: string;

  @Column({ default: true })
  activo!: boolean;

  @OneToMany(() => Clase, (clase) => clase.instructor)
  clases!: Clase[];
}
