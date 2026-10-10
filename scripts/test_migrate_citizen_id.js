const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // Test updating citizen id
    const oldId = '0cecd3fc-e75f-440f-b790-0ea7ecd9c196';
    const newId = 'citizen_9876543210';

    await tx.complaint.updateMany({ where: { citizenId: oldId }, data: { citizenId: newId } });
    await tx.evidence.updateMany({ where: { uploadedByUserId: oldId }, data: { uploadedByUserId: newId } });
    await tx.statusHistory.updateMany({ where: { changedByUserId: oldId }, data: { changedByUserId: newId } });
    await tx.feedback.updateMany({ where: { citizenId: oldId }, data: { citizenId: newId } });
    await tx.notification.updateMany({ where: { recipientUserId: oldId }, data: { recipientUserId: newId } });
    await tx.auditLog.updateMany({ where: { userId: oldId }, data: { userId: newId } });
    await tx.refreshToken.updateMany({ where: { userId: oldId }, data: { userId: newId } });

    await tx.user.update({ where: { id: oldId }, data: { id: newId } });
    console.log('SUCCESSFULLY TESTED UPDATING USER ID!');
    // Throw error to rollback test
    throw new Error('ROLLBACK_TEST');
  }).catch(err => {
    if (err.message === 'ROLLBACK_TEST') {
      console.log('Rollback successful. Updating works cleanly without FK violation!');
    } else {
      console.error('Update failed:', err);
    }
  });
}

main().finally(() => prisma.$disconnect());
