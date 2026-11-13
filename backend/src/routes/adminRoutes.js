import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';
import { toId, idParam } from '../utils/validate.js';

const router = express.Router();

// Everything in this file requires a logged-in admin
router.use(requireAuth, requireRole('admin'));

const VALID_ROLES = ['guest', 'student', 'organizer', 'admin'];
const VALID_STATUSES = ['upcoming', 'ongoing', 'completed', 'cancelled'];

router.param('id', idParam('targetId', "Invalid id"));

// Reads ?page= and ?limit= safely
function getPaging(query) {
    const limit = Math.min(Math.max(Math.floor(+query.limit) || 20, 1), 100);
    const page = Math.min(Math.max(Math.floor(+query.page) || 1, 1), 100000);
    return { limit, page, skip: (page - 1) * limit };
}

// ─── List users ───────────────────────────────────────────
// ?role=student&verified=false&search=juan&page=1&limit=20
router.get('/users', async (req, res) => {
    try {
        const { role, verified, search } = req.query;
        const { limit, page, skip } = getPaging(req.query);

        if (role && !VALID_ROLES.includes(role)) {
            return res.status(400).json({ message: "Invalid role" });
        }
        if (search && typeof search !== 'string') {
            return res.status(400).json({ message: "Invalid search" });
        }

        const where = {
            ...(role && { role }),
            ...(verified !== undefined && { emailVerified: verified === 'true' }),
            ...(search && {
                OR: [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ],
            }),
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                omit: { passwordHash: true },
                include: {
                    student: { select: { studentNumber: true, university: { select: { name: true } } } },
                    organizer: { select: { orgName: true, university: { select: { name: true } } } },
                    guest: { select: { contactNumber: true, schoolOrAffiliation: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            prisma.user.count({ where }),
        ]);

        res.json({ page, limit, total, users });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Update a user's verification status ──────────────────
router.patch('/users/:id', async (req, res) => {
    const { emailVerified } = req.body;

    if (typeof emailVerified !== 'boolean') {
        return res.status(400).json({ message: "emailVerified must be true or false" });
    }

    try {
        const user = await prisma.user.update({
            where: { id: req.targetId },
            data: { emailVerified },
            omit: { passwordHash: true },
        });
        res.json(user);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ message: "User not found" });
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── All events, for review ───────────────────────────────
// ?status=upcoming&universityId=1&search=summit&page=1&limit=20
router.get('/events', async (req, res) => {
    try {
        const { status, universityId, search } = req.query;
        const { limit, page, skip } = getPaging(req.query);

        if (status && !VALID_STATUSES.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }
        if (universityId && toId(universityId) === null) {
            return res.status(400).json({ message: "Invalid universityId" });
        }
        if (search && typeof search !== 'string') {
            return res.status(400).json({ message: "Invalid search" });
        }

        const where = {
            ...(status && { status }),
            ...(universityId && { universityId: toId(universityId) }),
            ...(search && { title: { contains: search, mode: 'insensitive' } }),
        };

        const [events, total] = await Promise.all([
            prisma.event.findMany({
                where,
                include: {
                    category: { select: { id: true, name: true } },
                    university: { select: { id: true, name: true } },
                    organizer: {
                        select: { id: true, orgName: true, user: { select: { fullName: true, email: true } } },
                    },
                    _count: { select: { registrations: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip,
            }),
            prisma.event.count({ where }),
        ]);

        res.json({ page, limit, total, events });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Dashboard stats ──────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [usersByRole, eventsByStatus, registrations, attended, universities, unverifiedUsers] =
            await Promise.all([
                prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
                prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
                prisma.registration.count(),
                prisma.attendance.count({ where: { inTime: { not: null } } }),
                prisma.university.count({ where: { isActive: true } }),
                prisma.user.count({ where: { emailVerified: false } }),
            ]);

        // Turn [{ role: 'student', _count: { _all: 5 } }] into { student: 5 },
        // with zeros filled in for roles/statuses that have no rows
        const users = Object.fromEntries(VALID_ROLES.map((r) => [r, 0]));
        usersByRole.forEach((row) => { users[row.role] = row._count._all; });

        const events = Object.fromEntries(VALID_STATUSES.map((s) => [s, 0]));
        eventsByStatus.forEach((row) => { events[row.status] = row._count._all; });

        res.json({
            users: { total: Object.values(users).reduce((a, b) => a + b, 0), byRole: users, unverified: unverifiedUsers },
            events: { total: Object.values(events).reduce((a, b) => a + b, 0), byStatus: events },
            registrations,
            attended,
            activeUniversities: universities,
        });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;