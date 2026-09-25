/**
 * ONE-TIME CLEANUP SCRIPT: Demote / remove extra SUPER_ADMIN accounts.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json scripts/cleanup-super-admin.ts
 *
 * This script:
 *  1. Lists all SUPER_ADMIN users.
 *  2. Checks for foreign-key dependents (complaints, assignments, statusHistory, evidence, auditLogs) for each non-target account.
 *  3. If no dependents → hard-delete (safe for pure test/seed data).
 *  4. If dependents exist → demote to ADMIN (to preserve FK integrity).
 *  5. Re-queries to confirm exactly ONE SUPER_ADMIN remains (kumarbajrang325@gmail.com).
 */

import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const KEEPER_EMAIL = 'kumarbajrang325@gmail.com';

async function main() {
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  SUPER_ADMIN CLEANUP — ONE-TIME SCRIPT');
  console.log('══════════════════════════════════════════════════════\n');

  // ── Step 1: List all SUPER_ADMIN users ─────────────────────────────────────
  const superAdmins = await prisma.user.findMany({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true, name: true, email: true, createdAt: true, role: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${superAdmins.length} SUPER_ADMIN account(s):\n`);
  for (const u of superAdmins) {
    const isKeeper = (u.email || '').toLowerCase().trim() === KEEPER_EMAIL;
    console.log(
      `  ${isKeeper ? '✅ KEEP' : '🔴 EXTRA'} | id=${u.id} | name="${u.name}" | email=${u.email} | createdAt=${u.createdAt.toISOString()}`,
    );
  }
  console.log('');

  // ── Step 2: Identify extras ────────────────────────────────────────────────
  const extras = superAdmins.filter(
    (u) => (u.email || '').toLowerCase().trim() !== KEEPER_EMAIL,
  );

  if (extras.length === 0) {
    console.log('✅ No extra SUPER_ADMIN accounts found. Nothing to do.\n');
    return;
  }

  console.log(`Processing ${extras.length} extra SUPER_ADMIN account(s)...\n`);

  // ── Step 3: Check foreign-key dependents for each extra ────────────────────
  for (const u of extras) {
    console.log(`\n── Checking dependents for: ${u.email} (${u.id}) ──`);

    const [complaints, assignmentsHandled, assignmentsCreated, statusChanges, evidence, auditLogs] =
      await Promise.all([
        prisma.complaint.count({ where: { citizenId: u.id } }),
        prisma.assignment.count({ where: { departmentOfficerId: u.id } }),
        prisma.assignment.count({ where: { assignedByUserId: u.id } }),
        prisma.statusHistory.count({ where: { changedByUserId: u.id } }),
        prisma.evidence.count({ where: { uploadedByUserId: u.id } }),
        prisma.auditLog.count({ where: { userId: u.id } }),
      ]);

    const hasAnyDependent =
      complaints > 0 ||
      assignmentsHandled > 0 ||
      assignmentsCreated > 0 ||
      statusChanges > 0 ||
      evidence > 0 ||
      auditLogs > 0;

    console.log(`  complaints:          ${complaints}`);
    console.log(`  assignmentsHandled:  ${assignmentsHandled}`);
    console.log(`  assignmentsCreated:  ${assignmentsCreated}`);
    console.log(`  statusChanges:       ${statusChanges}`);
    console.log(`  evidence:            ${evidence}`);
    console.log(`  auditLogs:           ${auditLogs}`);

    if (hasAnyDependent) {
      // ── Demote to ADMIN (preserves FK integrity) ──────────────────────────
      console.log(`\n  ⚠️  HAS DEPENDENTS → demoting to ADMIN (preserves foreign-key integrity).`);
      await prisma.user.update({
        where: { id: u.id },
        data: { role: UserRole.ADMIN },
      });
      console.log(`  ✅  Demoted ${u.email} → ADMIN.`);
    } else {
      // ── Hard-delete (pure test/seed data, no dependents) ─────────────────
      console.log(`\n  ℹ️  NO DEPENDENTS → hard-deleting (pure test/seed account, safe to remove).`);
      // First remove refresh tokens (cascade not guaranteed in all providers for direct script usage)
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
      await prisma.notification.deleteMany({ where: { recipientUserId: u.id } });
      await prisma.auditLog.updateMany({ where: { userId: u.id }, data: { userId: null } });
      await prisma.user.delete({ where: { id: u.id } });
      console.log(`  ✅  Hard-deleted ${u.email} from the database.`);
    }
  }

  // ── Step 4: Verify final state ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════');
  console.log('  POST-CLEANUP VERIFICATION');
  console.log('══════════════════════════════════════════════════════\n');

  const remaining = await prisma.user.findMany({
    where: { role: UserRole.SUPER_ADMIN },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`SUPER_ADMIN count after cleanup: ${remaining.length}\n`);
  for (const u of remaining) {
    console.log(
      `  id=${u.id} | name="${u.name}" | email=${u.email} | createdAt=${u.createdAt.toISOString()}`,
    );
  }

  if (remaining.length === 1 && remaining[0].email?.toLowerCase().trim() === KEEPER_EMAIL) {
    console.log('\n✅ SUCCESS: Exactly ONE SUPER_ADMIN remains, and it is kumarbajrang325@gmail.com.\n');
  } else if (remaining.length === 0) {
    console.error('\n❌ ERROR: No SUPER_ADMIN accounts remain! Please restore the keeper account manually.\n');
  } else {
    console.error(
      `\n❌ ERROR: Unexpected state — ${remaining.length} SUPER_ADMIN accounts remain. Review manually.\n`,
    );
  }
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
