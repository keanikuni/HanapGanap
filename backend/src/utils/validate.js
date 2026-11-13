// Small input checks shared by the routes, so bad input becomes a clean 400
// instead of a Prisma error and a 500.

const MAX_INT = 2147483647; // largest value the Int columns in Postgres can hold

// Turns an id from a URL, query string or JSON body into a positive integer.
// Returns null for anything else (letters, decimals, 0, negatives, too big, booleans, arrays...).
export function toId(value) {
    if (typeof value === 'string' && /^\d{1,10}$/.test(value)) value = Number(value);
    if (typeof value !== 'number') return null;
    return Number.isInteger(value) && value >= 1 && value <= MAX_INT ? value : null;
}

// A real string that isn't blank and isn't longer than `max` characters
export const isNonEmptyString = (value, max = 255) =>
    typeof value === 'string' && value.trim().length > 0 && value.length <= max;

// Deliberately simple: something@something.tld, no spaces
export const isEmail = (value) =>
    typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Builds a router.param() handler that checks an id once for every route that uses it.
// Example: router.param('id', idParam('eventId', 'Invalid event id'))
// -> a valid /events/5 sets req.eventId = 5, a bad /events/abc answers 400.
export const idParam = (propertyName, message) => (req, res, next, value) => {
    const id = toId(value);
    if (id === null) return res.status(400).json({ message });
    req[propertyName] = id;
    next();
};
