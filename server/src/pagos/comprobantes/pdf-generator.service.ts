import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Pago } from '../../entities';

const COLOR_NAVY = '#1e2a5e';
const COLOR_CORAL = '#ff6b6b';
const COLOR_GRAY = '#6b7280';
const COLOR_LIGHT_GRAY = '#f3f4f6';

@Injectable()
export class PdfGeneratorService {
  generarComprobantePago(pago: Pago): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 0 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.dibujarContenido(doc, pago);

      doc.end();
    });
  }

  private dibujarContenido(doc: PDFKit.PDFDocument, pago: Pago): void {
    const pageWidth = doc.page.width;
    const marginX = 50;

    this.dibujarHeader(doc, pago, pageWidth);

    let y = 160;

    y = this.dibujarSeccionTitulo(doc, 'Datos del cliente', marginX, y);
    y = this.dibujarFila(
      doc,
      'Cliente',
      `${pago.usuario.nombre} ${pago.usuario.apellido}`,
      marginX,
      y,
    );
    y = this.dibujarFila(doc, 'DNI', pago.usuario.dni ?? '-', marginX, y);
    y = this.dibujarFila(doc, 'Email', pago.usuario.email ?? '-', marginX, y);

    y += 15;
    y = this.dibujarSeccionTitulo(doc, 'Detalle del pago', marginX, y);
    y = this.dibujarFila(
      doc,
      'Concepto',
      this.describirConcepto(pago),
      marginX,
      y,
    );
    y = this.dibujarFila(
      doc,
      'Método de pago',
      this.describirMetodo(pago.metodo),
      marginX,
      y,
    );
    y = this.dibujarFila(doc, 'Estado', pago.estado, marginX, y);
    if (pago.metodo === 'EFECTIVO' && pago.registradoPor) {
      y = this.dibujarFila(
        doc,
        'Registrado por',
        `${pago.registradoPor.nombre} ${pago.registradoPor.apellido}`,
        marginX,
        y,
      );
    }

    y += 25;
    this.dibujarMontoDestacado(doc, pago, marginX, y, pageWidth - marginX * 2);

    this.dibujarFooter(doc, pageWidth, doc.page.height);
  }

  private dibujarHeader(
    doc: PDFKit.PDFDocument,
    pago: Pago,
    pageWidth: number,
  ): void {
    // Banda superior de color
    doc.rect(0, 0, pageWidth, 120).fill(COLOR_NAVY);

    doc
      .fillColor('#ffffff')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('FitZone Sports', 50, 35);

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#c7d2fe')
      .text('Comprobante de pago', 50, 65);

    // Datos del comprobante, alineados a la derecha
    doc
      .fontSize(9)
      .fillColor('#ffffff')
      .text(`N° ${pago.id.slice(0, 8).toUpperCase()}`, pageWidth - 250, 40, {
        width: 200,
        align: 'right',
      })
      .fillColor('#c7d2fe')
      .text(
        (pago.pagadoEn ?? pago.creadoEn).toLocaleString('es-AR', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        pageWidth - 250,
        55,
        { width: 200, align: 'right' },
      );
  }

  private dibujarSeccionTitulo(
    doc: PDFKit.PDFDocument,
    titulo: string,
    x: number,
    y: number,
  ): number {
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .fillColor(COLOR_NAVY)
      .text(titulo.toUpperCase(), x, y);

    doc
      .moveTo(x, y + 16)
      .lineTo(doc.page.width - x, y + 16)
      .strokeColor(COLOR_CORAL)
      .lineWidth(1.5)
      .stroke();

    return y + 28;
  }

  private dibujarFila(
    doc: PDFKit.PDFDocument,
    label: string,
    valor: string,
    x: number,
    y: number,
  ): number {
    doc
      .fontSize(9)
      .font('Helvetica-Bold')
      .fillColor(COLOR_GRAY)
      .text(label, x, y, { width: 140 });

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#111827')
      .text(valor, x + 150, y, { width: 320 });

    return y + 22;
  }

  private dibujarMontoDestacado(
    doc: PDFKit.PDFDocument,
    pago: Pago,
    x: number,
    y: number,
    width: number,
  ): void {
    doc.rect(x, y, width, 60).fill(COLOR_LIGHT_GRAY);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor(COLOR_GRAY)
      .text('TOTAL PAGADO', x + 20, y + 15);

    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor(COLOR_CORAL)
      .text(`$${Number(pago.monto).toFixed(2)}`, x, y + 12, {
        width: width - 20,
        align: 'right',
      });
  }

  private dibujarFooter(
    doc: PDFKit.PDFDocument,
    pageWidth: number,
    pageHeight: number,
  ): void {
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor(COLOR_GRAY)
      .text(
        'Este comprobante fue generado automáticamente por FitZone Sports y no requiere firma.',
        50,
        pageHeight - 60,
        { width: pageWidth - 100, align: 'center' },
      );
  }

  private describirConcepto(pago: Pago): string {
    if (pago.membresia) return `Membresía ${pago.membresia.plan}`;
    if (pago.reservaClase) return 'Reserva de clase';
    if (pago.reservaCancha) return 'Reserva de cancha';
    return 'Pago';
  }

  private describirMetodo(metodo: string): string {
    const nombres: Record<string, string> = {
      EFECTIVO: 'Efectivo',
      MERCADOPAGO: 'Mercado Pago',
      MODO: 'Modo',
    };
    return nombres[metodo] ?? metodo;
  }
}
