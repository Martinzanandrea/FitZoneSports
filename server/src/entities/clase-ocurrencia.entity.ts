import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Clase } from './clase.entity';
import { ReservaClase } from './reserva-clase.entity';
import { EstadoOcurrenciaClase } from './enums';

// Una edición concreta de una clase en una fecha (la "instancia" que
// se reserva y a la que se asiste). Se genera desde la grilla semanal.
@Entity('clase_ocurrencia')
export class ClaseOcurrencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Clase, (clase) => clase.ocurrencias, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clase_id' })
  clase!: Clase;

  @Column({ type: 'date' })
  fecha!: string;

  @Column({ name: 'hora_inicio', type: 'time' })
  horaInicio!: string;

  @Column({ name: 'hora_fin', type: 'time' })
  horaFin!: string;

  @Column({
    type: 'enum',
    enum: EstadoOcurrenciaClase,
    enumName: 'estado_ocurrencia_clase',
    default: EstadoOcurrenciaClase.PROGRAMADA,
  })
  estado!: EstadoOcurrenciaClase;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @OneToMany(() => ReservaClase, (reserva) => reserva.ocurrencia)
  reservas!: ReservaClase[];
}
