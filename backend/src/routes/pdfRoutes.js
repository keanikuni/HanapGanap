import express from 'express';
import multer from 'multer';
import {
  generateAttendancePdf, extractFields, editPdfText, sign, clean,
} from '../services/pdfTools.js';

// NO LOGIN on these routes (by request). If you set PDF_API_KEY in .env, the
// generate / extract / edit routes will require header "x-api-key: <that value>".
// /verify is always public — it's what the QR code opens.
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(), // never write untrusted files to disk
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
}).single('file');

const optionalKey = (req, res, next) =>
  !process.env.PDF_API_KEY || req.headers['x-api-key'] === process.env.PDF_API_KEY
    ? next()
    : res.status(401).json({ error: 'Missing or wrong x-api-key' });

// Runs multer + checks the upload really is a PDF
const pdfUpload = [
  (req, res, next) => upload(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : next())),
  (req, res, next) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded (field name: file)' });
    if (req.file.buffer.subarray(0, 5).toString() !== '%PDF-') {
      return res.status(400).json({ error: 'Not a valid PDF' });
    }
    next();
  },
];

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// GET /pdf/health — lets the page check it is talking to this server
router.get('/health', (req, res) => res.json({ ok: true }));

// POST /pdf/generate   JSON: { "name": "Juan Dela Cruz", "event": "Tech Summit", "date": "November 6, 2026" }
// event and date are optional (date defaults to today). Returns the PDF file.
router.post('/generate', optionalKey, async (req, res) => {
  try {
    const { pdf, code } = await generateAttendancePdf(req.body ?? {});
    res.set('X-Verification-Code', code)
      .set('Content-Disposition', 'attachment; filename="attendance.pdf"')
      .type('application/pdf')
      .send(pdf);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /pdf/extract   multipart, field "file"
// Returns { fields: {name,event,date}, code, signatureValid, text }
router.post('/extract', optionalKey, ...pdfUpload, async (req, res) => {
  try {
    res.json(await extractFields(req.file.buffer));
  } catch {
    res.status(422).json({ error: 'Could not read this PDF' });
  }
});

// POST /pdf/edit   multipart: field "file" + field "replacements" = JSON string
//   replacements: [{"find":"Juan","replace":"Juana"}]
// Returns the edited PDF. Headers: X-Replaced (count), X-Not-Found (JSON list, URI-encoded),
// X-Old-Text-Removed (false = old text is only covered, still copy-able).
// NOTE: editing the text of an attendance certificate does NOT re-sign it, so its
// verification code will stop matching. To correct a certificate, use /extract then /generate.
router.post('/edit', optionalKey, ...pdfUpload, async (req, res) => {
  let replacements;
  try {
    replacements = JSON.parse(req.body.replacements ?? '[]');
    if (!Array.isArray(replacements) || replacements.length === 0 || replacements.length > 50) throw new Error();
    replacements = replacements.map((r) => ({ find: String(r.find ?? ''), replace: String(r.replace ?? '') }));
    if (replacements.some((r) => !r.find)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'replacements must be a JSON array (max 50) of {find, replace}' });
  }

  try {
    const { pdf, replaced, notFound, oldTextRemoved } = await editPdfText(req.file.buffer, replacements);
    res.set('X-Replaced', String(replaced))
      .set('X-Old-Text-Removed', String(oldTextRemoved))
      .set('X-Not-Found', encodeURIComponent(JSON.stringify(notFound)))
      .set('Content-Disposition', 'attachment; filename="edited.pdf"')
      .type('application/pdf')
      .send(pdf);
  } catch {
    res.status(422).json({ error: 'Could not edit this PDF (is it scanned or encrypted?)' });
  }
});

// GET /pdf/verify?name=&event=&date=&code=   (public — the QR code opens this)
router.get('/verify', (req, res) => {
  const fields = { name: clean(req.query.name, 100), event: clean(req.query.event, 150), date: clean(req.query.date, 50) };
  const ok = fields.name && String(req.query.code ?? '').toUpperCase() === sign(fields);
  res.status(ok ? 200 : 404).type('html').send(
    ok
      ? `<h2>✅ Valid attendance certificate</h2><p><b>${escapeHtml(fields.name)}</b><br>${escapeHtml(fields.event)}<br>${escapeHtml(fields.date)}</p>`
      : '<h2>❌ Not valid</h2><p>This certificate was not issued by us, or its details were changed.</p>',
  );
});

export default router;
