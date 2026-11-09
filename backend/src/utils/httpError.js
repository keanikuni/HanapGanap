// An Error that carries an HTTP status code, so it can be thrown anywhere
// (multer's fileFilter, inside a transaction, ...) and turned into a clean
// JSON response by errorHandler.
export class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}