// Loads backend/.env when the server is started without `node --env-file=.env`
// (for example `node src/server.js`). Variables that are already set are kept.
// Import this file FIRST in server.js so DATABASE_URL and JWT_SECRET exist before
// any other module reads them.
try {
    process.loadEnvFile();
} catch {
    // No .env file: fine, the variables may come from the host instead
}
