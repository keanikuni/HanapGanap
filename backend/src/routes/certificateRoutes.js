import express from 'express';
import PDFDocument from 'pdfkit';
import prisma from '../config/prismaClient.js';
import { requireAuth } from '../middleware/authMiddleware.js';
import { idParam } from '../utils/validate.js';

const router = express.Router();

router.param('id', idParam('eventId', "Invalid event id"));

const formatDate = (d) =>
    d.toLocaleDateString('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' });

// Draws one landscape A4 certificate and streams it straight into `out` (the response).
// Nothing is saved on the server.
function drawCertificate(out, { fullName, eventTitle, universityName, orgName, eventDate }) {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 50 });
    doc.pipe(out);

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
}

// ─── Download my certificate for an event ─────────────────
// The student is taken from the token, so nobody can request someone else's.
router.get('/events/:id/certificate', requireAuth, async (req, res) => {
    try {
        const registration = await prisma.registration.findUnique({
            where: { userId_eventId: { userId: req.user.id, eventId: req.eventId } },
            include: {
                attendance: true,
                user: { select: { fullName: true } },
                event: {
                    include: {
                        university: { select: { name: true } },
                        organizer: { select: { orgName: true } },
                    },
                },
            },
        });

        if (!registration) {
            return res.status(404).json({ message: "You're not registered for this event" });
        }

        const { event } = registration;

        if (event.status === 'cancelled') {
            return res.status(409).json({ message: "This event was cancelled" });
        }
        if (event.status !== 'completed' && new Date() < event.endDatetime) {
            return res.status(409).json({ message: "Certificates are available after the event ends" });
        }
        if (!registration.attendance?.inTime) {
            return res.status(403).json({ message: "No attendance was recorded for you at this event" });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="certificate-event-${event.id}.pdf"`);

        drawCertificate(res, {
            fullName: registration.user.fullName,
            eventTitle: event.title,
            universityName: event.university.name,
            orgName: event.organizer.orgName,
            eventDate: formatDate(event.startDatetime),
        });
    } catch (err) {
        console.log(err.message);
        if (!res.headersSent) res.sendStatus(500);
    }
});

export default router;