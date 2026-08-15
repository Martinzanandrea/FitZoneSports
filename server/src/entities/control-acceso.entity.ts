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
import { Sede } from './sede.entity';

@Entity('control_acceso')
// RN01: un usuario no puede estar en 2 sedes a la vez.
// Índice único PARCIAL: solo puede existir una fila sin hora_egreso por usuario.
@Index('uq_acceso_abierto_por_usuario', ['usuario'], {
  unique: true,
  where: '"hora_egreso" IS NULL',
})
// Acelera el cálculo de aforo actual por sede (RNF03).
@Index('idx_acceso_sede_abiertos', ['sede'], {
  where: '"hora_egreso" IS NULL',
})
export class ControlAcceso {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario, (usuario) => usuario.controlesAcceso, {
    nullable: false,
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @ManyToOne(() => Sede, (sede) => sede.controlesAcceso, { nullable: false })
  @JoinColumn({ name: 'sede_id' })
  sede: Sede;

  @CreateDateColumn({ name: 'hora_ingreso', type: 'timestamptz' })
  horaIngreso: Date;

  // NULL = el usuario sigue "dentro" de la sede.
  @Column({ name: 'hora_egreso', type: 'timestamptz', nullable: true })
  horaEgreso?: Date;

  // true si el QR se validó offline (RNF01) y este registro se sincronizó después.
  @Column({ name: 'validado_offline', default: false })
  validadoOffline: boolean;

  @Column({ name: 'sincronizado_en', type: 'timestamptz', nullable: true })
  sincronizadoEn?: Date;
}
