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
// Web path images are served from. Per the API docs, filePath is "/uploads/<file name>", which means the server
// serves the Backend/uploads/images folder at /uploads. The file names in EVENTS below are added to the end of this.
const IMAGE_BASE = '/uploads';

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
// image: file name inside IMAGE_BASE. description: paragraphs joined with a blank line.
const EVENTS = [
    {
        title: 'Intramurals Opening Ceremony', image: 'intrams.jpg', cat: 'Sports', uni: 1, org: 3, venue: 'University Gym',
        days: -45, hour: 8, hours: 6, limit: 150, status: 'completed', fill: 0.8,
        description: [
            'The Intramurals Opening Ceremony kicked off the university’s annual sports festival with a full morning at the University Gym. Each college marched in with its banner, mascot and cheering squad, followed by the oath of sportsmanship and the lighting of the ceremonial torch.',
            'The program also featured opening dance numbers from the university’s performing groups, a welcome message from the athletics director, and exhibition games between the varsity teams to set the tone for the weeks ahead.',
            'Students from every department were invited, whether they were competing, cheering or just looking for a great start to the season. A school ID was required for check-in, and colleges were asked to arrive 30 minutes early to line up for the parade.',
        ].join('\n\n'),
    },
    {
        title: 'Intro to Web Development Workshop', image: 'hackathon.jpg', cat: 'Workshop', uni: 0, org: 0, venue: 'Computer Lab 3',
        days: -20, hour: 13, hours: 4, limit: 40, status: 'completed', fill: 0.7,
        description: [
            'A hands-on, beginner-friendly workshop that walked participants through building their first web page from scratch. No coding experience was needed, only curiosity and a laptop, and a limited number of lab computers were available too.',
            'Mentors from the Computer Society covered the basics of HTML structure, CSS styling and a little JavaScript for interactivity. By the end, every participant had a simple personal page running in the browser, along with a short list of free resources for continuing to learn.',
            'Seats were limited to 40 so that mentors could help everyone one on one. Participants were asked to install a code editor such as VS Code beforehand, bring their school ID, and arrive 30 minutes early for setup.',
        ].join('\n\n'),
    },
    {
        title: 'Cultural Night: Pasasalamat', image: 'cultural_night.jpg', cat: 'Cultural', uni: 1, org: 2, venue: 'Open Grounds',
        days: -7, hour: 18, hours: 4, limit: 200, status: 'completed', fill: 0.9,
        description: [
            'Pasasalamat is the Cultural Arts Guild’s annual night of thanks, a celebration of Kapampangan and Filipino traditions held under the lights at the Open Grounds. The evening brought together student performers and guests for a showcase of heritage and creativity.',
            'The lineup included folk dances from different regions, traditional songs, spoken-word pieces and a short play, along with food stalls serving local favorites and an exhibit of student artwork and handwoven crafts.',
            'Everyone was welcome, including families and visitors from other schools. Guests were encouraged to wear a Filipiniana or a barong, bring a school ID for check-in, and come early to find a good spot on the grounds.',
        ].join('\n\n'),
    },
    {
        title: 'Inter-Department Volleyball Cup', image: 'volleyball.jpg', cat: 'Sports', uni: 1, org: 3, venue: 'Covered Courts',
        days: -12, hour: 14, hours: 5, limit: 120, status: 'completed', fill: 0.6,
        description: [
            'The Inter-Department Volleyball Cup wrapped up an afternoon of tight rallies and loud cheering at the Covered Courts. Teams from different departments competed in a knockout format, with every match played as a best of three sets.',
            'The day began with the quarterfinals and ended with a championship match that went to a deciding set. Medals were handed out to the champions and runners-up, and Best Setter and Best Spiker awards went to standout players.',
            'Players and supporters from every department were invited. Participants checked in with their school IDs, and teams were asked to arrive 30 minutes before their first game for warm-ups.',
        ].join('\n\n'),
    },
    {
        title: 'Hackathon 2026 Finals', image: 'hackathon.jpg', cat: 'Competition', uni: 0, org: 0, venue: 'Innovation Hub',
        live: true, limit: 60, status: 'ongoing', fill: 0.6,
        description: [
            'The final round of Hackathon 2026 is happening right now at the Innovation Hub. After weeks of qualifiers, the top teams are spending a full day building and polishing their projects before presenting them to a panel of judges from the university and local tech companies.',
            'Teams are working on challenges built around campus life and community problems, and will be scored on creativity, technical quality, usefulness and the clarity of their final demo. Mentors are on hand for questions, and snacks and drinks are provided throughout the day.',
            'Spectators and supporters are welcome to watch the demos and vote for the audience choice award. Please bring your school ID for check-in and keep noise down around the working areas.',
        ].join('\n\n'),
    },
    {
        title: 'Career Fair and Job Expo', image: 'career_job.jpg', cat: 'Academic', uni: 0, org: 1, venue: 'Main Quadrangle',
        days: 5, hour: 9, hours: 8, limit: 300, status: 'upcoming', fill: 0.5,
        description: [
            'The Career Fair and Job Expo brings employers, recruiters and graduate programs to the Main Quadrangle for a full day of conversations about what comes after graduation. Dozens of booths from local businesses, BPO companies, government agencies and start-ups will be accepting applications on the spot.',
            'Besides booth visits, the day includes resume clinics, mock interviews, short talks on workplace skills and a panel with recent alumni who will share how they landed their first jobs. Walk-in interviews will be held for selected companies throughout the afternoon.',
            'The event is open to graduating students and to undergraduates looking for internships or part-time work. Bring several printed copies of your resume, dress in business casual, and bring your school ID for check-in. Arriving 30 minutes early helps you beat the morning queue.',
        ].join('\n\n'),
    },
    {
        title: 'Cybersecurity Awareness Seminar', image: 'cyber_awareness.jpg', cat: 'Seminar', uni: 2, org: 4, venue: 'Auditorium A',
        days: 9, hour: 14, hours: 3, limit: 100, status: 'upcoming', fill: 0.4,
        description: [
            'Phishing, fake giveaways, stolen accounts and weak passwords affect students every day. This seminar offers practical, no-jargon advice for staying safe online, whether you are studying, gaming or shopping.',
            'Invited speakers from the IT security field will explain how common scams work, show real examples of phishing messages, and walk through simple habits like using a password manager, turning on two-factor authentication and checking links before clicking. A short Q&A will follow so you can ask about your own situations.',
            'The seminar is open to all students, and no technical background is needed. Please bring your school ID and arrive 30 minutes early for check-in.',
        ].join('\n\n'),
    },
    {
        title: 'Robotics Showcase', image: 'robotics.jpg', cat: 'Technical', uni: 2, org: 4, venue: 'Engineering Building',
        days: 14, hour: 10, hours: 6, limit: 80, status: 'upcoming', fill: 0.3,
        description: [
            'The Robotics Showcase is a day of demonstrations in the Engineering Building, where student teams present the robots they designed, built and programmed over the semester. Expect line followers, robotic arms, obstacle-avoiding rovers and a few surprises from the senior capstone groups.',
            'Each team will run a live demo and explain how the mechanics, sensors and code come together. Visitors can try controlling selected robots, ask questions at every station and vote for their favorite project at the end of the day.',
            'The showcase is open to students from all programs, including those who have never touched a robot before. Bring your school ID for check-in, and arrive 30 minutes early if you want a spot at the interactive demos, which fill up quickly.',
        ].join('\n\n'),
    },
    {
        title: 'Pickleball Open Tournament', image: 'pickleball.jpg', cat: 'Sports', uni: 0, org: 1, venue: 'Covered Courts',
        days: 17, hour: 8, hours: 7, limit: 48, status: 'upcoming', fill: 0.3,
        description: [
            'Pickleball is one of the fastest-growing sports around, and this open tournament is the perfect excuse to try it. Players of all levels will compete in doubles at the Covered Courts, with separate brackets for beginners and for experienced players.',
            'Matches are short, friendly and fast. Pairs are placed in a bracket on arrival, and each pair plays at least three games so everyone gets to enjoy the day. A few spare paddles and balls will be available for beginners, and referees will explain the basic rules before the first game.',
            'Registration is open to all students, and you can sign up alone or with a partner. Wear rubber-soled court shoes, bring a water bottle and your school ID, and arrive 30 minutes early for check-in and warm-ups.',
        ].join('\n\n'),
    },
    {
        title: 'Inter-College Basketball League', image: 'basketball.jpg', cat: 'Sports', uni: 1, org: 3, venue: 'University Gym',
        days: 21, hour: 15, hours: 5, limit: 250, status: 'upcoming', fill: 0.4,
        description: [
            'The Inter-College Basketball League opens its season at the University Gym with the colleges’ best teams going head to head. Expect fast games, loud crowds and the rivalry that makes intramural season one of the highlights of the school year.',
            'The first match day features several back-to-back games, with the schedule posted at the gym entrance on the day itself. There will be a short halftime show, a three-point shootout, and food and drink stalls just outside the gym.',
            'Students are welcome to come and cheer for their college, and wearing your college colors is encouraged. Bring your school ID for check-in, arrive 30 minutes early to get good seats, and please keep the aisles clear for players and staff.',
        ].join('\n\n'),
    },
    {
        title: 'Taekwondo Belt Promotion and Friendly Match', image: 'taekwando.jpg', cat: 'Sports', uni: 1, org: 3, venue: 'Martial Arts Hall',
        days: 26, hour: 9, hours: 6, limit: 60, status: 'upcoming', fill: 0.2,
        description: [
            'The Taekwondo Belt Promotion and Friendly Match brings together the university’s taekwondo club and guest dojangs for a day of testing, sparring and demonstrations. Members will test for their next belt in front of certified masters, followed by friendly matches open to all.',
            'The morning is for belt testing in poomsae (forms), basic kicks and board breaking. The afternoon features friendly sparring rounds in weight categories, plus a demonstration team showing off synchronized kicks and breaking.',
            'Spectators are welcome to cheer on friends, and newcomers can join a short try-it-out session at the end of the day. Participants should wear a clean dobok (uniform) and bring a water bottle and their school ID. Arrive 30 minutes early for check-in and warm-up.',
        ].join('\n\n'),
    },
    {
        title: 'Photography Workshop (Almost Full)', image: 'phtog_workshop.jpg', cat: 'Workshop', uni: 0, org: 1, venue: 'Room 204',
        days: 12, hour: 9, hours: 4, limit: 10, status: 'upcoming', fill: 1,
        description: [
            'A small-group workshop for beginners who want to move beyond auto mode and take better photos with whatever camera they have, from a phone to a DSLR. With only 10 slots, everyone gets plenty of personal feedback.',
            'The morning covers composition, natural light, camera settings like exposure, aperture and ISO, and simple editing on a phone or laptop. Participants will join a short photo walk around the campus and review their shots together with the instructor.',
            'Slots are almost full, so register early. Bring a camera or phone, a charged battery and your school ID. Please arrive 30 minutes early for check-in so we can start on time.',
        ].join('\n\n'),
    },
    {
        title: 'Mental Health Awareness Talk', image: 'mentalhealth_awareness.jpg', cat: 'Seminar', uni: 0, org: 1, venue: 'Student Center',
        days: 30, hour: 13, hours: 3, limit: 120, status: 'upcoming', fill: 0.1,
        description: [
            'Student life can be stressful, and it is okay to not be okay. This talk creates a calm and welcoming space to learn about mental health, understand common signs of stress, anxiety and burnout, and find out where to get support on and off campus.',
            'A guidance counselor and a peer support volunteer will share practical tools for managing stress, building healthy routines and helping a friend who is struggling. The session also includes a short guided breathing exercise and an open Q&A where you can submit questions anonymously.',
            'Everyone is welcome, and you are free to just listen. Information about the university counseling office will be available at the venue. Please bring your school ID and arrive 30 minutes early for check-in.',
        ].join('\n\n'),
    },
    {
        title: 'Battle of the Bands', image: 'battle_ofthe_bands.jpg', cat: 'Cultural', uni: 2, org: 4, venue: 'Open Grounds',
        days: 40, hour: 17, hours: 5, limit: 400, status: 'upcoming', fill: 0,
        description: [
            'The Battle of the Bands brings the loudest night of the semester to the Open Grounds. Student bands from different schools compete on one stage, playing original songs and covers in front of a live crowd and a panel of judges.',
            'Each band gets a short set to win over the audience, and the judges will score stage presence, musicianship, originality and crowd energy. In between sets there will be a DJ, food and drink stalls and a light show, with the winners announced at the end of the night.',
            'Everyone is welcome, whether you came to support a friend’s band or just love live music. Bring your school ID for check-in, arrive 30 minutes early to get a good spot near the stage, and consider bringing earplugs if you are sensitive to loud sound.',
        ].join('\n\n'),
    },
    {
        title: 'Foundation Day Fun Run (Cancelled)', image: 'fun_run.jpg', cat: 'Sports', uni: 1, org: 3, venue: 'Campus Loop',
        days: 3, hour: 6, hours: 3, limit: 200, status: 'cancelled', fill: 0.3,
        description: [
            'The Foundation Day Fun Run was planned as a morning of walking, jogging and running around the Campus Loop to celebrate the university’s founding, with 3-kilometer and 5-kilometer routes open to all fitness levels.',
            'This event has been cancelled. Everyone who registered has been notified, and no further action is needed on your part.',
            'We are sorry for the inconvenience. The Varsity Athletics Office plans to share a new date for the run once the schedule is confirmed, so please watch for announcements. Thank you for your understanding and enthusiasm.',
        ].join('\n\n'),
    },
];

// ─── Main ─────────────────────────────────────────────────
async function main() {
    // 1. Wipe everything and restart ids from 1
    await prisma.$executeRawUnsafe(
        'TRUNCATE TABLE audit_logs, notification, attendance, registration, image, events, ' +
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
                description: e.description,
                venue: e.venue,
                startDatetime: start,
                endDatetime: end,
                participantLimit: e.limit,
                registrationDeadline: deadline,
                status: e.status,
                createdAt: addHours(start, -24 * 14),
                // One local picture per event (file lives in IMAGE_BASE)
                images: {
                    create: [{ fileName: e.image, filePath: `${IMAGE_BASE}/${e.image}` }],
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
                        isConfirm: true,
                        inTime: addMinutes(start, Math.floor(random() * 30)),
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