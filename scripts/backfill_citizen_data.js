const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfillCitizenData() {
  console.log('=== CITIZEN DATA BACKFILL SCRIPT ===\n');

  // 1. Get default municipality
  let defaultMun = await prisma.municipality.findFirst();
  if (!defaultMun) {
    defaultMun = await prisma.municipality.create({
      data: {
        name: 'Coimbatore City Municipal Corporation',
        code: 'CCMC-MAIN',
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      },
    });
    console.log('[Backfill] Created default municipality:', defaultMun.id);
  }

  // 2. Backfill Citizen Users without municipalityId
  const citizensWithoutMun = await prisma.user.findMany({
    where: {
      role: 'CITIZEN',
      municipalityId: null,
    },
  });

  if (citizensWithoutMun.length > 0) {
    const updatedUsers = await prisma.user.updateMany({
      where: {
        role: 'CITIZEN',
        municipalityId: null,
      },
      data: {
        municipalityId: defaultMun.id,
      },
    });
    console.log(`[Backfill] Updated ${updatedUsers.count} citizen user(s) with default municipalityId (${defaultMun.id}).`);
  } else {
    console.log('[Backfill] All citizen users already have a municipalityId attached.');
  }

  // 3. Backfill Citizen Users with default/missing addresses or emails
  const citizensWithoutAddressOrEmail = await prisma.user.findMany({
    where: {
      role: 'CITIZEN',
      OR: [{ address: null }, { address: '' }, { email: null }, { email: '' }],
    },
  });

  if (citizensWithoutAddressOrEmail.length > 0) {
    for (const citizen of citizensWithoutAddressOrEmail) {
      const email = citizen.email || (citizen.mobileNumber ? `citizen_${citizen.mobileNumber}@intellicivic.gov.in` : `citizen_${citizen.id.slice(0, 8)}@intellicivic.gov.in`);
      await prisma.user.update({
        where: { id: citizen.id },
        data: {
          email,
          address: citizen.address || 'House No. 12, Civic Colony, Ward 5, Main City',
        },
      });
    }
    console.log(`[Backfill] Updated ${citizensWithoutAddressOrEmail.length} citizen user(s) with realistic default address & email.`);
  } else {
    console.log('[Backfill] All citizen users already have addresses & emails set.');
  }

  // 4. Backfill Complaints without municipalityId
  const complaintsWithoutMun = await prisma.complaint.findMany({
    where: {
      municipalityId: null,
    },
  });

  if (complaintsWithoutMun.length > 0) {
    const updatedComplaints = await prisma.complaint.updateMany({
      where: {
        municipalityId: null,
      },
      data: {
        municipalityId: defaultMun.id,
      },
    });
    console.log(`[Backfill] Updated ${updatedComplaints.count} complaint(s) with default municipalityId.`);
  } else {
    console.log('[Backfill] All complaints already have a municipalityId attached.');
  }

  console.log('\n=== BACKFILL COMPLETE ===');
}

backfillCitizenData()
  .catch((err) => {
    console.error('Backfill error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
