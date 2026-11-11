import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { HttpError } from '../utils/httpError.js';

const router = express.Router();

function handleError(err, res) {
    if (err instanceof HttpError) return res.status(err.status).json({ message: err.message });
    if (err.code === 'P2002') return res.status(409).json({ message: "You're already registered for this event" });
    console.log(err.message);
    res.sendStatus(500);
}

// Validates :id for the routes below that use it
router.param('id', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid event id" });
    req.eventId = +id;
    next();
});

// ─── Register for an event ────────────────────────────────
router.post('/events/:id/register', requireAuth, requireRole('guest', 'student', 'organizer'), async (req, res) => {
    try {
        const registration = await prisma.$transaction(async (tx) => {
            // Lock the event row so two people can't grab the last slot at the same time.
            // Other registrations for this event wait here until this transaction finishes.
            await tx.$queryRaw`SELECT event_id FROM events WHERE event_id = ${req.eventId} FOR UPDATE`;

            const event = await tx.event.findUnique({ where: { id: req.eventId } });
            if (!event) throw new HttpError(404, "Event not found");

            if (event.status !== 'upcoming') {
                throw new HttpError(409, `Registration is closed: event is ${event.status}`);
            }
            if (new Date() > event.registrationDeadline) {
                throw new HttpError(409, "The registration deadline has passed");
            }

            const count = await tx.registration.count({ where: { eventId: event.id } });
            if (count >= event.participantLimit) {
                throw new HttpError(409, "This event is full");
            }

            // Duplicate registrations are blocked by @@unique([userId, eventId]) -> P2002
            return tx.registration.create({
                data: { userId: req.user.id, eventId: event.id, isConfirmed: true },
                include: {
                    event: { select: { id: true, title: true, venue: true, startDatetime: true } },
                },
            });
        });

        res.status(201).json(registration);
    } catch (err) {
        handleError(err, res);
    }
});

// ─── Cancel your registration ─────────────────────────────
router.delete('/events/:id/register', requireAuth, async (req, res) => {
    try {
        const registration = await prisma.registration.findUnique({
            where: { userId_eventId: { userId: req.user.id, eventId: req.eventId } },
            include: { event: true, attendance: true },
        });
        if (!registration) return res.status(404).json({ message: "You're not registered for this event" });

        if (registration.event.status !== 'upcoming') {
            return res.status(409).json({ message: "Can't cancel: event has already started or ended" });
        }
        if (registration.attendance?.inTime) {
            return res.status(409).json({ message: "Can't cancel after check-in" });
        }

        // The attendance row (if any) is removed with it
        await prisma.registration.delete({ where: { id: registration.id } });
        res.json({ message: "Registration cancelled" });
    } catch (err) {
        handleError(err, res);
    }
});

// ─── My registrations ─────────────────────────────────────
router.get('/registrations/mine', requireAuth, async (req, res) => {
    try {
        const registrations = await prisma.registration.findMany({
            where: { userId: req.user.id },
            include: {
                event: {
                    select: {
                        id: true, title: true, venue: true, status: true,
                        startDatetime: true, endDatetime: true,
                        university: { select: { id: true, name: true } },
                    },
                },
                attendance: true,
            },
            orderBy: { registeredAt: 'desc' },
        });

        // Certificates are generated on demand, so the frontend only needs to know
        // whether to show a "Download certificate" button for each registration.
        const now = new Date();
        res.json(
            registrations.map((r) => ({
                ...r,
                certificateAvailable:
                    r.event.status !== 'cancelled' &&
                    (r.event.status === 'completed' || r.event.endDatetime < now) &&
                    !!r.attendance?.inTime,
            }))
        );
    } catch (err) {
        handleError(err, res);
    }
});

// ─── Participant list (owner organizer or admin) ──────────
router.get('/events/:id/participants', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
    try {
        const event = await prisma.event.findUnique({ where: { id: req.eventId } });
        if (!event) return res.status(404).json({ message: "Event not found" });

        if (req.user.role === 'organizer') {
            const organizer = await prisma.organizer.findUnique({ where: { userId: req.user.id } });
            if (!organizer || event.organizerId !== organizer.id) {
                return res.status(403).json({ message: "You don't own this event" });
            }
        }

        const participants = await prisma.registration.findMany({
            where: { eventId: event.id },
            select: {
                id: true,
                isConfirmed: true,
                registeredAt: true,
                user: {
                    select: {
                        id: true, fullName: true, email: true, role: true,
                        student: { select: { studentNumber: true, courseProgram: true, yearLevel: true } },
                        guest: { select: { contactNumber: true, schoolOrAffiliation: true } },
                    },
                },
                attendance: { select: { inTime: true, outTime: true } },
            },
            orderBy: { registeredAt: 'asc' },
        });

        res.json({
            event: { id: event.id, title: event.title, participantLimit: event.participantLimit },
            total: participants.length,
            participants,
        });
    } catch (err) {
        handleError(err, res);
    }
});

export default router;