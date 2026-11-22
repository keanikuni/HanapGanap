import multer from 'multer';
import { MAX_FILES } from './uploadMiddleware.js';

// Catches anything that reaches next(err), plus errors Express and multer raise
// themselves. Your routes handle their own expected errors, so this is the
// safety net for everything else.

// 404 for any URL that no route matched. Mount it after your routes.
export function notFoundHandler(req, res) {
    res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Must have 4 parameters, or Express won't treat it as an error handler
export function errorHandler(err, req, res, next) {
    // Upload problems (file too big, too many files, wrong field name)
    if (err instanceof multer.MulterError) {
        const messages = {
            LIMIT_FILE_SIZE: "Each image must be 5 MB or smaller",
            LIMIT_FILE_COUNT: `You can upload at most ${MAX_FILES} images at once`,
            LIMIT_UNEXPECTED_FILE: `Send images in the "images" field (max ${MAX_FILES})`,
        };
        return res.status(400).json({ message: messages[err.code] || "Upload failed" });
    }

    // Bad JSON in the request body
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ message: "Invalid JSON in request body" });
    }
    // Body too large
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ message: "Request body too large" });
    }

    // Prisma errors that slipped past a route's own handling
    if (err.code === 'P2002') return res.status(409).json({ message: "That record already exists" });
    if (err.code === 'P2025') return res.status(404).json({ message: "Record not found" });
    if (err.code === 'P2003') return res.status(409).json({ message: "Related record conflict" });

    console.error(err);

    // If the response already started, let Express close the connection
    if (res.headersSent) return next(err);

    // Errors with a 4xx status (like HttpError) are safe to show as-is.
    // Only hide the details of real server errors in production.
    const status = err.status || 500;
    const message =
        status < 500 || process.env.NODE_ENV !== 'production' ? err.message : "Something went wrong";
    res.status(status).json({ message });
}