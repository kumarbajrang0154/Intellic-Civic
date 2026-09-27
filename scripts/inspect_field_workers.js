const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- INSPECTING FIELD WORKERS IN DATABASE ---');
  const fieldWorkers = await prisma.user.findMany({
    where: { role: 'FIELD_WORKER' },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      municipalityId: true,
      departmentId: true,
      assignedOfficerId: true,
      assignedOfficer: {
        select: {
          id: true,
          name: true,
          email: true
        }
      }
    }
  });

  console.log(`Found ${fieldWorkers.length} FIELD_WORKER records:`);
  console.table(fieldWorkers.map(fw => ({
    id: fw.id,
    name: fw.name,
    email: fw.email,
    municipalityId: fw.municipalityId,
    departmentId: fw.departmentId,
    assignedOfficerId: fw.assignedOfficerId,
    officerName: fw.assignedOfficer ? fw.assignedOfficer.name : 'NULL'
  })));

  const unassigned = fieldWorkers.filter(fw => !fw.assignedOfficerId);
  console.log(`\nUnassigned (assignedOfficerId == null): ${unassigned.length}`);

  console.log('\n--- INSPECTING FIELD WORKER COMPLAINTS ---');
  const complaints = await prisma.complaint.findMany({
    where: { assignedFieldWorkerId: { not: null } },
    select: {
      id: true,
      ticketId: true,
      title: true,
      status: true,
      assignedFieldWorkerId: true,
      departmentId: true,
      municipalityId: true,
      readyForReview: true,
      fieldWorkerRemarks: true
    }
  });
  console.log(`Found ${complaints.length} complaints assigned to field workers:`);
  console.table(complaints);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
