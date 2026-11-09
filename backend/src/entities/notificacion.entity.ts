import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { EnvioNotificacion } from './envio-notificacion.entity';

// Una fila por destinatario (campanita del Socio). `tipo` es texto con un
// CHECK en la base (ver db/sql/006-notificaciones.sql), no un enum de Postgres,
// para poder sumar tipos sin ALTER TYPE.
@Entity('notificaciones')
@Index('idx_notificaciones_usuario', ['usuario', 'leidaEn', 'creadaEn'])
export class Notificacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Usuario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Usuario;

  @Column({ length: 40 })
  tipo!: string;

  @Column({ length: 120 })
  titulo!: string;

  @Column({ length: 1000 })
  mensaje!: string;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @Column({ name: 'leida_en', type: 'timestamptz', nullable: true })
  leidaEn?: Date | null;

  @ManyToOne(() => EnvioNotificacion, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'envio_id' })
  envio?: EnvioNotificacion | null;
}
