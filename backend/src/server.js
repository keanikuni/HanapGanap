import './config/loadEnv.js'; // must stay first: loads .env before anything reads process.env
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import routes from './routes/index.js';
import { IMAGE_DIR } from './middleware/uploadMiddleware.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';
import { rateLimit } from './utils/rateLimit.js';

// This one file runs everything: the event API (/api), the static frontend, the uploaded
// images (/uploads) and the PDF tool (/pdf). It replaces the old pdfServer.js, which
// started a second server on the same port.

const app = express();
const PORT = process.env.PORT || 8000;

if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not set. Add it to backend/.env and start again.');
    process.exit(1);
}

// Get the directory of this file (needed because ES modules have no __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Behind a proxy or host (Render, Railway, nginx...) set TRUST_PROXY=1 in .env so the
// rate limiter sees each visitor's real IP instead of the proxy's.
if (process.env.TRUST_PROXY) {
    app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);
}

// ─── PDF tool setup ───────────────────────────────────────
// The PDF libraries (qrcode, pdf-lib, pdf-parse) are loaded here so a missing install
// only disables /pdf instead of stopping the whole API from starting.
let pdfTools = null;
try {
    pdfTools = await import('./services/pdfTools.js');
} catch (err) {
    console.warn(`[pdf] PDF tool disabled (${err.message}). Run "npm install" in backend/ to enable it.`);
}

const pdfRouter = express.Router();

// PDFs are read into memory (never written to disk), 10 MB max, one file per request
const pdfUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

const pdfLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    message: 'Too many PDF requests, please slow down',
});

const requirePdfTools = (req, res, next) => {
    if (pdfTools) return next();
    res.status(503).json({ error: 'The PDF tool is not installed on this server. Run npm install in backend/.' });
};

// If PDF_API_KEY is set in .env, generate / extract / edit need it in the x-api-key header.
// If it isn't set, those routes stay open, like before.
const requirePdfKey = (req, res, next) => {
    const expected = process.env.PDF_API_KEY;
    if (!expected) return next();

    const given = Buffer.from(req.get('x-api-key') ?? '');
    const wanted = Buffer.from(expected);
    if (given.length === wanted.length && crypto.timingSafeEqual(given, wanted)) return next();
    res.status(401).json({ error: 'Invalid or missing API key' });
};

const looksLikePdf = (buffer) => buffer.subarray(0, 5).toString('latin1') === '%PDF-';

const escapeHtml = (value) =>
    String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

pdfRouter.use(pdfLimiter);

// Where the QR code on a certificate leads. Public on purpose: anyone can scan and check.
pdfRouter.get('/verify', requirePdfTools, (req, res) => {
    const { name, event, date, code } = req.query;
    if (![name, event, date, code].every((v) => typeof v === 'string')) {
        return res.status(400).type('text').send('Missing certificate details');
    }

    const valid = pdfTools.sign({ name, event, date }) === code.toUpperCase();
    res.status(valid ? 200 : 400).type('html').send(
        `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">` +
        `<meta name="viewport" content="width=device-width, initial-scale=1"><title>Certificate check</title></head>` +
        `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:2rem auto;padding:0 1rem">` +
        (valid
            ? `<h2>&#9989; Genuine certificate</h2>` +
              `<p><strong>${escapeHtml(name)}</strong><br>${escapeHtml(event)}<br>${escapeHtml(date)}</p>`
            : `<h2>&#10060; Not valid</h2><p>These details do not match the verification code.</p>`) +
        `</body></html>`
    );
});

// Make a certificate of attendance. Body: { name, event?, date? }
pdfRouter.post('/generate', requirePdfKey, requirePdfTools, async (req, res, next) => {
    try {
        const { name, event, date } = req.body ?? {};
        if (typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'name is required' });
        }
        if ([event, date].some((v) => v != null && typeof v !== 'string')) {
            return res.status(400).json({ error: 'event and date must be text' });
        }

        const { pdf, code } = await pdfTools.generateAttendancePdf({ name, event, date });
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="attendance.pdf"',
            'X-Verification-Code': code,
        });
        res.send(pdf);
    } catch (err) {
        next(err);
    }
});

// Read the name / event / date back out of a PDF and check its signature. Form field: "file"
pdfRouter.post('/extract', requirePdfKey, requirePdfTools, pdfUpload.single('file'), async (req, res) => {
    if (!req.file || !looksLikePdf(req.file.buffer)) {
        return res.status(400).json({ error: 'Upload a PDF in the "file" field' });
    }
    try {
        const { fields, code, signatureValid } = await pdfTools.extractFields(req.file.buffer);
        res.json({ fields, code, signatureValid });
    } catch (err) {
        console.log(err.message);
        res.status(422).json({ error: 'Could not read that PDF' });
    }
});

// Find & replace text in a PDF. Form fields: "file" and "replacements" (JSON text)
//   replacements = [{ "find": "Juan", "replace": "Juana" }]
pdfRouter.post('/edit', requirePdfKey, requirePdfTools, pdfUpload.single('file'), async (req, res) => {
    if (!req.file || !looksLikePdf(req.file.buffer)) {
        return res.status(400).json({ error: 'Upload a PDF in the "file" field' });
    }

    let replacements;
    try {
        replacements = JSON.parse(req.body?.replacements);
    } catch {
        return res.status(400).json({ error: 'replacements must be JSON text' });
    }
    const replacementsOk = Array.isArray(replacements)
        && replacements.length >= 1 && replacements.length <= 20
        && replacements.every((r) =>
            r && typeof r.find === 'string' && r.find.length >= 1 && r.find.length <= 500
            && typeof r.replace === 'string' && r.replace.length <= 500);
    if (!replacementsOk) {
        return res.status(400).json({ error: 'replacements must be 1-20 items like { "find": "...", "replace": "..." }' });
    }

    try {
        const { pdf, replaced, notFound, oldTextRemoved } = await pdfTools.editPdfText(req.file.buffer, replacements);
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="edited.pdf"',
            'X-Replaced': String(replaced),
            'X-Not-Found': encodeURIComponent(JSON.stringify(notFound)),
            'X-Old-Text-Removed': String(oldTextRemoved),
        });
        res.send(pdf);
    } catch (err) {
        console.log(err.message);
        res.status(422).json({ error: 'Could not edit that PDF' });
    }
});

// The PDF routes answer with { error } because pdf-tool.html reads that field,
// so they get their own error handler instead of the API's { message } one.
pdfRouter.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof multer.MulterError) {
        const text = err.code === 'LIMIT_FILE_SIZE'
            ? 'The PDF must be 10 MB or smaller'
            : 'Send exactly one PDF in the "file" field';
        return res.status(400).json({ error: text });
    }
    console.error(err);
    res.status(500).json({ error: 'server error' });
});

// ─── Middleware (must come before the routes) ─────────────
app.use(cors({ exposedHeaders: ['X-Verification-Code', 'X-Replaced', 'X-Not-Found', 'X-Old-Text-Removed'] }));
app.use(express.json());

// ─── Static files ─────────────────────────────────────────
// Backend/src -> up two levels -> frontend
app.use(express.static(path.join(__dirname, '../../frontend')));

// Public event images: /uploads/<file> -> uploads/images/<file>
app.use('/uploads', express.static(IMAGE_DIR));

// Fallback home page (only used if the frontend folder has no index.html)
app.get('/', (req, res) => {
    res.send('welcome to hanap ganap (wala pa laman in development)');
});

// ─── API routes ───────────────────────────────────────────
// routes/index.js mounts auth, events, universities, categories,
// registrations, attendance, certificates, notifications and admin under /api
app.use('/api', routes);

// ─── PDF tool (no login) ──────────────────────────────────
// Page: /pdf-tool.html   API: /pdf/generate, /pdf/extract, /pdf/edit, /pdf/verify
app.use('/pdf', pdfRouter);

// ─── Error handling (always last) ─────────────────────────
app.use(notFoundHandler); // after all routes
app.use(errorHandler);    // handles multer errors, bad JSON, Prisma errors, everything else

app.listen(PORT, () => {
    console.log(`Server has started on http://localhost:${PORT}`);
    console.log(`PDF tool: http://localhost:${PORT}/pdf-tool.html${pdfTools ? '' : ' (disabled until npm install)'}`);
});
