const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting Phase 1 Municipality backfill...');

  // 1. Seed single Municipality ("Coimbatore Municipality")
  let municipality = await prisma.municipality.findFirst({
    where: { OR: [{ name: 'Coimbatore Municipality' }, { code: 'CBE-MUN' }] },
  });

  if (!municipality) {
    municipality = await prisma.municipality.create({
      data: {
        name: 'Coimbatore Municipality',
        code: 'CBE-MUN',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      },
    });
    console.log('Created Municipality:', municipality.id, municipality.name);
  } else {
    console.log('Found existing Municipality:', municipality.id, municipality.name);
  }

  // 2. Backfill users.municipalityId
  const userResult = await prisma.user.updateMany({
    where: { municipalityId: null },
    data: { municipalityId: municipality.id },
  });
  console.log(`Updated ${userResult.count} users with municipalityId.`);

  // 3. Backfill complaints.municipalityId
  const complaintResult = await prisma.complaint.updateMany({
    where: { municipalityId: null },
    data: { municipalityId: municipality.id },
  });
  console.log(`Updated ${complaintResult.count} complaints with municipalityId.`);

  // 4. Backfill departments.municipalityId
  const deptResult = await prisma.department.updateMany({
    where: { municipalityId: null },
    data: { municipalityId: municipality.id },
  });
  console.log(`Updated ${deptResult.count} departments with municipalityId.`);

  // 5. Clear departmentId for DEPARTMENT_HEAD users
  const deptHeadResult = await prisma.user.updateMany({
    where: { role: 'DEPARTMENT_HEAD' },
    data: { departmentId: null },
  });
  console.log(`Cleared departmentId for ${deptHeadResult.count} DEPARTMENT_HEAD users.`);

  console.log('Backfill complete!');
}

backfill()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
