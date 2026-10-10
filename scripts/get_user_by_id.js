const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({ where: { id: 'citizen_9876543210' } });
  console.log('USER WITH ID citizen_9876543210:', u);
}

main().finally(() => prisma.$disconnect());
