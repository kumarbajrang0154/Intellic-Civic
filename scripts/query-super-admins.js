require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({
    where: { role: 'SUPER_ADMIN' },
    select: { id: true, name: true, email: true, createdAt: true, role: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('=== SUPER_ADMIN USERS ===');
  console.log(JSON.stringify(admins, null, 2));
  console.log(`Total: ${admins.length}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => process.exit(0));
