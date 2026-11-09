import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// Reads registrationId from the body, loads the registration, and confirms
// the logged-in organizer owns the event. Sends the error response itself
// and returns null if anything is wrong.
async function loadOwnedRegistration(req, res) {
    const registrationId = Number(req.body.registrationId);
    if (!Number.isInteger(registrationId)) {
        res.status(400).json({ message: "registrationId is required" });
        return null;
    }

    const registration = await prisma.registration.findUnique({
        where: { id: registrationId },
        include: {
            event: true,
            user: { select: { id: true, fullName: true } },
        },
    });
    if (!registration) {
        res.status(404).json({ message: "Registration not found" });
        return null;
    }

    const organizer = await prisma.organizer.findUnique({ where: { userId: req.user.id } });
    if (!organizer || registration.event.organizerId !== organizer.id) {
        res.status(403).json({ message: "You don't own this event" });
        return null;
    }

    if (registration.event.status === 'cancelled' || registration.event.status === 'completed') {
        res.status(409).json({ message: `Event is ${registration.event.status}` });
        return null;
    }

    return registration;
}

// ─── Check in ─────────────────────────────────────────────
router.post('/check-in', requireAuth, requireRole('organizer'), async (req, res) => {
    try {
        const registration = await loadOwnedRegistration(req, res);
        if (!registration) return;

        const attendance = await prisma.attendance.create({
            data: { registrationId: registration.id, inTime: new Date() },
        });

        res.status(201).json({
            attendee: registration.user,
            event: { id: registration.event.id, title: registration.event.title },
            attendance,
        });
    } catch (err) {
        // registrationId is @unique on Attendance, so a second check-in throws P2002
        if (err.code === 'P2002') {
            return res.status(409).json({ message: "Already checked in" });
        }
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Check out ────────────────────────────────────────────
router.post('/check-out', requireAuth, requireRole('organizer'), async (req, res) => {
    try {
        const registration = await loadOwnedRegistration(req, res);
        if (!registration) return;

        // Only matches rows that are checked in and not yet checked out,
        // so the rule is enforced in one atomic query.
        const result = await prisma.attendance.updateMany({
            where: { registrationId: registration.id, inTime: { not: null }, outTime: null },
            data: { outTime: new Date() },
        });
        if (result.count === 0) {
            return res.status(409).json({ message: "Not checked in yet, or already checked out" });
        }

        const attendance = await prisma.attendance.findUnique({
            where: { registrationId: registration.id },
        });
        res.json({
            attendee: registration.user,
            event: { id: registration.event.id, title: registration.event.title },
            attendance,
        });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;