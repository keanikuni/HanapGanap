import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';

// Checks the Authorization header ("Bearer <token>") and puts { id, role } on req.user.
// Use it on any route that needs a login.
//
// The token proves who the person is, but the account is looked up in the database on
// every request, so a deleted account stops working straight away and a changed role
// takes effect immediately instead of staying baked into the token for up to 24 hours.
export async function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
        return res.status(401).json({ message: "Not logged in" });
    }

    let payload;
    try {
        // Only accept the algorithm we sign with (HS256)
        payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
    if (!Number.isInteger(payload.id)) {
        return res.status(401).json({ message: "Invalid or expired token" });
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: payload.id },
            select: { id: true, role: true },
        });
        if (!user) return res.status(401).json({ message: "Account no longer exists" });

        req.user = { id: user.id, role: user.role };
        next();
    } catch (err) {
        next(err); // database problem -> errorHandler answers 500
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
