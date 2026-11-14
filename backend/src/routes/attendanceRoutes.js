import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { toId, isNonEmptyString } from '../utils/validate.js';

const router = express.Router();

// Confirms the logged-in organizer owns the event and that attendance can still be taken.
// Sends the error response itself and returns false if something is wrong.
async function ownsOpenEvent(req, res, event) {
    const organizer = await prisma.organizer.findUnique({ where: { userId: req.user.id } });
    if (!organizer || event.organizerId !== organizer.id) {
        res.status(403).json({ message: "You don't own this event" });
        return false;
    }
    if (event.status === 'cancelled' || event.status === 'completed') {
        res.status(409).json({ message: `Event is ${event.status}` });
        return false;
    }
    return true;
}

// Marks a registration as attended. Returns { already, attendance }.
// Safe against double scans: the second one finds it confirmed and changes nothing.
async function confirmAttendance(registrationId) {
    const now = new Date();

    // registrationId is @unique on Attendance, so a second create throws P2002
    try {
        const attendance = await prisma.attendance.create({
            data: { registrationId, isConfirm: true, inTime: now },
        });
        return { already: false, attendance };
    } catch (err) {
        if (err.code !== 'P2002') throw err;
    }

    // A row already exists: confirm it only if it isn't confirmed yet (one atomic query)
    const { count } = await prisma.attendance.updateMany({
        where: { registrationId, isConfirm: false },
        data: { isConfirm: true, inTime: now },
    });
    const attendance = await prisma.attendance.findUnique({ where: { registrationId } });
    return { already: count === 0, attendance };
}

// ─── Scan a student's QR code (organizer) ─────────────────
// The QR holds the student's personal qrToken. The organizer's scanner sends it
// together with the event it is scanning for.
router.post('/scan', requireAuth, requireRole('organizer'), async (req, res) => {
    const eventId = toId(req.body.eventId);
    const { qrToken } = req.body;

    if (eventId === null || !isNonEmptyString(qrToken, 100)) {
        return res.status(400).json({ message: "eventId and qrToken are required" });
    }

    try {
        const event = await prisma.event.findUnique({ where: { id: eventId } });
        if (!event) return res.status(404).json({ message: "Event not found" });
        if (!(await ownsOpenEvent(req, res, event))) return;

        const student = await prisma.student.findUnique({
            where: { qrToken },
            select: { userId: true, studentNumber: true, user: { select: { id: true, fullName: true } } },
        });
        if (!student) return res.status(404).json({ message: "Unknown QR code" });

        const attendee = { id: student.user.id, fullName: student.user.fullName, studentNumber: student.studentNumber };

        const registration = await prisma.registration.findUnique({
            where: { userId_eventId: { userId: student.userId, eventId: event.id } },
        });
        if (!registration) {
            return res.status(404).json({ message: "This student is not registered for this event", attendee });
        }

        const { already, attendance } = await confirmAttendance(registration.id);
        if (already) {
            return res.status(409).json({ message: "Already checked in", attendee, attendance });
        }

        res.status(201).json({ attendee, event: { id: event.id, title: event.title }, attendance });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Manual check-in by registration id (organizer) ───────
// Fallback for guests (who have no QR code) or a student whose phone died.
router.post('/check-in', requireAuth, requireRole('organizer'), async (req, res) => {
    const registrationId = toId(req.body.registrationId);
    if (registrationId === null) {
        return res.status(400).json({ message: "registrationId is required" });
    }

    try {
        const registration = await prisma.registration.findUnique({
            where: { id: registrationId },
            include: { event: true, user: { select: { id: true, fullName: true } } },
        });
        if (!registration) return res.status(404).json({ message: "Registration not found" });
        if (!(await ownsOpenEvent(req, res, registration.event))) return;

        const attendee = { id: registration.user.id, fullName: registration.user.fullName };

        const { already, attendance } = await confirmAttendance(registration.id);
        if (already) {
            return res.status(409).json({ message: "Already checked in", attendee, attendance });
        }

        res.status(201).json({
            attendee,
            event: { id: registration.event.id, title: registration.event.title },
            attendance,
        });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;