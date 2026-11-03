import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prismaClient.js';

const router = express.Router();

router.post('/register', async (req, res) => {
    console.log('A Client Tried To Register!');
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({ message: "Username and password are required" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username: username,
                password: hashedPassword
            }
        });

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token });

    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(409).send({ message: "Username already taken" });
        }
        console.log(error.message);
        res.sendStatus(500);
    }
});

router.post('/login', async (req, res) => {
    console.log('A Client Tried To Login!');
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).send({ message: "Username and password are required" });
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } });

        const passwordIsValid = user && await bcrypt.compare(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).send({ message: "Invalid username or password" });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });

    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;