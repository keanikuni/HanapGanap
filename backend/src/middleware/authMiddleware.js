import jwt from 'jsonwebtoken';

// Checks the Authorization header ("Bearer <token>") and puts the token's
// contents on req.user as { id, role }. Use it on any route that needs a login.
export function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: "Not logged in" });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET); // { id, role, iat, exp }
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired token" });
    }
}

// Allows only the listed roles. Always put it AFTER requireAuth.
// Example: router.post('/', requireAuth, requireRole('organizer'), handler)
export const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden" });
    }
    next();
};