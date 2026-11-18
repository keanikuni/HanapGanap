
import prisma from '../config/prismaClient.js';

async function createAuditLog({
    userId,
    userRole,
    action,
    entity,
    entityId,
    description,
    oldValues,
    newValues,
    ipAddress
}, db = prisma) {
    return await db.auditLog.create({
        data: {
            userId,
            userRole,
            action,
            entity,
            entityId,
            description,
            oldValues,
            newValues,
            ipAddress
        }
    });
}

export default createAuditLog;
