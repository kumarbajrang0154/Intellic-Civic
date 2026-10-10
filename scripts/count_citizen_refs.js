const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const compCount = await prisma.complaint.count({ where: { citizenId: '0cecd3fc-e75f-440f-b790-0ea7ecd9c196' } });
  console.log('COMPLAINTS COUNT FOR 0cecd...:', compCount);
}

main().finally(() => prisma.$disconnect());
