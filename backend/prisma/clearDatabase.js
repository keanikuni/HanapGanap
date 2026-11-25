// Deletes EVERYTHING in the HanapGanap database (for testing only).
//
//   npm run db:clear            asks for confirmation first
//   npm run db:clear -- --yes   skips the confirmation
//
// WARNING: every table is emptied (users, events, registrations, images,
// attendance, notifications, audit logs, ...) and ids restart from 1.
// Use it on a development database only. The tables stay; only the rows go.
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import prisma from '../src/config/prismaClient.js';

if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to clear the database in production.');
    process.exit(1);
}

// Same table list as the seed:mock script
const TABLES = [
    'audit_logs',
    'notification',
    'attendance',
    'registration',
    'image',
    'events',
    'students',
    'guests',
    'organizers',
    'admins',
    'users',
    'event_category',
    'university',
];

async function confirm() {
    if (process.argv.includes('--yes')) return true;

    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(
        'This will DELETE ALL DATA in the database. Type "yes" to continue: '
    );
    rl.close();

    return answer.trim().toLowerCase() === 'yes';
}

async function main() {
    if (!(await confirm())) {
        console.log('Cancelled. Nothing was deleted.');
        return;
    }

    await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`
    );

    console.log('Database cleared. All tables are now empty.');
}

main()
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());