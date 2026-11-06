import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfRoutes from './routes/pdfRoutes.js';

try { process.loadEnvFile(); } catch { /* no .env file — fine */ }

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8000;
const app = express();

app.use(express.json());
app.use('/pdf', pdfRoutes);
app.use(express.static(path.join(__dirname, '../../frontend')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

app.listen(PORT, () => console.log(`PDF tool running: http://localhost:${PORT}/pdf-tool.html`));