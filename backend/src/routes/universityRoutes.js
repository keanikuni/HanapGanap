import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.param('id', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid university id" });
    req.universityId = +id;
    next();
});

// Cleans up a domain: " @School.edu.ph " -> "school.edu.ph"
const cleanDomain = (d) => String(d).trim().toLowerCase().replace(/^@/, '');

// ─── List active universities (public) ────────────────────
// Used by the registration form dropdown and the event filters
router.get('/', async (req, res) => {
    try {
        const universities = await prisma.university.findMany({
            where: { isActive: true },
            select: { id: true, name: true, emailDomain: true, address: true },
            orderBy: { name: 'asc' },
        });
        res.json(universities);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── List ALL universities, including inactive (admin) ────
router.get('/all', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        const universities = await prisma.university.findMany({ orderBy: { name: 'asc' } });
        res.json(universities);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Add a university (admin) ─────────────────────────────
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, emailDomain, address } = req.body;

    if (!name || !emailDomain || !address) {
        return res.status(400).json({ message: "name, emailDomain and address are required" });
    }

    try {
        const university = await prisma.university.create({
            data: { name: name.trim(), emailDomain: cleanDomain(emailDomain), address: address.trim() },
        });
        res.status(201).json(university);
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ message: "A university with that name already exists" });
        }
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Edit or deactivate a university (admin) ──────────────
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { name, emailDomain, address, isActive } = req.body;

    if (isActive !== undefined && typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive must be true or false" });
    }

    // Whitelist: only these fields can be changed
    const data = {
        ...(name && { name: name.trim() }),
        ...(emailDomain && { emailDomain: cleanDomain(emailDomain) }),
        ...(address && { address: address.trim() }),
        ...(isActive !== undefined && { isActive }),
    };
    if (Object.keys(data).length === 0) {
        return res.status(400).json({ message: "Nothing to update" });
    }

    try {
        const university = await prisma.university.update({
            where: { id: req.universityId },
            data,
        });
        res.json(university);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ message: "University not found" });
        if (err.code === 'P2002') return res.status(409).json({ message: "A university with that name already exists" });
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;