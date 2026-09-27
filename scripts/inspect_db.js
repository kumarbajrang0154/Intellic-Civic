const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fwWithoutOfficer = await prisma.user.findMany({
    where: { role: 'FIELD_WORKER', assignedOfficerId: null }
  });
  console.log('FIELD_WORKER count without assignedOfficerId:', fwWithoutOfficer.length);
  fwWithoutOfficer.forEach(u => console.log('  FW:', u.id, u.name, u.email, 'deptId:', u.departmentId));

  const dhUsers = await prisma.user.findMany({
    where: { role: 'DEPARTMENT_HEAD' }
  });
  console.log('\nDEPARTMENT_HEAD count:', dhUsers.length);
  dhUsers.forEach(u => console.log('  DH:', u.id, u.name, u.email, 'deptId:', u.departmentId));

  const allFw = await prisma.user.findMany({
    where: { role: 'FIELD_WORKER' }
  });
  console.log('\nTotal FIELD_WORKER count:', allFw.length);
  allFw.forEach(u => console.log('  FW:', u.id, u.name, 'deptId:', u.departmentId, 'officerId:', u.assignedOfficerId));
}

main().finally(() => prisma.$disconnect());
