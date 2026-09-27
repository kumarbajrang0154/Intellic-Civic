const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const dhs = await prisma.user.findMany({ where: { role: 'DEPARTMENT_HEAD' } });
  console.log('DEPARTMENT_HEAD accounts:');
  dhs.forEach(u => {
    console.log(`ID: ${u.id}, Email: ${u.email}, Name: ${u.name}, Role: ${u.role}, MunicipalityId: ${u.municipalityId}, DepartmentId: ${u.departmentId}`);
  });

  const municipalities = await prisma.municipality.findMany();
  console.log('\nMunicipalities:');
  municipalities.forEach(m => {
    console.log(`ID: ${m.id}, Name: ${m.name}, Code: ${m.code}`);
  });

  const deptCount = await prisma.department.count();
  console.log(`\nTotal Departments: ${deptCount}`);

  const staffCount = await prisma.user.count({
    where: {
      role: { in: ['DEPARTMENT_OFFICER', 'FIELD_WORKER'] }
    }
  });
  console.log(`Total Staff (Officers + Field Workers): ${staffCount}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
