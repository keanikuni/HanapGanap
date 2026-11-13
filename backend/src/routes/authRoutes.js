import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

const SELF_REGISTER_ROLES = ['guest', 'student', 'organizer']; // never 'admin'

const signToken = (user) =>
    jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });

router.post('/register', async (req, res) => {
    const { fullName, email, password, role, ...profile } = req.body;

    if (!fullName || !email || !password || !role) {
        return res.status(400).json({ message: "fullName, email, password and role are required" });
    }
    if (!SELF_REGISTER_ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }

    try {
        // Build the role-specific profile
        let profileData;
        if (role === 'student') {
            const { universityId, studentNumber, courseProgram, yearLevel } = profile;
            if (!universityId || !studentNumber || !courseProgram || !yearLevel) {
                return res.status(400).json({ message: "Missing student details" });
            }
            const university = await prisma.university.findUnique({ where: { id: +universityId } });
            if (!university || !university.isActive) {
                return res.status(400).json({ message: "University not found" });
            }
            if (!email.toLowerCase().endsWith('@' + university.emailDomain)) {
                return res.status(400).json({ message: `Use your @${university.emailDomain} email` });
            }
            profileData = { student: { create: { universityId: +universityId, studentNumber, courseProgram, yearLevel } } };
        } else if (role === 'organizer') {
            const { universityId, orgName } = profile;
            if (!universityId || !orgName) {
                return res.status(400).json({ message: "Missing organizer details" });
            }
            profileData = { organizer: { create: { universityId: +universityId, orgName } } };
        } else {
            const { contactNumber, schoolOrAffiliation } = profile;
            if (!contactNumber) {
                return res.status(400).json({ message: "contactNumber is required" });
            }
            profileData = { guest: { create: { contactNumber, schoolOrAffiliation } } };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                fullName,
                email: email.toLowerCase(),
                passwordHash,
                role,
                ...profileData,
            },
            omit: { passwordHash: true },
        });

        res.status(201).json({ token: signToken(user), user });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "This account already registered" });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ message: "Invalid university" });
        }
        console.log(error.message);
        res.sendStatus(500);
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
        const passwordIsValid = user && await bcrypt.compare(password, user.passwordHash);
        if (!passwordIsValid) {
            return res.status(401).json({ message: "Invalid email or password" });
        }
        res.json({
            token: signToken(user),
            user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
        });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

router.get('/me', requireAuth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            omit: { passwordHash: true },
            include: { guest: true, student: { include: { university: true } }, organizer: true, admin: true },
        });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;