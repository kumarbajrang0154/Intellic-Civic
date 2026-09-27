const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- BACKFILL: FIELD WORKER OFFICER ASSIGNMENT ---');

  const unassignedWorkers = await prisma.user.findMany({
    where: {
      role: 'FIELD_WORKER',
      assignedOfficerId: null,
    },
  });

  console.log(`Found ${unassignedWorkers.length} unassigned field workers without assignedOfficerId.`);

  if (unassignedWorkers.length === 0) {
    console.log('✅ All field workers already linked to an officer!');
    return;
  }

  for (const worker of unassignedWorkers) {
    // Find an officer in the same department
    let officer = null;
    if (worker.departmentId) {
      officer = await prisma.user.findFirst({
        where: {
          role: 'DEPARTMENT_OFFICER',
          departmentId: worker.departmentId,
        },
      });
    }

    if (!officer) {
      // Fallback to any department officer
      officer = await prisma.user.findFirst({
        where: {
          role: 'DEPARTMENT_OFFICER',
        },
      });
    }

    if (officer) {
      await prisma.user.update({
        where: { id: worker.id },
        data: { assignedOfficerId: officer.id },
      });
      console.log(`  Updated worker "${worker.name}" (${worker.id}) -> linked to officer "${officer.name}" (${officer.id})`);
    } else {
      console.warn(`  ⚠️ Could not find an officer to link worker "${worker.name}" (${worker.id})`);
    }
  }

  console.log('✅ Backfill complete!');
}

main().finally(() => prisma.$disconnect());
