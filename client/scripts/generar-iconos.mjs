// Genera los PNG de la PWA a partir de public/favicon.svg (logo existente: círculo lima con "FZ").
// Se ejecuta a mano (node scripts/generar-iconos.mjs); no forma parte del build ni de src/.
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publico = path.join(raiz, 'public');
const FONDO = '#071a1d';

const logo = await readFile(path.join(publico, 'favicon.svg'), 'utf8');
// Contenido interno del SVG (círculo + texto), en un viewBox de 32x32.
const interno = logo.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

// Logo centrado en un lienzo de 32x32 con fondo; `escala` reduce el logo para dejar margen.
function lienzo(escala, conFondo) {
  const t = (32 - 32 * escala) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
      (conFondo ? `<rect width="32" height="32" fill="${FONDO}"/>` : '') +
      `<g transform="translate(${t} ${t}) scale(${escala})">${interno}</g></svg>`,
  );
}

const salidas = [
  // [archivo, tamaño, escala del logo, fondo sólido]
  ['pwa-192x192.png', 192, 1, false],
  ['pwa-512x512.png', 512, 1, false],
  // Maskable: el logo (diámetro 60%) queda dentro de la zona segura (círculo del 80%).
  ['pwa-maskable-512x512.png', 512, 0.6, true],
  // iOS no admite transparencia en apple-touch-icon.
  ['apple-touch-icon.png', 180, 0.8, true],
];

for (const [archivo, tam, escala, fondo] of salidas) {
  await sharp(lienzo(escala, fondo), { density: 600 })
    .resize(tam, tam)
    .png()
    .toFile(path.join(publico, archivo));
  console.log('generado', archivo);
}
