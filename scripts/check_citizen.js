const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.user.findFirst({ where: { OR: [{ id: 'citizen_9876543210' }, { mobileNumber: '9876543210' }] } });
  console.log('CITIZEN:', c);
}

main().finally(() => prisma.$disconnect());
