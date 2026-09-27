const { PrismaClient, ComplaintStatus } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedResolvedComplaint() {
  const citizenId = '0cecd3fc-e75f-440f-b790-0ea7ecd9c196';
  
  // Find a complaint owned by this citizen or update one to RESOLVED
  let comp = await prisma.complaint.findFirst({
    where: { citizenId },
  });

  if (!comp) {
    let mun = await prisma.municipality.findFirst();
    comp = await prisma.complaint.create({
      data: {
        ticketId: 'RESOLVED-TEST-101',
        title: 'Resolved Pothole Repair Verification',
        description: 'Pothole repair on Main Street was marked completed by department.',
        status: ComplaintStatus.RESOLVED,
        citizenId,
        municipalityId: mun ? mun.id : undefined,
        resolvedAt: new Date(),
      },
    });
    console.log('[Seed] Created new RESOLVED complaint:', comp.id);
  } else {
    await prisma.complaint.update({
      where: { id: comp.id },
      data: {
        status: ComplaintStatus.RESOLVED,
        resolvedAt: new Date(),
      },
    });
    console.log('[Seed] Updated existing complaint to RESOLVED:', comp.id, comp.ticketId);
  }
}

seedResolvedComplaint()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
