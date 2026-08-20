import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Check,
  Index,
} from 'typeorm';
import { Sede } from './sede.entity';
import { Instructor } from './instructor.entity';
import { ReservaClase } from './reserva-clase.entity';

@Entity('clases')
@Check('chk_horario_clase', `"horario_fin" > "horario_inicio"`)
@Index('idx_clases_sede_horario', ['sede', 'horarioInicio'])
export class Clase {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Sede, (sede) => sede.clases, { nullable: false })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @Column({ name: 'tipo_clase', length: 80 })
  tipoClase!: string;

  @ManyToOne(() => Instructor, (instructor) => instructor.clases, {
    nullable: false,
  })
  @JoinColumn({ name: 'instructor_id' })
  instructor!: Instructor;

  @Column({ name: 'horario_inicio', type: 'timestamptz' })
  horarioInicio!: Date;

  @Column({ name: 'horario_fin', type: 'timestamptz' })
  horarioFin!: Date;

  @Column('int')
  capacidad!: number;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @OneToMany(() => ReservaClase, (reserva) => reserva.clase)
  reservas!: ReservaClase[];
}
