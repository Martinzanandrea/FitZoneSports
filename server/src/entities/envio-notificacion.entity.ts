import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Sede } from './sede.entity';

// Un aviso enviado por el Gerente General a una audiencia de Socios.
@Entity('envios_notificacion')
export class EnvioNotificacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  titulo!: string;

  @Column({ length: 1000 })
  mensaje!: string;

  @Column({ length: 30 })
  audiencia!: string;

  @ManyToOne(() => Sede, { nullable: true })
  @JoinColumn({ name: 'sede_id' })
  sede?: Sede | null;

  // Destinatario puntual (audiencia SOCIO).
  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario | null;

  // 'PANEL', 'EMAIL' o 'PANEL,EMAIL'.
  @Column({ type: 'simple-array' })
  canales!: string[];

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'creado_por_id' })
  creadoPor!: Usuario;

  @CreateDateColumn({ name: 'creada_en', type: 'timestamptz' })
  creadaEn!: Date;

  @Column({ name: 'total_destinatarios', type: 'int', default: 0 })
  totalDestinatarios!: number;

  @Column({ name: 'emails_enviados', type: 'int', default: 0 })
  emailsEnviados!: number;

  @Column({ name: 'emails_fallidos', type: 'int', default: 0 })
  emailsFallidos!: number;
}
