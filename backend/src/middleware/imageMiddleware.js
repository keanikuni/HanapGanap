import multer from 'multer';
import path, { dirname } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// THIS WILL HANDLE or CONTROL HOW THE IMAGE IS STORED
// By creating the filepath name for them and upload them in
// the upload folder also the limit of the image size is 5mb

// Backend/src/middleware -> up two levels -> Backend/uploads
export const IMAGE_DIR = path.join(__dirname, '../../uploads');
// idk what this means but it will synchronize or up to date
fs.mkdirSync(IMAGE_DIR, { recursive: true });

// Only allow these types; the extension comes from our map, not the client's filename
const ALLOWED = { 'image/jpeg': '.jpg', 
                  'image/png':  '.png',
                  'image/webp': '.webp'
                };

//  Note; Multer is a popular open-source Node.js middleware primarily used for 
// handling multipart/form-data, which is the encoding type required for uploading files
// through HTML forms

export const upload = multer({

    storage: multer.diskStorage({
        
        destination: IMAGE_DIR,

        // Random name avoids collisions and unsafe user-supplied filenames
        filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),
    }),
    
    // 5 MB this shi is too complicated
    limits: { fileSize: 5 * 1024 * 1024 }, 
    
    //checks if the file extension is good or nah
    fileFilter: (req, file, cb) => cb(null, file.mimetype in ALLOWED),
});