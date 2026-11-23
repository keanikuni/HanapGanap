// Standalone PDF toolkit (no database, no login):
//   generateAttendancePdf()  -> make a PDF with name, event, date + QR code
//   extractFields()          -> read those fields back out of a PDF and check the signature
//   editPdfText()            -> find & replace visible text in any text-based PDF
//
// You can import these directly, e.g. to email the PDF right after someone attends:
//   const { pdf } = await generateAttendancePdf({ name: 'Juan Dela Cruz', event: 'Tech Summit' });
import crypto from 'crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import {
  PDFDocument as LibDoc, PDFArray, PDFName, StandardFonts, decodePDFRawStream, rgb,
} from 'pdf-lib';
// Import the inner file: the package root runs debug code that crashes under ESM
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const SECRET = process.env.PDF_SECRET || 'dev-only-change-me';
if (!process.env.PDF_SECRET) console.warn('[pdfTools] PDF_SECRET not set — using an insecure dev secret');

const baseUrl = () => process.env.BASE_URL || `http://localhost:${process.env.PORT || 8000}`;

// The built-in PDF fonts only cover Latin-1 (Ñ, é, ü are fine; emoji / Chinese are not).
// Replace anything unsupported so the PDF never fails to render.
export const clean = (s, max) =>
  String(s ?? '')
    .replace(/[^\x20-\x7E -ÿ]/g, '?')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

// 16-hex-char signature over the three fields. Same fields + same secret => same code.
export const sign = ({ name, event, date }) =>
  crypto.createHmac('sha256', SECRET).update(JSON.stringify([name, event, date])).digest('hex').slice(0, 16).toUpperCase();

export const verifyUrl = ({ name, event, date, code }) =>
  `${baseUrl()}/pdf/verify?` + new URLSearchParams({ name, event, date, code });

// ─── 1. Generate ────────────────────────────────────────────────────────────
export async function generateAttendancePdf(input) {
  const name = clean(input.name, 100);
  const event = clean(input.event || 'Event Attendance', 150);
  const date = clean(input.date || new Date().toLocaleDateString('en-PH', { dateStyle: 'long' }), 50);
  if (!name) throw new Error('name is required');

  const code = sign({ name, event, date });
  const qr = await QRCode.toBuffer(verifyUrl({ name, event, date, code }), { margin: 1 });

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 60 });
  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  doc.fontSize(32).text('CERTIFICATE OF ATTENDANCE', { align: 'center' }).moveDown(1.5);
  doc.fontSize(14).text('This certifies that', { align: 'center' }).moveDown(0.5);
  doc.fontSize(26).text(name, { align: 'center' }).moveDown(0.5);
  doc.fontSize(14).text('attended', { align: 'center' }).moveDown(0.5);
  doc.fontSize(20).text(event, { align: 'center' }).moveDown(0.5);
  doc.fontSize(12).text(date, { align: 'center' });

  // Small labelled record at the bottom — extractFields() reads these lines back.
  const y = 400;
  doc.fontSize(9).fillColor('#555');
  doc.text(`Name: ${name}`, 60, y, { lineBreak: false });
  doc.text(`Event: ${event}`, 60, y + 13, { lineBreak: false });
  doc.text(`Date: ${date}`, 60, y + 26, { lineBreak: false });
  doc.text(`Verification Code: ${code}`, 60, y + 39, { lineBreak: false });
  doc.image(qr, doc.page.width - 60 - 90, y - 10, { width: 90 });
  doc.end();

  return { pdf: await done, code, fields: { name, event, date } };
}

// ─── 2. Extract ─────────────────────────────────────────────────────────────
export async function extractFields(buf) {
  const { text } = await pdfParse(buf);
  const grab = (label) => text.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
  const fields = { name: grab('Name'), event: grab('Event'), date: grab('Date') };
  const code = text.match(/Verification Code:\s*([A-F0-9]{16})/)?.[1] ?? null;
  const complete = fields.name && fields.event && fields.date && code;
  return { fields, code, text, signatureValid: Boolean(complete && sign(fields) === code) };
}

// ─── 3. Edit text in any PDF ────────────────────────────────────────────────
// Collect every text run with its position, using pdf-parse's bundled pdf.js.
async function getTextRuns(buf) {
  const runs = [];
  await pdfParse(buf, {
    pagerender: async (page) => {
      const content = await page.getTextContent({ normalizeWhitespace: true });
      for (const it of content.items) {
        if (!it.str.trim()) continue;
        runs.push({
          page: page.pageNumber - 1,
          str: it.str,
          x: it.transform[4],
          y: it.transform[5],
          size: Math.hypot(it.transform[2], it.transform[3]) || it.height,
          width: it.width,
        });
      }
      return '';
    },
  });
  return runs;
}

// ---- content-stream helpers (remove the OLD text, not just hide it) ----------
const norm = (s) => s.replace(/\s+/g, ' ').trim();

function decodeLiteral(lit) {
  // lit includes the surrounding ( )
  const body = lit.slice(1, -1);
  let out = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c !== '\\') { out += c; continue; }
    const n = body[++i];
    if (n === 'n') out += '\n'; else if (n === 'r') out += '\r'; else if (n === 't') out += '\t';
    else if (n === 'b') out += '\b'; else if (n === 'f') out += '\f';
    else if (n >= '0' && n <= '7') {
      let oct = n;
      while (oct.length < 3 && body[i + 1] >= '0' && body[i + 1] <= '7') oct += body[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else if (n === '\n' || n === '\r') { /* line continuation */ } else out += n;
  }
  return out;
}

function decodeHex(hex) {
  const h = hex.slice(1, -1).replace(/\s+/g, '');
  let out = '';
  for (let i = 0; i < h.length; i += 2) out += String.fromCharCode(parseInt(h.slice(i, i + 2).padEnd(2, '0'), 16));
  return out;
}

const STR = String.raw`\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]*>`;
const OP_RE = new RegExp(String.raw`\[((?:${STR}|[^\][()<>])*)\]\s*TJ|(${STR})\s*Tj`, 'g');
const STR_RE = new RegExp(STR, 'g');

// Text shown by one Tj/TJ operator (simple single-byte fonts only).
function operatorText(match) {
  const strings = (match[1] !== undefined ? match[1].match(STR_RE) ?? [] : [match[2]]);
  return strings.map((x) => (x[0] === '(' ? decodeLiteral(x) : decodeHex(x))).join('');
}

async function readPageStream(doc, page) {
  const ctx = doc.context;
  const contents = page.node.Contents();
  if (!contents) return null;
  const list = contents instanceof PDFArray ? contents.asArray().map((r) => ctx.lookup(r)) : [contents];
  const parts = list.map((st) => Buffer.from(decodePDFRawStream(st).decode()).toString('latin1'));
  return parts.join('\n');
}

/**
 * Replace text in a PDF. replacements = [{ find: 'Juan', replace: 'Juana' }, ...]
 * For PDFs with ordinary fonts (like the ones generateAttendancePdf makes) the old text is
 * deleted from the file and the new text drawn in Helvetica. Otherwise the old text is only
 * painted over in white (still copy-able) and the result says so (oldTextRemoved: false).
 * Works for text-based PDFs on a white background; it can't touch scanned images, and a
 * phrase split across two text runs won't be found.
 */
export async function editPdfText(buf, replacements) {
  const runs = await getTextRuns(buf);
  const doc = await LibDoc.load(buf);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const supported = new Set(font.getCharacterSet());
  const safe = (s) => [...s].map((ch) => (supported.has(ch.codePointAt(0)) ? ch : '?')).join('');

  const used = new Set();
  const apply = (str) => {
    let out = str;
    replacements.forEach(({ find, replace }, i) => {
      if (find && out.includes(find)) { out = out.split(find).join(replace); used.add(i); }
    });
    return out;
  };
  for (const run of runs) run.out = apply(run.str);

  // Pass 1: blank the old text operators in each page's content stream.
  for (let p = 0; p < doc.getPageCount(); p++) {
    const pageRuns = runs.filter((r) => r.page === p);
    if (!pageRuns.some((r) => r.out !== r.str)) continue;
    try {
      const page = doc.getPage(p);
      const stream = await readPageStream(doc, page);
      if (stream == null) continue;
      let ptr = 0;
      let touched = false;
      const rewritten = stream.replace(OP_RE, (whole, ...m) => {
        const match = [whole, m[0], m[1]];
        const text = norm(operatorText(match));
        const idx = pageRuns.findIndex((r, k) => k >= ptr && norm(r.str) === text);
        if (idx === -1) return whole;
        ptr = idx + 1;
        if (pageRuns[idx].out === pageRuns[idx].str) return whole;
        pageRuns[idx].removed = true;
        touched = true;
        return '() Tj'; // old text gone; nothing is drawn here any more
      });
      if (touched) {
        const ref = doc.context.register(doc.context.flateStream(Buffer.from(rewritten, 'latin1')));
        page.node.set(PDFName.of('Contents'), ref);
      }
    } catch {
      // unsupported stream: fall back to cover-only for this page
    }
  }

  // Pass 2: draw the new text (and a white cover where the old text could not be removed).
  let replaced = 0;
  let allRemoved = true;
  for (const run of runs) {
    if (run.out === run.str) continue;
    const page = doc.getPage(run.page);
    const out = safe(run.out);
    const newWidth = font.widthOfTextAtSize(out, run.size);

    // Keep centred lines centred; everything else stays left-aligned where it was.
    const pageWidth = page.getWidth();
    const wasCentred = Math.abs(run.x + run.width / 2 - pageWidth / 2) < pageWidth * 0.02;
    const x = wasCentred ? pageWidth / 2 - newWidth / 2 : run.x;

    if (!run.removed) {
      allRemoved = false;
      page.drawRectangle({
        x: run.x - 1, y: run.y - run.size * 0.25,
        width: run.width + 2, height: run.size * 1.2,
        color: rgb(1, 1, 1),
      });
    }
    page.drawText(out, { x, y: run.y, size: run.size, font, color: rgb(0, 0, 0) });
    replaced++;
  }

  const notFound = replacements.filter((_, i) => !used.has(i)).map((r) => r.find);
  return { pdf: Buffer.from(await doc.save()), replaced, notFound, oldTextRemoved: allRemoved };
}
