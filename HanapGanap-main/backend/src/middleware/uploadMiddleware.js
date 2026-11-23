import multer from 'multer';
import path, { dirname } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { HttpError } from '../utils/httpError.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Backend/src/middleware -> up two levels -> Backend/uploads/images
// Images get their own subfolder so only this folder is served publicly.
// Certificate PDFs live in uploads/certificates and stay private.
export const IMAGE_DIR = path.join(__dirname, '../../uploads/images');

// Creates the folder if it doesn't exist yet. Runs once when the server starts.
// { recursive: true } means "don't error if it's already there".
fs.mkdirSync(IMAGE_DIR, { recursive: true });

export const MAX_FILES = 5;

// Only allow these types; the extension comes from our map, not the client's filename
const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const upload = multer({
  storage: multer.diskStorage({
    destination: IMAGE_DIR,
    // Random name avoids collisions and unsafe user-supplied filenames
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),
  }),

  // 5 MB per image, and a cap on how many images one request can send
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_FILES },

  // Reject wrong types with a clear error instead of silently skipping the file
  fileFilter: (req, file, cb) => {
    if (Object.hasOwn(ALLOWED, file.mimetype)) return cb(null, true);
    cb(new HttpError(400, 'Only JPG, PNG, and WEBP images are allowed'));
  },
});

// Delete files that multer just saved (use when the DB insert fails afterwards)
export async function removeFiles(files = []) {
  await Promise.all(files.map((f) => fs.promises.unlink(f.path).catch(() => {})));
}

// Delete one stored image by its saved file name (use when deleting an image row).
// path.basename blocks anything like "../../something".
export async function removeStoredImage(fileName) {
  await fs.promises.unlink(path.join(IMAGE_DIR, path.basename(fileName))).catch(() => {});
}