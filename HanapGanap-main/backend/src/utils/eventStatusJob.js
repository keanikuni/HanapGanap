import prisma from '../config/prismaClient.js';

// Moves events through their life automatically, based on the clock:
//   upcoming -> ongoing    when startDatetime passes
//   upcoming/ongoing -> completed   when endDatetime passes
// Organizers can still end an event early with POST /api/events/:id/end.
// Cancelled events are never touched. Running it twice is harmless.
export async function updateEventStatuses() {
    const now = new Date();

    // Ended first, so an event that was missed entirely goes straight to completed
    const ended = await prisma.event.updateMany({
        where: { status: { in: ['upcoming', 'ongoing'] }, endDatetime: { lte: now } },
        data: { status: 'completed' },
    });

    const started = await prisma.event.updateMany({
        where: { status: 'upcoming', startDatetime: { lte: now }, endDatetime: { gt: now } },
        data: { status: 'ongoing' },
    });

    return { started: started.count, ended: ended.count };
}

// Runs once at startup, then every minute. Set EVENT_STATUS_JOB=false in .env to turn it off.
export function startEventStatusJob(intervalMs = 60 * 1000) {
    if (process.env.EVENT_STATUS_JOB === 'false') {
        console.log('[events] automatic status updates are off');
        return;
    }

    const run = async () => {
        try {
            const { started, ended } = await updateEventStatuses();
            if (started || ended) console.log(`[events] ${started} started, ${ended} ended`);
        } catch (err) {
            console.error("[events] status update failed:", err);
        }
    };

    run();
    setInterval(run, intervalMs).unref(); // unref: this timer never keeps the process alive
}