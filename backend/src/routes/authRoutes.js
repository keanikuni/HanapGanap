import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { rateLimit } from '../utils/rateLimit.js';
import { toId, isNonEmptyString, isEmail } from '../utils/validate.js';

const router = express.Router();

const SELF_REGISTER_ROLES = ['guest', 'student', 'organizer']; // never 'admin'

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72; // bcrypt silently ignores everything after 72 bytes

// Slow down password guessing and mass sign-ups (per IP address)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "Too many login attempts, please try again in a few minutes",
});
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    message: "Too many sign-ups from this address, please try again later",
});

// bcrypt takes a moment to run. When the email doesn't exist we still run it against this
// throwaway hash, so a wrong email and a wrong password take the same time to answer.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const signToken = (user) =>
    jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        algorithm: 'HS256',
        expiresIn: '24h',
    });

// Students and organizers must belong to an active university and use that university's
// email domain. Returns { error } for the 400 response, or { universityId }.
async function checkUniversityEmail(universityIdInput, email) {
    const universityId = toId(universityIdInput);
    if (universityId === null) return { error: "A valid universityId is required" };

    const university = await prisma.university.findUnique({ where: { id: universityId } });
    if (!university || !university.isActive) return { error: "University not found" };

    if (!email.endsWith('@' + university.emailDomain.toLowerCase())) {
        return { error: `Use your @${university.emailDomain} email` };
    }
    return { universityId };
}

router.post('/register', registerLimiter, async (req, res) => {
    const { fullName, email: rawEmail, password, role, ...profile } = req.body ?? {};

    if (!fullName || !rawEmail || !password || !role) {
        return res.status(400).json({ message: "fullName, email, password and role are required" });
    }
    if (!SELF_REGISTER_ROLES.includes(role)) {
        return res.status(400).json({ message: "Invalid role" });
    }
    if (!isNonEmptyString(fullName, 100)) {
        return res.status(400).json({ message: "fullName must be text of up to 100 characters" });
    }
    if (!isEmail(rawEmail)) {
        return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (typeof password !== 'string'
        || password.length < MIN_PASSWORD_LENGTH
        || Buffer.byteLength(password) > MAX_PASSWORD_BYTES) {
        return res.status(400).json({
            message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters (and at most ${MAX_PASSWORD_BYTES} bytes)`,
        });
    }

    const email = rawEmail.trim().toLowerCase();

    try {
        // Build the role-specific profile
        let profileData;
        if (role === 'student') {
            const { universityId: universityIdInput, studentNumber, courseProgram, yearLevel } = profile;
            if (!universityIdInput || !studentNumber || !courseProgram || !yearLevel) {
                return res.status(400).json({ message: "Missing student details" });
            }
            if (![studentNumber, courseProgram, yearLevel].every((v) => isNonEmptyString(v, 100))) {
                return res.status(400).json({ message: "Student details must be text of up to 100 characters" });
            }
            const check = await checkUniversityEmail(universityIdInput, email);
            if (check.error) return res.status(400).json({ message: check.error });

            profileData = {
                student: {
                    create: {
                        universityId: check.universityId,
                        studentNumber: studentNumber.trim(),
                        courseProgram: courseProgram.trim(),
                        yearLevel: yearLevel.trim(),
                    },
                },
            };
        } else if (role === 'organizer') {
            const { universityId: universityIdInput, orgName } = profile;
            if (!universityIdInput || !orgName) {
                return res.status(400).json({ message: "Missing organizer details" });
            }
            if (!isNonEmptyString(orgName, 150)) {
                return res.status(400).json({ message: "orgName must be text of up to 150 characters" });
            }
            // Same rule as students: an organizer must use their university's email,
            // so nobody can publish events in the name of a school they don't belong to.
            const check = await checkUniversityEmail(universityIdInput, email);
            if (check.error) return res.status(400).json({ message: check.error });

            profileData = { organizer: { create: { universityId: check.universityId, orgName: orgName.trim() } } };
        } else {
            const { contactNumber, schoolOrAffiliation } = profile;
            if (!contactNumber) {
                return res.status(400).json({ message: "contactNumber is required" });
            }
            if (!isNonEmptyString(contactNumber, 30)) {
                return res.status(400).json({ message: "contactNumber must be text of up to 30 characters" });
            }
            if (schoolOrAffiliation != null && !isNonEmptyString(schoolOrAffiliation, 150)) {
                return res.status(400).json({ message: "schoolOrAffiliation must be text of up to 150 characters" });
            }
            profileData = {
                guest: {
                    create: {
                        contactNumber: contactNumber.trim(),
                        schoolOrAffiliation: schoolOrAffiliation?.trim(),
                    },
                },
            };
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                fullName: fullName.trim(),
                email,
                passwordHash,
                role,
                ...profileData,
            },
            omit: { passwordHash: true },
        });

        res.status(201).json({ token: signToken(user), user });
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).json({ message: "Email or student number already registered" });
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ message: "Invalid university" });
        }
        console.log(error.message);
        res.sendStatus(500);
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: "Email and password must be text" });
    }
    try {
        const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
        const passwordMatches = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
        if (!user || !passwordMatches) {
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
