// Utilidades del generador del Dossier: conversor Markdown mínimo, lector de xlsx y helpers.
// Sin dependencias externas: solo módulos incluidos en Node.
import zlib from 'node:zlib';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slug = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

/** Formato inline: código, negrita, cursiva y enlaces (los enlaces se muestran como texto). */
export function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, (_, t, u) => (t === u ? esc(u) : `${t} (${u})`));
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[\s(])_([^_\s][^_]*)_(?=[\s).,;:]|$)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
  return s;
}

const splitRow = (line) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));

/** Sección de un Markdown: desde la línea que cumple `desde` hasta antes de la que cumple `hasta`. */
export function seccion(md, desde, hasta) {
  const lines = md.split('\n');
  const i = lines.findIndex((l) => desde.test(l));
  if (i < 0) throw new Error(`No se encontró la sección ${desde}`);
  let j = lines.length;
  if (hasta) {
    const k = lines.findIndex((l, n) => n > i && hasta.test(l));
    if (k >= 0) j = k;
  }
  return lines.slice(i, j).join('\n');
}

/**
 * Contexto de numeración compartido: tablas y figuras se numeran en todo el documento.
 */
export class Contexto {
  constructor() {
    this.nTabla = 0;
    this.nFigura = 0;
    this.toc = []; // { nivel, texto, id }
    this.ids = new Set();
  }
  id(texto) {
    let base = slug(texto) || 'sec';
    let id = base;
    let n = 2;
    while (this.ids.has(id)) id = `${base}-${n++}`;
    this.ids.add(id);
    return id;
  }
  encabezado(nivel, texto, { toc = true, html = null } = {}) {
    const id = this.id(texto);
    const n = Math.min(Math.max(nivel, 1), 5);
    if (toc && n <= 2) this.toc.push({ nivel: n, texto, id });
    return `<h${n} id="${id}">${html ?? esc(texto)}</h${n}>\n`;
  }
  /** Tabla APA: "Tabla N" en negrita, título en cursiva, solo líneas horizontales, nota opcional. */
  tablaApa(titulo, cabecera, filas, { nota = '', clase = '', nowrap = [] } = {}) {
    const n = ++this.nTabla;
    const st = (k) => (nowrap.includes(k) ? ' style="white-space:nowrap"' : '');
    const th = cabecera.map((c, k) => `<th${st(k)}>${c}</th>`).join('');
    const tr = filas.map((f) => `<tr>${f.map((c, k) => `<td${st(k)}>${c}</td>`).join('')}</tr>`).join('\n');
    return (
      `<div class="tabla-apa ${clase}">\n<p class="tabla-num"><strong>Tabla ${n}</strong></p>\n` +
      `<p class="tabla-titulo"><em>${esc(titulo)}</em></p>\n` +
      `<table><thead><tr>${th}</tr></thead>\n<tbody>\n${tr}\n</tbody></table>\n` +
      (nota ? `<p class="nota"><em>Nota.</em> ${nota}</p>\n` : '') +
      `</div>\n`
    );
  }
  figura(titulo, src, nota) {
    const n = ++this.nFigura;
    return (
      `<figure class="figura">\n<p class="fig-num"><strong>Figura ${n}</strong></p>\n` +
      `<p class="fig-titulo"><em>${esc(titulo)}</em></p>\n` +
      `<img src="${src}" alt="${esc(titulo)}">\n` +
      `<p class="nota"><em>Nota.</em> ${nota}</p>\n</figure>\n`
    );
  }
}

/**
 * Convierte Markdown a HTML.
 * @param {string} md
 * @param {Contexto} ctx
 * @param {{desplazar?:number, contexto?:string, quitarH1?:boolean}} opt
 */
export function markdown(md, ctx, opt = {}) {
  const { desplazar = 0, contexto = '' } = opt;
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let out = '';
  let ultimoEncabezado = contexto;
  let i = 0;
  let enComentario = false;

  const esTabla = (n) => n + 1 < lines.length && /^\s*\|/.test(lines[n]) && /^\s*\|?\s*:?-{2,}/.test(lines[n + 1]);

  while (i < lines.length) {
    let line = lines[i];

    if (enComentario) {
      if (/-->/.test(line)) enComentario = false;
      i++;
      continue;
    }
    if (/^\s*<!--/.test(line)) {
      if (!/-->/.test(line)) enComentario = true;
      i++;
      continue;
    }
    if (/^\s*$/.test(line) || /^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      i++;
      continue;
    }

    // Bloque de código
    const f = line.match(/^\s*```/);
    if (f) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out += `<pre>${esc(buf.join('\n'))}</pre>\n`;
      continue;
    }

    // Encabezado
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) {
      const texto = h[2].replace(/`/g, '').replace(/\*\*/g, '');
      ultimoEncabezado = texto;
      out += ctx.encabezado(h[1].length + desplazar, texto, { html: inline(h[2]) });
      i++;
      continue;
    }

    // Tabla
    if (esTabla(i)) {
      const cab = splitRow(lines[i]);
      const filas = [];
      i += 2;
      while (i < lines.length && /^\s*\|/.test(lines[i])) filas.push(splitRow(lines[i++]));
      const titulo = ultimoEncabezado.replace(/^\d+(\.\d+)*\.?\s+/, '') + (contexto && ultimoEncabezado !== contexto ? ` (${contexto})` : '');
      out += ctx.tablaApa(
        titulo,
        cab.map(inline),
        filas.map((r) => cab.map((_, k) => inline(r[k] ?? ''))),
        { nowrap: filas.every((r) => (r[0] ?? '').replace(/[`*]/g, '').length <= 14) ? [0] : [] },
      );
      continue;
    }

    // Cita
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
      out += `<blockquote><p>${inline(buf.join(' '))}</p></blockquote>\n`;
      continue;
    }

    // Lista (un nivel de anidado)
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordenada = /^\s*\d+\./.test(line);
      const items = [];
      while (i < lines.length && (/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(/^(\s*)([-*+]|\d+\.)\s+(.*)$/);
        if (m) {
          const sangria = m[1].length;
          if (sangria >= 2 && items.length) items[items.length - 1].sub.push(m[3]);
          else items.push({ t: m[3], sub: [] });
        } else {
          items[items.length - 1].t += ' ' + lines[i].trim();
        }
        i++;
        if (i < lines.length && /^\s*$/.test(lines[i]) && i + 1 < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i + 1])) i++;
      }
      const tag = ordenada ? 'ol' : 'ul';
      out +=
        `<${tag}>` +
        items
          .map((it) => `<li>${inline(it.t)}${it.sub.length ? `<ul>${it.sub.map((s) => `<li>${inline(s)}</li>`).join('')}</ul>` : ''}</li>`)
          .join('') +
        `</${tag}>\n`;
      continue;
    }

    // Párrafo
    const buf = [];
    while (
      i < lines.length &&
      !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*([-*+]|\d+\.)\s+/.test(lines[i]) &&
      !esTabla(i)
    )
      buf.push(lines[i++].trim());
    out += `<p>${inline(buf.join(' '))}</p>\n`;
  }
  return out;
}

// ---------------------------------------------------------------- xlsx

function leerZip(buf) {
  let eocd = buf.length - 22;
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--;
  if (eocd < 0) throw new Error('El archivo no es un zip válido');
  const total = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = new Map();
  for (let n = 0; n < total; n++) {
    const metodo = buf.readUInt16LE(p + 10);
    const csize = buf.readUInt32LE(p + 20);
    const nlen = buf.readUInt16LE(p + 28);
    const elen = buf.readUInt16LE(p + 30);
    const clen = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const nombre = buf.toString('utf8', p + 46, p + 46 + nlen);
    const ln = buf.readUInt16LE(off + 26);
    const le = buf.readUInt16LE(off + 28);
    const datos = buf.subarray(off + 30 + ln + le, off + 30 + ln + le + csize);
    files.set(nombre, metodo === 0 ? datos : zlib.inflateRawSync(datos));
    p += 46 + nlen + elen + clen;
  }
  return files;
}

const ent = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&');

const colIdx = (letras) => [...letras].reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;

/** Devuelve [{ nombre, filas: string[][] }] con los valores en caché de cada celda. */
export function leerXlsx(buf) {
  const z = leerZip(buf);
  const txt = (n) => z.get(n)?.toString('utf8') ?? '';
  const compartidas = [...txt('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    ent([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')),
  );
  const rels = new Map([...txt('xl/_rels/workbook.xml.rels').matchAll(/<Relationship [^>]*>/g)].map((m) => {
    const id = m[0].match(/Id="([^"]+)"/)[1];
    const target = m[0].match(/Target="([^"]+)"/)[1];
    return [id, target];
  }));
  const hojas = [...txt('xl/workbook.xml').matchAll(/<sheet [^>]*>/g)].map((m) => ({
    nombre: ent(m[0].match(/name="([^"]*)"/)[1]),
    ruta: 'xl/' + rels.get(m[0].match(/r:id="([^"]+)"/)[1]).replace(/^\/?(xl\/)?/, ''),
  }));
  return hojas.map(({ nombre, ruta }) => {
    const xml = txt(ruta);
    const filas = [...xml.matchAll(/<row [^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)].map((r) => {
      const fila = [];
      for (const c of (r[1] ?? '').matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const cuerpo = c[3] ?? '';
        let v = '';
        if (/t="inlineStr"/.test(c[2])) v = ent([...cuerpo.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(''));
        else {
          const m = cuerpo.match(/<v>([\s\S]*?)<\/v>/);
          if (m) v = /t="s"/.test(c[2]) ? compartidas[+m[1]] : ent(m[1]);
        }
        fila[colIdx(c[1])] = v;
      }
      return Array.from(fila, (x) => x ?? '');
    });
    return { nombre, filas };
  });
}
