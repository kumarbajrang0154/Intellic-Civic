const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const citizens = await prisma.user.findMany({ where: { role: 'CITIZEN' } });
  console.log('Citizens count:', citizens.length);
  console.log('Citizens:', citizens.map(c => ({
    id: c.id,
    email: c.email,
    mobile: c.mobileNumber,
    name: c.name,
    municipalityId: c.municipalityId,
    isProfileComplete: c.isProfileComplete
  })));

  const totalComp = await prisma.complaint.count();
  console.log('Total Complaints:', totalComp);

  const sampleComplaints = await prisma.complaint.findMany({
    take: 10,
    select: {
      id: true,
      ticketId: true,
      title: true,
      status: true,
      citizenId: true,
      municipalityId: true,
      departmentId: true,
      createdAt: true
    }
  });
  console.log('Sample Complaints:', sampleComplaints);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
