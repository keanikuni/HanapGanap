import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { upload, removeFiles, removeStoredImage, MAX_FILES } from '../middleware/uploadMiddleware.js';

const router = express.Router();

const VALID_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];
const MAX_IMAGES_PER_EVENT = 10;

// Validates :id once for every route that uses it
router.param('id', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid event id" });
    req.eventId = +id;
    next();
});

// Validates :imageId for the image delete route
router.param('imageId', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid image id" });
    req.imageId = +id;
    next();
});

// Loads the event and checks the logged-in organizer owns it.
// Sends the error response itself and returns null if something is wrong.
async function loadOwnedEvent(req, res) {
    const event = await prisma.event.findUnique({ where: { id: req.eventId } });
    if (!event) {
        res.status(404).json({ message: "Event not found" });
        return null;
    }
    const organizer = await prisma.organizer.findUnique({ where: { userId: req.user.id } });
    if (!organizer || event.organizerId !== organizer.id) {
        res.status(403).json({ message: "You don't own this event" });
        return null;
    }
    return event;
}

// Checks the date/limit rules; returns an error message or null
function validateEventFields({ startDatetime, endDatetime, registrationDeadline, participantLimit }) {
    if ([startDatetime, endDatetime, registrationDeadline].some((d) => isNaN(d))) {
        return "Invalid date format";
    }
    if (endDatetime <= startDatetime) return "End must be after start";
    if (registrationDeadline > startDatetime) return "Registration deadline must be on or before the event start";
    if (!Number.isInteger(participantLimit) || participantLimit < 1) return "participantLimit must be a positive whole number";
    return null;
}

// The first uploaded image is the event's preview/cover
const IMAGES_INCLUDE = { orderBy: { uploadedAt: 'asc' } };

// ─── Browse events (public) ───────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { universityId, categoryId, status, search } = req.query;

        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const events = await prisma.event.findMany({
            where: {
                ...(universityId && { universityId: +universityId }),
                ...(categoryId && { categoryId: +categoryId }),
                ...(status && { status }),
                ...(search && { title: { contains: search, mode: 'insensitive' } }),
            },
            include: {
                category: true,
                university: { select: { id: true, name: true } },
                organizer: { select: { id: true, orgName: true } },
                images: IMAGES_INCLUDE,
                _count: { select: { registrations: true } },
            },
            orderBy: { startDatetime: 'asc' },
        });
        res.json(events);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Single event (public) ────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.eventId },
            include: {
                category: true,
                university: true,
                organizer: { select: { id: true, orgName: true } },
                images: IMAGES_INCLUDE,
                _count: { select: { registrations: true } },
            },
        });
        if (!event) return res.status(404).json({ message: "Event not found" });
        res.json(event);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Create event (organizer) ─────────────────────────────
router.post('/', requireAuth, requireRole('organizer'), async (req, res) => {
    const { categoryId, title, description, venue, participantLimit } = req.body;

    if (!categoryId || !title || !description || !venue || !participantLimit
        || !req.body.startDatetime || !req.body.endDatetime || !req.body.registrationDeadline) {
        return res.status(400).json({ message: "Missing required event fields" });
    }

    const startDatetime = new Date(req.body.startDatetime);
    const endDatetime = new Date(req.body.endDatetime);
    const registrationDeadline = new Date(req.body.registrationDeadline);

    const problem = validateEventFields({ startDatetime, endDatetime, registrationDeadline, participantLimit: +participantLimit });
    if (problem) return res.status(400).json({ message: problem });

    try {
        const organizer = await prisma.organizer.findUnique({ where: { userId: req.user.id } });
        if (!organizer) return res.status(403).json({ message: "Organizer profile not found" });

        const event = await prisma.event.create({
            data: {
                title,
                description,
                venue,
                categoryId: +categoryId,
                participantLimit: +participantLimit,
                startDatetime,
                endDatetime,
                registrationDeadline,
                organizerId: organizer.id,           // taken from the token, never the body
                universityId: organizer.universityId,
            },
        });
        res.status(201).json(event);
    } catch (err) {
        if (err.code === 'P2003') return res.status(400).json({ message: "Invalid category" });
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Update event (owner) ─────────────────────────────────
router.patch('/:id', requireAuth, requireRole('organizer'), async (req, res) => {
    try {
        const event = await loadOwnedEvent(req, res);
        if (!event) return;

        if (event.status === 'completed' || event.status === 'cancelled') {
            return res.status(409).json({ message: `A ${event.status} event can't be edited` });
        }

        // Whitelist: only these fields can be changed
        const { title, description, venue, categoryId, status } = req.body;
        const startDatetime = req.body.startDatetime ? new Date(req.body.startDatetime) : event.startDatetime;
        const endDatetime = req.body.endDatetime ? new Date(req.body.endDatetime) : event.endDatetime;
        const registrationDeadline = req.body.registrationDeadline ? new Date(req.body.registrationDeadline) : event.registrationDeadline;
        const participantLimit = req.body.participantLimit !== undefined ? +req.body.participantLimit : event.participantLimit;

        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const problem = validateEventFields({ startDatetime, endDatetime, registrationDeadline, participantLimit });
        if (problem) return res.status(400).json({ message: problem });

        // Can't shrink the limit below the people already registered
        const registered = await prisma.registration.count({ where: { eventId: event.id } });
        if (participantLimit < registered) {
            return res.status(409).json({ message: `Already ${registered} registered; limit can't be lower` });
        }

        const updated = await prisma.event.update({
            where: { id: event.id },
            data: {
                ...(title && { title }),
                ...(description && { description }),
                ...(venue && { venue }),
                ...(categoryId && { categoryId: +categoryId }),
                ...(status && { status }),
                startDatetime,
                endDatetime,
                registrationDeadline,
                participantLimit,
            },
        });
        res.json(updated);
    } catch (err) {
        if (err.code === 'P2003') return res.status(400).json({ message: "Invalid category" });
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Delete / cancel event (owner or admin) ───────────────
router.delete('/:id', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
    try {
        let event;
        if (req.user.role === 'admin') {
            event = await prisma.event.findUnique({ where: { id: req.eventId } });
            if (!event) return res.status(404).json({ message: "Event not found" });
        } else {
            event = await loadOwnedEvent(req, res);
            if (!event) return;
        }

        const registered = await prisma.registration.count({ where: { eventId: event.id } });

        // Registration uses onDelete: Restrict, so an event with registrants
        // can't be hard-deleted. Cancel it instead.
        if (registered > 0) {
            await prisma.event.update({ where: { id: event.id }, data: { status: 'cancelled' } });
            return res.json({ message: "Event has registrants, so it was marked as cancelled" });
        }

        // Image rows cascade-delete with the event, but the files stay on disk,
        // so grab the names first and remove the files afterwards.
        const images = await prisma.image.findMany({ where: { eventId: event.id } });
        await prisma.event.delete({ where: { id: event.id } });
        await Promise.all(images.map((i) => removeStoredImage(i.fileName)));

        res.json({ message: "Event deleted" });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Upload images (owner) ────────────────────────────────
// Form-data field name: "images" (up to MAX_FILES files per request)
router.post('/:id/images', requireAuth, requireRole('organizer'),
    upload.array('images', MAX_FILES),   // runs after the auth checks, so strangers can't write files
    async (req, res) => {
        const files = req.files ?? [];
        try {
            if (files.length === 0) {
                return res.status(400).json({ message: "Attach at least one image in the 'images' field" });
            }

            const event = await loadOwnedEvent(req, res);
            if (!event) return removeFiles(files);       // multer already saved them, so delete

            const existing = await prisma.image.count({ where: { eventId: event.id } });
            if (existing + files.length > MAX_IMAGES_PER_EVENT) {
                await removeFiles(files);
                return res.status(409).json({ message: `An event can have at most ${MAX_IMAGES_PER_EVENT} images` });
            }

            const images = await prisma.$transaction(
                files.map((f) =>
                    prisma.image.create({
                        data: { eventId: event.id, fileName: f.filename, filePath: `/uploads/${f.filename}` },
                    })
                )
            );
            res.status(201).json(images);
        } catch (err) {
            await removeFiles(files);                    // DB insert failed, so don't leave orphan files
            console.log(err.message);
            res.sendStatus(500);
        }
    }
);

// ─── Delete one image (owner) ─────────────────────────────
router.delete('/:id/images/:imageId', requireAuth, requireRole('organizer'), async (req, res) => {
    try {
        const event = await loadOwnedEvent(req, res);
        if (!event) return;

        const image = await prisma.image.findFirst({ where: { id: req.imageId, eventId: event.id } });
        if (!image) return res.status(404).json({ message: "Image not found" });

        await prisma.image.delete({ where: { id: image.id } });
        await removeStoredImage(image.fileName);
        res.json({ message: "Image deleted" });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;