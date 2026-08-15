import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';
import { Clase } from './clase.entity';
import { Usuario } from './usuario.entity';
import { Pago } from './pago.entity';
import { EstadoResClase } from './enums';

// Tabla puente N:M (usuarios <-> clases) con atributos propios.
// El UNIQUE(clase, usuario) evita doble anotación a la misma clase.
@Entity('reservas_clase')
@Unique('uq_reserva_usuario_clase', ['clase', 'usuario'])
@Index('idx_reservas_clase_estado', ['clase', 'estado', 'creadaEn'])
export class ReservaClase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Clase, (clase) => clase.reservas, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clase_id' })
  clase: Clase;

  @ManyToOne(() => Usuario, (usuario) => usuario.reservasClase, {
    nullable: false,
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({
    type: 'enum',
    enum: EstadoResClase,
    enumName: 'estado_res_clase',
    default: EstadoResClase.RESERVADA,
  })
  estado: EstadoResClase;

  // true cuando el Observer ya notificó al usuario que se liberó un cupo.
  @Column({ default: false })
  notificado: boolean;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn: Date;

  @Column({ name: 'cancelada_en', type: 'timestamptz', nullable: true })
  canceladaEn?: Date;

  @OneToMany(() => Pago, (pago) => pago.reservaClase)
  pagos: Pago[];
}
