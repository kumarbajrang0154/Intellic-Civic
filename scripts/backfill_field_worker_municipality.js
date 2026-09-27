const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('--- RUNNING BACKFILL SCRIPT FOR FIELD WORKER MUNICIPALITY & ASSIGNED OFFICER ---');

  const defaultMunicipalityId = '79c10a22-d1da-488d-8396-94685e0b1b22'; // Coimbatore Municipal Corporation

  // 1. Find all field workers with missing municipalityId
  const workersMissingMuni = await prisma.user.findMany({
    where: {
      role: 'FIELD_WORKER',
      municipalityId: null,
    },
  });

  console.log(`Found ${workersMissingMuni.length} field worker(s) missing municipalityId.`);

  for (const worker of workersMissingMuni) {
    let targetMuniId = defaultMunicipalityId;
    if (worker.assignedOfficerId) {
      const officer = await prisma.user.findUnique({ where: { id: worker.assignedOfficerId } });
      if (officer && officer.municipalityId) {
        targetMuniId = officer.municipalityId;
      }
    }

    await prisma.user.update({
      where: { id: worker.id },
      data: { municipalityId: targetMuniId },
    });
    console.log(`Updated worker ${worker.name} (${worker.id}) with municipalityId: ${targetMuniId}`);
  }

  // 2. Find any field workers missing assignedOfficerId
  const defaultOfficer = await prisma.user.findFirst({
    where: { role: 'DEPARTMENT_OFFICER' },
  });

  if (defaultOfficer) {
    const workersMissingOfficer = await prisma.user.findMany({
      where: {
        role: 'FIELD_WORKER',
        assignedOfficerId: null,
      },
    });

    console.log(`Found ${workersMissingOfficer.length} field worker(s) missing assignedOfficerId.`);

    for (const worker of workersMissingOfficer) {
      await prisma.user.update({
        where: { id: worker.id },
        data: { assignedOfficerId: defaultOfficer.id },
      });
      console.log(`Updated worker ${worker.name} (${worker.id}) with assignedOfficerId: ${defaultOfficer.id}`);
    }
  }

  console.log('--- BACKFILL COMPLETE ---');
}

backfill()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
