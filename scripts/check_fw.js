const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.complaint.findUnique({ where: { id: 'cmp-field-assigned' } });
  console.log('COMPLAINT:', c ? { id: c.id, status: c.status, assignedFieldWorkerId: c.assignedFieldWorkerId } : 'NOT FOUND');
  const u = await prisma.user.findMany({ where: { id: { in: ['fw-demo-1', 'fw-demo-other'] } } });
  console.log('USERS:', u.map(x => ({ id: x.id, email: x.email, role: x.role })));
}

main().finally(() => prisma.$disconnect());
