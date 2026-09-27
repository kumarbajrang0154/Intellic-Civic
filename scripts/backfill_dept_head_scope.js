const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== BACKFILLING DEPARTMENT_HEAD ACCOUNTS TO MUNICIPALITY-WIDE SCOPE ===');

  let defaultMun = await prisma.municipality.findFirst({
    where: { OR: [{ code: 'CBE-MUN' }, { name: 'Coimbatore Municipality' }] },
  });

  if (!defaultMun) {
    defaultMun = await prisma.municipality.create({
      data: {
        name: 'Coimbatore Municipality',
        code: 'CBE-MUN',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      },
    });
  }

  const result = await prisma.user.updateMany({
    where: { role: 'DEPARTMENT_HEAD' },
    data: {
      departmentId: null,
      municipalityId: defaultMun.id,
    },
  });

  console.log(`Successfully updated ${result.count} DEPARTMENT_HEAD account(s) to departmentId: null, municipalityId: ${defaultMun.id}`);

  const updatedHeads = await prisma.user.findMany({ where: { role: 'DEPARTMENT_HEAD' } });
  updatedHeads.forEach(h => {
    console.log(`- ${h.email} (${h.name}): role=${h.role}, departmentId=${h.departmentId}, municipalityId=${h.municipalityId}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
