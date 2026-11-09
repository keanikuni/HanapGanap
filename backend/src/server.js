import express from 'express';
import cors from 'cors';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

import routes from './routes/index.js';
//import pdfRoutes from './routes/pdfRoutes.js';
//import extractRoutes from './routes/extractRoutes.js';

import { IMAGE_DIR } from './middleware/uploadMiddleware.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Get the directory of this file (needed because ES modules have no __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Middleware (must come before the routes) ─────────────
app.use(cors());
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

// Your extra tools, kept at their current paths
//app.use('/pdf', pdfRoutes);         // no-login PDF maker / editor
//app.use('/extract', extractRoutes); // extracts text from an uploaded PDF

// ─── Error handling (always last) ─────────────────────────
app.use(notFoundHandler); // after all routes
app.use(errorHandler);    // handles multer errors, bad JSON, Prisma errors, everything else

app.listen(PORT, () => {
    console.log(`Server has started on http://localhost:${PORT}`);
});