// Minimal starter data for HanapGanap.
//
//   npm run seed:basic
//
// Creates 3 universities, 1 admin, 1 organizer, 1 student and the event
// categories. No events and no registrations.
//
// WARNING: this WIPES every table first, then refills them.
// Use it on a development database only. Ids restart from 1,
// so universityId 1 is always "Sample University".

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prismaClient.js';

if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to run the basic seed in production.');
    process.exit(1);
}

// ─── Settings ─────────────────────────────────────────────
const PASSWORD = 'password123';   // used by the organizer and the student

const ADMIN = {
    fullName: 'System Admin',
    email: 'admin@sample.edu.ph',
    password: 'ChangeMe123!',
};

const ORGANIZER = {
    fullName: 'Maria Santos',
    email: 'organizer1@sample.edu.ph',
    orgName: 'Computer Society',
};

const STUDENT = {
    fullName: 'Juan Dela Cruz',
    email: 'juan.delacruz@sample.edu.ph',
    studentNumber: '2023-10001',
    courseProgram: 'BSIT',
    yearLevel: '3rd',
};

// Sample University comes first so it gets id 1
const UNIVERSITIES = [
    { name: 'Sample University', emailDomain: 'sample.edu.ph', address: 'San Fernando, Pampanga' },
    { name: 'Pampanga State University', emailDomain: 'psu.edu.ph', address: 'Bacolor, Pampanga' },
    { name: 'Holy Angel University', emailDomain: 'hau.edu.ph', address: 'Angeles City, Pampanga' },
];

// Needed later when creating events (events require a category)
const CATEGORIES = ['Technical', 'Cultural', 'Sports', 'Workshop', 'Seminar', 'Competition', 'Academic'];

// ─── Main ─────────────────────────────────────────────────
async function main() {
    // 1. Wipe everything and restart ids from 1
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE audit_logs, notification, attendance, registration, image, events, ' +
        'students, guests, organizers, admins, users, event_category, university RESTART IDENTITY CASCADE'
    );
    console.log('Old data cleared.');

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const adminHash = await bcrypt.hash(ADMIN.password, 10);

    // 2. Universities and categories
    const universities = [];
    for (const u of UNIVERSITIES) {
        universities.push(await prisma.university.create({ data: u }));
    }

    await prisma.eventCategory.createMany({
        data: CATEGORIES.map((name) => ({ name })),
    });

    const sample = universities[0];

    // 3. Admin
    await prisma.user.create({
        data: {
            fullName: ADMIN.fullName,
            email: ADMIN.email,
            passwordHash: adminHash,
            role: 'admin',
            emailVerified: true,
            admin: { create: { universityId: sample.id } },
        },
    });

    // 4. Organizer
    await prisma.user.create({
        data: {
            fullName: ORGANIZER.fullName,
            email: ORGANIZER.email,
            passwordHash,
            role: 'organizer',
            emailVerified: true,
            organizer: {
                create: { universityId: sample.id, orgName: ORGANIZER.orgName },
            },
        },
    });

    // 5. Student
    await prisma.user.create({
        data: {
            fullName: STUDENT.fullName,
            email: STUDENT.email,
            passwordHash,
            role: 'student',
            emailVerified: true,
            student: {
                create: {
                    universityId: sample.id,
                    studentNumber: STUDENT.studentNumber,
                    courseProgram: STUDENT.courseProgram,
                    yearLevel: STUDENT.yearLevel,
                },
            },
        },
    });

    console.log('\nBasic data ready.');
    console.log(`  ${UNIVERSITIES.length} universities, ${CATEGORIES.length} categories`);
    console.log('  1 admin, 1 organizer, 1 student');
    console.log('  0 events, 0 registrations');
    console.log('\nLogins');
    console.log(`  admin      ${ADMIN.email} / ${ADMIN.password}`);
    console.log(`  organizer  ${ORGANIZER.email} / ${PASSWORD}`);
    console.log(`  student    ${STUDENT.email} / ${PASSWORD}`);
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());