import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Pago } from '../../entities';
import { EstadoPago } from '../../entities/enums';
import {
  armarDatosComprobante,
  formatearARS,
  type DatosComprobante,
} from './datos-comprobante';

// Identidad del sistema. Cabecera oscura y cuerpo claro: pensado para imprimir.
const OSCURO = '#071a1d';
const LIMA = '#caff3d';
const AQUA = '#54e6d8';
const CORAL = '#ff826c';
const TEXTO = '#0f2327';
const GRIS = '#5b6b6e';
const LINEA = '#d9e2e3';

// Tipografías: Archivo y Space Grotesk no están incluidas en el repo, así que se
// usa Helvetica (viene con PDF, sin embeber nada), la más cercana en peso y
// proporciones. Si se agregan los .ttf, alcanza con registrarlos acá.
const FUENTE = 'Helvetica';
const FUENTE_NEGRITA = 'Helvetica-Bold';

const MARGEN = 48;

@Injectable()
export class PdfGeneratorService {
  generarComprobantePago(pago: Pago): Promise<Buffer> {
    const datos = armarDatosComprobante(pago);
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 0,
        info: {
          Title: `Comprobante ${datos.codigo}`,
          Author: 'FitZone Sports',
        },
      });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      try {
        this.dibujar(doc, datos);
        doc.end();
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }

  private dibujar(doc: PDFKit.PDFDocument, d: DatosComprobante): void {
    const ancho = doc.page.width;
    const util = ancho - MARGEN * 2;

    this.cabecera(doc, d, ancho);

    let y = 170;
    if (d.sede) {
      y = this.bloque(doc, 'SEDE', [d.sede.nombre, d.sede.direccion], y, util);
    }
    const cliente = [d.cliente.nombre];
    if (d.cliente.dni) cliente.push(`DNI ${d.cliente.dni}`);
    y = this.bloque(doc, 'CLIENTE', cliente, y, util);
    y = this.bloque(
      doc,
      'CONCEPTO',
      [d.concepto.titulo, ...d.concepto.detalle],
      y,
      util,
      true,
    );

    const pago = [`Método de pago: ${d.metodo}`];
    if (d.cobradoPor) pago.push(`Cobrado por: ${d.cobradoPor}`);
    y = this.bloque(doc, 'PAGO', pago, y, util);

    this.desglose(doc, d, y, util);
    this.pie(doc, ancho);
  }

  private cabecera(
    doc: PDFKit.PDFDocument,
    d: DatosComprobante,
    ancho: number,
  ): void {
    doc.rect(0, 0, ancho, 128).fill(OSCURO);
    doc.rect(0, 128, ancho, 4).fill(LIMA);

    doc.font(FUENTE_NEGRITA).fontSize(26).fillColor('#ffffff');
    doc.text('FITZONE', MARGEN, 38, { characterSpacing: 1 });
    doc.font(FUENTE_NEGRITA).fontSize(9).fillColor(AQUA);
    doc.text('SPORTS', MARGEN, 68, { characterSpacing: 4 });
    doc.font(FUENTE).fontSize(10).fillColor('#9fb3b5');
    doc.text('Comprobante de pago', MARGEN, 92);

    const xDer = ancho - MARGEN - 220;
    doc.font(FUENTE_NEGRITA).fontSize(9).fillColor(LIMA);
    doc.text('COMPROBANTE N°', xDer, 38, { width: 220, align: 'right' });
    doc.font(FUENTE_NEGRITA).fontSize(16).fillColor('#ffffff');
    doc.text(d.codigo, xDer, 52, { width: 220, align: 'right' });
    doc.font(FUENTE).fontSize(9).fillColor('#9fb3b5');
    doc.text(d.fechaHora, xDer, 76, { width: 220, align: 'right' });

    // Estado: lima si fue aprobado, coral solo si no.
    const aprobado = d.estado === EstadoPago.APROBADO;
    const etiqueta = aprobado
      ? 'APROBADO'
      : d.estado === EstadoPago.RECHAZADO
        ? 'RECHAZADO'
        : 'PENDIENTE';
    const anchoPill = 92;
    const xPill = ancho - MARGEN - anchoPill;
    doc.roundedRect(xPill, 96, anchoPill, 22, 11).fill(aprobado ? LIMA : CORAL);
    doc.font(FUENTE_NEGRITA).fontSize(9).fillColor(OSCURO);
    doc.text(etiqueta, xPill, 103, {
      width: anchoPill,
      align: 'center',
      characterSpacing: 1,
    });
  }

  // Bloque con título de sección y líneas de texto. Devuelve la nueva Y.
  private bloque(
    doc: PDFKit.PDFDocument,
    titulo: string,
    lineas: string[],
    y: number,
    ancho: number,
    destacarPrimera = false,
  ): number {
    doc.rect(MARGEN, y + 1, 3, 11).fill(AQUA);
    doc.font(FUENTE_NEGRITA).fontSize(8.5).fillColor(GRIS);
    doc.text(titulo, MARGEN + 10, y + 2, { characterSpacing: 1.5 });
    y += 22;
    lineas.forEach((linea, i) => {
      const fuerte = i === 0 && (destacarPrimera || titulo !== 'PAGO');
      doc
        .font(fuerte ? FUENTE_NEGRITA : FUENTE)
        .fontSize(fuerte ? 12 : 10.5)
        .fillColor(TEXTO);
      doc.text(linea, MARGEN + 10, y, { width: ancho - 10 });
      y += fuerte ? 18 : 16;
    });
    y += 8;
    doc
      .moveTo(MARGEN, y)
      .lineTo(MARGEN + ancho, y)
      .strokeColor(LINEA)
      .lineWidth(0.8)
      .stroke();
    return y + 16;
  }

  private desglose(
    doc: PDFKit.PDFDocument,
    d: DatosComprobante,
    y: number,
    ancho: number,
  ): number {
    for (const l of d.desglose) {
      doc.font(FUENTE).fontSize(10.5).fillColor(GRIS);
      doc.text(l.etiqueta, MARGEN + 10, y, { width: ancho - 140 });
      doc.font(FUENTE).fontSize(10.5).fillColor(TEXTO);
      doc.text(formatearARS(l.monto), MARGEN + ancho - 130, y, {
        width: 130,
        align: 'right',
      });
      y += 20;
    }
    y += 6;
    doc.roundedRect(MARGEN, y, ancho, 64, 8).fill(OSCURO);
    doc.rect(MARGEN, y + 14, 3, 36).fill(LIMA);
    doc.font(FUENTE_NEGRITA).fontSize(9).fillColor(AQUA);
    doc.text('TOTAL', MARGEN + 20, y + 20, { characterSpacing: 2 });
    doc.font(FUENTE).fontSize(9).fillColor('#9fb3b5');
    doc.text(
      d.estado === EstadoPago.APROBADO ? 'Pago aprobado' : 'Pago no aprobado',
      MARGEN + 20,
      y + 36,
    );
    doc.font(FUENTE_NEGRITA).fontSize(24).fillColor(LIMA);
    doc.text(formatearARS(d.total), MARGEN, y + 20, {
      width: ancho - 22,
      align: 'right',
    });
    return y + 64;
  }

  private pie(doc: PDFKit.PDFDocument, ancho: number): void {
    const alto = doc.page.height;
    doc
      .moveTo(MARGEN, alto - 70)
      .lineTo(ancho - MARGEN, alto - 70)
      .strokeColor(LINEA)
      .lineWidth(0.8)
      .stroke();
    doc.font(FUENTE_NEGRITA).fontSize(9).fillColor(TEXTO);
    doc.text('Comprobante de pago, sin validez fiscal', MARGEN, alto - 58, {
      width: ancho - MARGEN * 2,
      align: 'center',
    });
    doc.font(FUENTE).fontSize(8).fillColor(GRIS);
    doc.text('FitZone Sports', MARGEN, alto - 42, {
      width: ancho - MARGEN * 2,
      align: 'center',
    });
  }
}
