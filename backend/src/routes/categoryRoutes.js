import express from 'express';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

router.param('id', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid category id" });
    req.categoryId = +id;
    next();
});

// ─── List categories (public) ─────────────────────────────
// Used by the event filters and the "create event" form
router.get('/', async (req, res) => {
    try {
        const categories = await prisma.eventCategory.findMany({
            select: {
                id: true,
                name: true,
                _count: { select: { events: true } },
            },
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Create a category (admin) ────────────────────────────
router.post('/', requireAuth, requireRole('admin'), async (req, res) => {
    const name = req.body.name?.trim();

    if (!name) {
        return res.status(400).json({ message: "name is required" });
    }

    try {
        const category = await prisma.eventCategory.create({ data: { name } });
        res.status(201).json(category);
    } catch (err) {
        if (err.code === 'P2002') {
            return res.status(409).json({ message: "That category already exists" });
        }
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Rename a category (admin) ────────────────────────────
router.patch('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const name = req.body.name?.trim();

    if (!name) {
        return res.status(400).json({ message: "name is required" });
    }

    try {
        const category = await prisma.eventCategory.update({
            where: { id: req.categoryId },
            data: { name },
        });
        res.json(category);
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ message: "Category not found" });
        if (err.code === 'P2002') return res.status(409).json({ message: "That category already exists" });
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Delete a category (admin) ────────────────────────────
router.delete('/:id', requireAuth, requireRole('admin'), async (req, res) => {
    try {
        await prisma.eventCategory.delete({ where: { id: req.categoryId } });
        res.json({ message: "Category deleted" });
    } catch (err) {
        if (err.code === 'P2025') return res.status(404).json({ message: "Category not found" });
        // Event.category uses onDelete: Restrict
        if (err.code === 'P2003') {
            return res.status(409).json({ message: "Category is used by existing events and can't be deleted" });
        }
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;