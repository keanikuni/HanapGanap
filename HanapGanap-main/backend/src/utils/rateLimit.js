// A tiny in-memory rate limiter (no extra package needed).
// Counts requests per IP address in a fixed time window. Good enough for one server
// process; if you ever run several copies, switch to a shared store such as the
// express-rate-limit package with Redis.
//
// Set RATE_LIMIT_DISABLED=true in .env to turn it off (handy for repeated API test runs).
export function rateLimit({ windowMs, max, message = 'Too many requests, please try again later' }) {
    const hits = new Map(); // ip -> { count, resetAt }

    // Forget old entries now and then so the map can't grow forever
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) if (entry.resetAt <= now) hits.delete(ip);
    }, windowMs).unref();

    return (req, res, next) => {
        if (process.env.RATE_LIMIT_DISABLED === 'true') return next();

        const now = Date.now();
        let entry = hits.get(req.ip);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(req.ip, entry);
        }

        entry.count++;
        if (entry.count > max) {
            res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
            return res.status(429).json({ message });
        }
        next();
    };
}
