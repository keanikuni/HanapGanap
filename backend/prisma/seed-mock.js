// Temporary demo data for HanapGanap.
//
//   npm run seed:mock
//
// WARNING: this WIPES every table first (users, events, registrations, all of it)
// and then refills them. Use it on a development database only.
// Ids restart from 1, so universityId 1 is always "Sample University".

import bcrypt from 'bcryptjs';
import prisma from '../src/config/prismaClient.js';

if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the mock seed in production.');
    process.exit(1);
}

// ─── Settings ─────────────────────────────────────────────
const MOCK_PASSWORD = 'password123';          // every mock user (except the admin) uses this
const ADMIN = { fullName: 'System Admin', email: 'admin@sample.edu.ph', password: 'ChangeMe123!' };
const STUDENT_COUNT = 30;

// ─── Small helpers ────────────────────────────────────────
// Seeded random generator, so every run produces the same data
function makeRandom(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const random = makeRandom(42);
const pick = (list) => list[Math.floor(random() * list.length)];
const shuffle = (list) => [...list].sort(() => random() - 0.5);

const now = new Date();
// A date N days from today (negative = past) at a given hour
function at(days, hour, minute = 0) {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
}
const addHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
const addMinutes = (d, m) => new Date(d.getTime() + m * 60 * 1000);

// ─── Source data ──────────────────────────────────────────
const CATEGORIES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Competition', 'Academic'];

// Sample University comes first so it gets id 1 (matches the API test files)
const UNIVERSITIES = [
    { name: 'Sample University', emailDomain: 'sample.edu.ph', address: 'San Fernando, Pampanga' },
    { name: 'Pampanga State University', emailDomain: 'psu.edu.ph', address: 'Bacolor, Pampanga' },
    { name: 'Holy Angel University', emailDomain: 'hau.edu.ph', address: 'Angeles City, Pampanga' },
];

const ORGANIZERS = [
    { fullName: 'Maria Santos', orgName: 'Computer Society', uni: 0 },
    { fullName: 'Paolo Reyes', orgName: 'Student Council', uni: 0 },
    { fullName: 'Angela Cruz', orgName: 'Cultural Arts Guild', uni: 1 },
    { fullName: 'Miguel Bautista', orgName: 'Varsity Athletics Office', uni: 1 },
    { fullName: 'Katrina Mendoza', orgName: 'Engineering Society', uni: 2 },
];

const FIRST = ['Juan', 'Maria', 'Jose', 'Ana', 'Carlo', 'Bea', 'Mark', 'Sofia', 'Gabriel', 'Isabel',
    'Miguel', 'Camille', 'Rafael', 'Trisha', 'Nathan', 'Jasmine', 'Luis', 'Patricia', 'Daniel', 'Erika'];
const LAST = ['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Ramos', 'Mendoza', 'Torres', 'Flores', 'Castillo', 'Villanueva',
    'Aquino', 'Navarro', 'Pascual', 'Domingo', 'Salazar', 'Lim', 'Tan', 'David', 'Manalo', 'Soriano'];
const COURSES = ['BSIT', 'BSCS', 'BSBA', 'BSN', 'BSED', 'BSCE', 'BSPsych'];
const YEARS = ['1st', '2nd', '3rd', '4th'];

// days: offset from today. live: true makes the event happen right now.
// uni and org are indexes into UNIVERSITIES and ORGANIZERS. fill: share of students who sign up.
const EVENTS = [
    { title: 'Intramurals Opening Ceremony', cat: 'Sports', uni: 1, org: 3, venue: 'University Gym', days: -45, hour: 8, hours: 6, limit: 150, status: 'completed', fill: 0.8 },
    { title: 'Intro to Web Development Workshop', cat: 'Workshop', uni: 0, org: 0, venue: 'Computer Lab 3', days: -20, hour: 13, hours: 4, limit: 40, status: 'completed', fill: 0.7 },
    { title: 'Cultural Night: Pasasalamat', cat: 'Cultural', uni: 1, org: 2, venue: 'Open Grounds', days: -7, hour: 18, hours: 4, limit: 200, status: 'completed', fill: 0.9 },
    { title: 'Hackathon 2026 Finals', cat: 'Competition', uni: 0, org: 0, venue: 'Innovation Hub', live: true, limit: 60, status: 'ongoing', fill: 0.6 },
    { title: 'Career Fair and Job Expo', cat: 'Academic', uni: 0, org: 1, venue: 'Main Quadrangle', days: 5, hour: 9, hours: 8, limit: 300, status: 'upcoming', fill: 0.5 },
    { title: 'Cybersecurity Awareness Seminar', cat: 'Seminar', uni: 2, org: 4, venue: 'Auditorium A', days: 9, hour: 14, hours: 3, limit: 100, status: 'upcoming', fill: 0.4 },
    { title: 'Robotics Showcase', cat: 'Technical', uni: 2, org: 4, venue: 'Engineering Building', days: 14, hour: 10, hours: 6, limit: 80, status: 'upcoming', fill: 0.3 },
    { title: 'Inter-College Basketball League', cat: 'Sports', uni: 1, org: 3, venue: 'University Gym', days: 21, hour: 15, hours: 5, limit: 250, status: 'upcoming', fill: 0.4 },
    { title: 'Photography Workshop (Almost Full)', cat: 'Workshop', uni: 0, org: 1, venue: 'Room 204', days: 12, hour: 9, hours: 4, limit: 10, status: 'upcoming', fill: 1 },
    { title: 'Mental Health Awareness Talk', cat: 'Seminar', uni: 0, org: 1, venue: 'Student Center', days: 30, hour: 13, hours: 3, limit: 120, status: 'upcoming', fill: 0.1 },
    { title: 'Battle of the Bands', cat: 'Cultural', uni: 2, org: 4, venue: 'Open Grounds', days: 40, hour: 17, hours: 5, limit: 400, status: 'upcoming', fill: 0 },
    { title: 'Foundation Day Fun Run (Cancelled)', cat: 'Sports', uni: 1, org: 3, venue: 'Campus Loop', days: 3, hour: 6, hours: 3, limit: 200, status: 'cancelled', fill: 0.3 },
];

// ─── Main ─────────────────────────────────────────────────
async function main() {
    // 1. Wipe everything and restart ids from 1
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE notification, attendance, registration, image, events, ' +
        'students, guests, organizers, admins, users, event_category, university RESTART IDENTITY CASCADE'
    );
    console.log('Old data cleared.');

    const mockHash = await bcrypt.hash(MOCK_PASSWORD, 10);   // hashed once, reused for everyone
    const adminHash = await bcrypt.hash(ADMIN.password, 10);

    // 2. Categories and universities
    await prisma.eventCategory.createMany({ data: CATEGORIES.map((name) => ({ name })) });
    const categories = await prisma.eventCategory.findMany();
    const categoryId = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const universities = [];
    for (const u of UNIVERSITIES) universities.push(await prisma.university.create({ data: u }));

    // 3. Admin
    await prisma.user.create({
        data: {
            fullName: ADMIN.fullName, email: ADMIN.email, passwordHash: adminHash,
            role: 'admin', emailVerified: true,
            admin: { create: { universityId: universities[0].id } },
        },
    });

    // 4. Organizers
    const organizers = [];
    for (const [i, o] of ORGANIZERS.entries()) {
        const uni = universities[o.uni];
        const user = await prisma.user.create({
            data: {
                fullName: o.fullName,
                email: `organizer${i + 1}@${uni.emailDomain}`,
                passwordHash: mockHash, role: 'organizer', emailVerified: true,
                organizer: { create: { universityId: uni.id, orgName: o.orgName } },
            },
            include: { organizer: true },
        });
        organizers.push(user.organizer);
    }

    // 5. Students (spread across the universities)
    const students = [];
    for (let i = 0; i < STUDENT_COUNT; i++) {
        const first = FIRST[i % FIRST.length];
        const last = LAST[(i * 7) % LAST.length];
        const uni = universities[i % universities.length];
        const user = await prisma.user.create({
            data: {
                fullName: `${first} ${last}`,
                email: `${first}.${last}${i + 1}@${uni.emailDomain}`.toLowerCase().replace(/\s+/g, ''),
                passwordHash: mockHash, role: 'student', emailVerified: random() > 0.1,
                student: {
                    create: {
                        universityId: uni.id,
                        studentNumber: `2023-${String(10001 + i)}`,
                        courseProgram: pick(COURSES),
                        yearLevel: pick(YEARS),
                    },
                },
            },
        });
        students.push(user);
    }

    // 6. A few guests
    for (const [i, name] of ['Pedro Lim', 'Rosa Manalo', 'Ken Soriano'].entries()) {
        await prisma.user.create({
            data: {
                fullName: name, email: `guest${i + 1}@gmail.com`, passwordHash: mockHash, role: 'guest',
                emailVerified: true,
                guest: { create: { contactNumber: `0917${1000000 + i * 111111}`, schoolOrAffiliation: i === 0 ? 'Visiting from Tarlac' : null } },
            },
        });
    }
    const guests = await prisma.user.findMany({ where: { role: 'guest' } });
    const attendees = [...students, ...guests];

    // 7. Events, images, registrations, attendance
    let regTotal = 0, attendedTotal = 0;
    for (const [i, e] of EVENTS.entries()) {
        let start, end;
        if (e.live) {
            start = addHours(now, -2);
            end = addHours(now, 4);
        } else {
            start = at(e.days, e.hour);
            end = addHours(start, e.hours);
        }
        const deadline = addHours(start, -24);      // registration closes a day before the start

        const event = await prisma.event.create({
            data: {
                universityId: universities[e.uni].id,
                categoryId: categoryId[e.cat],
                organizerId: organizers[e.org].id,
                title: e.title,
                description: `${e.title}. Join students from across the region for a day of learning, fun and networking. ` +
                    `Bring your school ID and arrive 30 minutes early for check-in.`,
                venue: e.venue,
                startDatetime: start,
                endDatetime: end,
                participantLimit: e.limit,
                registrationDeadline: deadline,
                status: e.status,
                createdAt: addHours(start, -24 * 14),
                // Placeholder photos from the web, so the frontend has previews to show
                images: {
                    create: [1, 2].map((n) => ({
                        fileName: `mock-event-${i + 1}-${n}.jpg`,
                        filePath: `https://picsum.photos/seed/hanapganap-${i + 1}-${n}/800/450`,
                    })),
                },
            },
        });

        // Registrations (never more than the limit)
        const count = Math.min(e.limit, Math.round(attendees.length * e.fill));
        const chosen = shuffle(attendees).slice(0, count);
        const happened = e.status === 'completed' || e.status === 'ongoing';

        for (const user of chosen) {
            const registration = await prisma.registration.create({
                data: {
                    userId: user.id, eventId: event.id, isConfirmed: true,
                    registeredAt: addHours(deadline, -Math.floor(random() * 24 * 10) - 1),
                },
            });
            regTotal++;

            // About 80% of people at past or live events actually showed up
            if (happened && random() < 0.8) {
                await prisma.attendance.create({
                    data: {
                        registrationId: registration.id,
                        inTime: addMinutes(start, Math.floor(random() * 30)),
                        outTime: e.status === 'completed' ? addMinutes(end, -Math.floor(random() * 30)) : null,
                    },
                });
                attendedTotal++;
            }
        }

        // 8. Notifications for some events
        if (e.status === 'cancelled') {
            await prisma.notification.createMany({
                data: chosen.map((u) => ({
                    eventId: event.id, userId: u.id, type: 'cancellation', sentAt: now,
                    title: 'Event cancelled',
                    message: `${e.title} has been cancelled. We are sorry for the inconvenience.`,
                })),
            });
        } else if (e.status === 'upcoming' && e.days <= 14 && chosen.length > 0) {
            await prisma.notification.createMany({
                data: chosen.map((u) => ({
                    eventId: event.id, userId: u.id, type: 'reminder',
                    title: 'Upcoming event reminder',
                    message: `${e.title} is coming up at ${e.venue}. See you there!`,
                })),
            });
        }
    }

    console.log('\nMock data ready.');
    console.log(`  ${UNIVERSITIES.length} universities, ${CATEGORIES.length} categories`);
    console.log(`  ${1 + ORGANIZERS.length + STUDENT_COUNT + guests.length} users, ${EVENTS.length} events`);
    console.log(`  ${regTotal} registrations, ${attendedTotal} attendance records`);
    console.log('\nLogins');
    console.log(`  admin      ${ADMIN.email} / ${ADMIN.password}`);
    console.log(`  organizer  organizer1@sample.edu.ph / ${MOCK_PASSWORD}`);
    console.log(`  student    ${students[0].email} / ${MOCK_PASSWORD}`);
    console.log(`  guest      guest1@gmail.com / ${MOCK_PASSWORD}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());