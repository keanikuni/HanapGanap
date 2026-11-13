import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { idParam, isNonEmptyString } from '../utils/validate.js';

const router = express.Router();

const NOTIFICATION_TYPES = ['reminder', 'schedule_change', 'cancellation', 'announcement'];

router.param('eventId', idParam('eventId', "Invalid event id"));

// ─── My notifications ─────────────────────────────────────
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const limit = Math.min(Math.max(Math.floor(+req.query.limit) || 20, 1), 100);
        const page = Math.min(Math.max(Math.floor(+req.query.page) || 1, 1), 100000);

        const where = { userId: req.user.id };

        const [notifications, total] = await Promise.all([
            prisma.notification.findMany({
                where,
                select: {
                    id: true,
                    title: true,
                    message: true,
                    type: true,
                    createdAt: true,
                    event: { select: { id: true, title: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: (page - 1) * limit,
            }),
            prisma.notification.count({ where }),
        ]);

        res.json({ page, limit, total, notifications });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Notify an event's registrants (owner) ────────────────
router.post('/events/:eventId/notify', requireAuth, requireRole('organizer'), async (req, res) => {
    const { title, message, type = 'announcement' } = req.body ?? {};

    if (!title || !message) {
        return res.status(400).json({ message: "title and message are required" });
    }
    if (!isNonEmptyString(title, 200) || !isNonEmptyString(message, 5000)) {
        return res.status(400).json({ message: "title (up to 200 characters) and message (up to 5000) must be text" });
    }
    if (!NOTIFICATION_TYPES.includes(type)) {
        return res.status(400).json({ message: `type must be one of: ${NOTIFICATION_TYPES.join(', ')}` });
    }

    try {
        const event = await prisma.event.findUnique({
            where: { id: req.eventId },
            include: { organizer: { select: { userId: true } } },
        });
        if (!event) return res.status(404).json({ message: "Event not found" });
        if (event.organizer.userId !== req.user.id) {
            return res.status(403).json({ message: "You don't own this event" });
        }
        if (event.status === 'completed') {
            return res.status(409).json({ message: "Event is completed" });
        }

        const registrations = await prisma.registration.findMany({
            where: { eventId: event.id },
            select: { userId: true },
        });
        if (registrations.length === 0) {
            return res.status(409).json({ message: "No registrants to notify" });
        }

        // One row per registrant, inserted in a single query
        const result = await prisma.notification.createMany({
            data: registrations.map((r) => ({
                eventId: event.id,
                userId: r.userId,
                title,
                message,
                type,
            })),
        });

        res.status(201).json({ sent: result.count });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;