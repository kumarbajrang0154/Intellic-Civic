require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const KEEPER_EMAIL = 'kumarbajrang325@gmail.com';
const EXTRA_ID = '3fbf986e-c064-405b-b82a-de656e6dfe23'; // Secondary Super Admin Target

async function main() {
  console.log('=== CHECKING DEPENDENTS FOR EXTRA SUPER_ADMIN ===');
  
  const [
    complaints,
    assignmentsHandled,
    assignmentsCreated,
    statusChanges,
    evidence,
    auditLogs,
    notifications,
    feedbacks,
    refreshTokens,
  ] = await Promise.all([
    prisma.complaint.count({ where: { citizenId: EXTRA_ID } }),
    prisma.assignment.count({ where: { departmentOfficerId: EXTRA_ID } }),
    prisma.assignment.count({ where: { assignedByUserId: EXTRA_ID } }),
    prisma.statusHistory.count({ where: { changedByUserId: EXTRA_ID } }),
    prisma.evidence.count({ where: { uploadedByUserId: EXTRA_ID } }),
    prisma.auditLog.count({ where: { userId: EXTRA_ID } }),
    prisma.notification.count({ where: { recipientUserId: EXTRA_ID } }),
    prisma.feedback.count({ where: { citizenId: EXTRA_ID } }),
    prisma.refreshToken.count({ where: { userId: EXTRA_ID } }),
  ]);

  console.log(`  complaints:          ${complaints}`);
  console.log(`  assignmentsHandled:  ${assignmentsHandled}`);
  console.log(`  assignmentsCreated:  ${assignmentsCreated}`);
  console.log(`  statusChanges:       ${statusChanges}`);
  console.log(`  evidence:            ${evidence}`);
  console.log(`  auditLogs:           ${auditLogs}`);
  console.log(`  notifications:       ${notifications}`);
  console.log(`  feedbacks:           ${feedbacks}`);
  console.log(`  refreshTokens:       ${refreshTokens}`);

  const hasAnyDependent = complaints > 0 || assignmentsHandled > 0 || assignmentsCreated > 0 ||
    statusChanges > 0 || evidence > 0 || feedbacks > 0;
  // Note: auditLogs uses SetNull onDelete, notifications use Cascade, refreshTokens use Cascade
  // So those can be safely handled

  if (hasAnyDependent) {
    console.log('\n  => HAS REAL DEPENDENTS (complaints/assignments/evidence) => WILL DEMOTE TO ADMIN');
  } else {
    console.log('\n  => NO HARD DEPENDENTS => SAFE TO HARD-DELETE');
    
    // Hard delete with cleanup
    console.log('\n=== PERFORMING HARD DELETE ===');
    
    // Clear nullable FK refs first
    if (auditLogs > 0) {
      await prisma.auditLog.updateMany({ where: { userId: EXTRA_ID }, data: { userId: null } });
      console.log(`  Updated ${auditLogs} auditLog rows (userId -> null)`);
    }
    if (notifications > 0) {
      await prisma.notification.deleteMany({ where: { recipientUserId: EXTRA_ID } });
      console.log(`  Deleted ${notifications} notification rows (CASCADE)`);
    }
    if (refreshTokens > 0) {
      await prisma.refreshToken.deleteMany({ where: { userId: EXTRA_ID } });
      console.log(`  Deleted ${refreshTokens} refreshToken rows (CASCADE)`);
    }
    
    await prisma.user.delete({ where: { id: EXTRA_ID } });
    console.log('  => Hard-deleted: Secondary Super Admin Target (target.superadmin@civic.gov.in)');
  }

  // Verify final state
  console.log('\n=== POST-CLEANUP VERIFICATION ===');
  const remaining = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log(JSON.stringify(remaining, null, 2));
  console.log(`SUPER_ADMIN count: ${remaining.length}`);
  
  if (remaining.length === 1 && remaining[0].email.toLowerCase() === KEEPER_EMAIL) {
    console.log('\n✅ SUCCESS: Exactly ONE SUPER_ADMIN remains (kumarbajrang325@gmail.com)');
  } else {
    console.error('\n❌ ERROR: Unexpected final state!');
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
