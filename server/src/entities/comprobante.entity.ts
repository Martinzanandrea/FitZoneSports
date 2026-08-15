import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Pago } from './pago.entity';

@Entity('comprobantes')
export class Comprobante {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // @JoinColumn en el lado dueño de la FK + unique:true en la columna
  // es lo que convierte esta relación en 1:1 real (en vez de 1:N).
  @OneToOne(() => Pago, (pago) => pago.comprobante, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pago_id' })
  pago: Pago;

  @Column({ name: 'pdf_path', type: 'text' })
  pdfPath: string;

  @CreateDateColumn({ name: 'generado_en', type: 'timestamptz' })
  generadoEn: Date;
}
