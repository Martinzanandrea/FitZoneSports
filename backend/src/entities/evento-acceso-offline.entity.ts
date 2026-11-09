import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Usuario } from './usuario.entity';
import { Sede } from './sede.entity';
import { ControlAcceso } from './control-acceso.entity';

// Evento de acceso registrado por un terminal sin conexión y enviado después.
// client_event_id lo genera el terminal: hace idempotente el reenvío.
@Entity('eventos_acceso_offline')
// Un mismo QR no puede registrarse dos veces desde terminales distintos.
@Index('uq_evento_offline_jti', ['qrJti'], {
  unique: true,
  where: '"qr_jti" IS NOT NULL',
})
export class EventoAccesoOffline {
  @PrimaryColumn('uuid', { name: 'client_event_id' })
  clientEventId!: string;

  @ManyToOne(() => Sede, { nullable: false })
  @JoinColumn({ name: 'sede_id' })
  sede!: Sede;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario | null;

  @Column({ name: 'qr_jti', type: 'uuid', nullable: true })
  qrJti?: string | null;

  @Column({ name: 'ocurrido_en', type: 'timestamptz' })
  ocurridoEn!: Date;

  @Column({
    name: 'recibido_en',
    type: 'timestamptz',
    default: () => 'now()',
    insert: false,
    update: false,
  })
  recibidoEn!: Date;

  @Column({ type: 'varchar', length: 12 })
  estado!: string;

  @Column({ type: 'varchar', length: 40 })
  codigo!: string;

  @Column({ type: 'text', nullable: true })
  mensaje?: string | null;

  @ManyToOne(() => ControlAcceso, { nullable: true })
  @JoinColumn({ name: 'acceso_id' })
  acceso?: ControlAcceso | null;
}
