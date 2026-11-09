import express from 'express';
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import prisma from '../config/prismaClient.js';
import { requireAuth, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();

// PDFs are saved here; the database only stores the relative path
const CERT_DIR = 'uploads/certificates';
fs.mkdirSync(CERT_DIR, { recursive: true });

router.param('eventId', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid event id" });
    req.eventId = +id;
    next();
});

router.param('certId', (req, res, next, id) => {
    if (!Number.isInteger(+id)) return res.status(400).json({ message: "Invalid certificate id" });
    req.certId = +id;
    next();
});

const formatDate = (d) =>
    d.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' });

// Draws one landscape A4 certificate and writes it to filePath
function generateCertificatePdf({ fullName, eventTitle, universityName, orgName, eventDate, filePath }) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        const { width, height } = doc.page;

        // Border
        doc.rect(30, 30, width - 60, height - 60).lineWidth(3).stroke('#1f3a5f');

        doc.font('Helvetica-Bold').fontSize(36).fillColor('#1f3a5f')
            .text('CERTIFICATE OF PARTICIPATION', 50, 110, { align: 'center' });

        doc.font('Helvetica').fontSize(16).fillColor('#444')
            .text('This certificate is proudly presented to', 50, 180, { align: 'center' });

        doc.font('Helvetica-Bold').fontSize(32).fillColor('#000')
            .text(fullName, 50, 220, { align: 'center' });

        doc.font('Helvetica').fontSize(16).fillColor('#444')
            .text('for participating in', 50, 280, { align: 'center' });

        doc.font('Helvetica-Bold').fontSize(24).fillColor('#1f3a5f')
            .text(eventTitle, 50, 310, { align: 'center' });

        doc.font('Helvetica').fontSize(14).fillColor('#444')
            .text(`Held on ${eventDate} at ${universityName}`, 50, 360, { align: 'center' })
            .text(`Organized by ${orgName}`, 50, 385, { align: 'center' });

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

// ─── Generate certificates for an event (owner) ───────────
router.post('/events/:eventId/certificates', requireAuth, requireRole('organizer'), async (req, res) => {
    try {
        const event = await prisma.event.findUnique({
            where: { id: req.eventId },
            include: {
                university: { select: { name: true } },
                organizer: { select: { userId: true, orgName: true } },
            },
        });
        if (!event) return res.status(404).json({ message: "Event not found" });
        if (event.organizer.userId !== req.user.id) {
            return res.status(403).json({ message: "You don't own this event" });
        }
        if (event.status === 'cancelled') {
            return res.status(409).json({ message: "Event was cancelled" });
        }
        if (event.status !== 'completed' && new Date() < event.endDatetime) {
            return res.status(409).json({ message: "Certificates can only be issued after the event ends" });
        }

        // Attended (checked in) and no certificate yet
        const registrations = await prisma.registration.findMany({
            where: {
                eventId: event.id,
                attendance: { is: { inTime: { not: null } } },
                certificate: { is: null },
            },
            include: { user: { select: { fullName: true } } },
        });

        const alreadyIssued = await prisma.certificate.count({
            where: { registration: { eventId: event.id } },
        });

        let issued = 0;
        for (const reg of registrations) {
            const filePath = path.join(CERT_DIR, `event-${event.id}-reg-${reg.id}.pdf`);

            await generateCertificatePdf({
                fullName: reg.user.fullName,
                eventTitle: event.title,
                universityName: event.university.name,
                orgName: event.organizer.orgName,
                eventDate: formatDate(event.startDatetime),
                filePath,
            });

            await prisma.certificate.create({
                data: { registrationId: reg.id, certificatePdf: filePath },
            });
            issued++;
        }

        res.status(201).json({ issued, alreadyIssued });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── My certificates ──────────────────────────────────────
router.get('/certificates/mine', requireAuth, async (req, res) => {
    try {
        const certificates = await prisma.certificate.findMany({
            where: { registration: { userId: req.user.id } },
            select: {
                id: true,
                issuedAt: true,
                registration: {
                    select: { event: { select: { id: true, title: true, startDatetime: true } } },
                },
            },
            orderBy: { issuedAt: 'desc' },
        });
        res.json(certificates);
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

// ─── Download a certificate PDF ───────────────────────────
router.get('/certificates/:certId/download', requireAuth, async (req, res) => {
    try {
        const cert = await prisma.certificate.findUnique({
            where: { id: req.certId },
            include: {
                registration: {
                    include: { event: { include: { organizer: { select: { userId: true } } } } },
                },
            },
        });
        if (!cert) return res.status(404).json({ message: "Certificate not found" });

        const { registration } = cert;
        const allowed =
            registration.userId === req.user.id ||                       // the attendee
            registration.event.organizer.userId === req.user.id ||       // the event's organizer
            req.user.role === 'admin';
        if (!allowed) return res.status(403).json({ message: "Forbidden" });

        res.download(path.resolve(cert.certificatePdf), `certificate-${registration.event.id}.pdf`, (err) => {
            if (err && !res.headersSent) {
                res.status(404).json({ message: "Certificate file is missing" });
            }
        });
    } catch (err) {
        console.log(err.message);
        res.sendStatus(500);
    }
});

export default router;