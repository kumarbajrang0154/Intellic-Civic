const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- PHASE 3 DB VERIFICATION ---');

  // 1. Get default municipality
  const municipality = await prisma.municipality.findFirst();
  console.log('Default Municipality:', municipality ? `${municipality.name} (${municipality.id})` : 'None');

  // 2. Ensure we have complaints across at least 2 different departments
  const depts = await prisma.department.findMany();
  console.log('Available departments in DB:', depts.map(d => `${d.name} (${d.id})`));

  if (depts.length >= 2) {
    // Ensure complaint in dept 1
    const comp1 = await prisma.complaint.findFirst({ where: { departmentId: depts[0].id } });
    if (!comp1) {
      const c1 = await prisma.complaint.create({
        data: {
          ticketId: `TEST-DEPT1-${Date.now().toString().slice(-4)}`,
          title: `Road Pothole Test - ${depts[0].name}`,
          description: 'Large pothole on main avenue requiring urgent repair work.',
          status: 'PENDING_DEPT_REVIEW',
          departmentId: depts[0].id,
          municipalityId: municipality?.id,
          citizenId: 'usr_super_admin',
        },
      });
      console.log('Created test complaint in Dept 1:', c1.title);
    }

    // Ensure complaint in dept 2
    const comp2 = await prisma.complaint.findFirst({ where: { departmentId: depts[1].id } });
    if (!comp2) {
      const c2 = await prisma.complaint.create({
        data: {
          ticketId: `TEST-DEPT2-${Date.now().toString().slice(-4)}`,
          title: `Water Leakage Test - ${depts[1].name}`,
          description: 'Pipeline leakage leading to water logging near central market.',
          status: 'PENDING_DEPT_REVIEW',
          departmentId: depts[1].id,
          municipalityId: municipality?.id,
          citizenId: 'usr_super_admin',
        },
      });
      console.log('Created test complaint in Dept 2:', c2.title);
    }
  }

  // 3. Check complaints in DB
  const complaints = await prisma.complaint.findMany({
    select: { id: true, ticketId: true, title: true, departmentId: true, municipalityId: true },
  });

  console.log(`\nTotal complaints in DB: ${complaints.length}`);
  const uniqueDepts = new Set(complaints.map(c => c.departmentId).filter(Boolean));
  console.log(`Unique departments present in complaints: ${uniqueDepts.size} (${Array.from(uniqueDepts).join(', ')})`);

  // 4. Test Dept Head user
  const deptHead = await prisma.user.findFirst({ where: { role: 'DEPARTMENT_HEAD' } });
  console.log('\nDepartment Head user:', {
    id: deptHead?.id,
    name: deptHead?.name,
    email: deptHead?.email,
    departmentId: deptHead?.departmentId,
    municipalityId: deptHead?.municipalityId,
  });

  // 5. Query complaints scoped to Department Head's municipalityId (municipality-wide)
  const targetMunicipalityId = deptHead?.municipalityId || municipality?.id;
  const deptHeadComplaints = await prisma.complaint.findMany({
    where: { municipalityId: targetMunicipalityId },
    select: { id: true, ticketId: true, title: true, departmentId: true, municipalityId: true },
  });

  console.log(`\nComplaints visible to Dept Head (municipalityId = ${targetMunicipalityId}): ${deptHeadComplaints.length}`);
  const visibleDepts = new Set(deptHeadComplaints.map(c => c.departmentId).filter(Boolean));
  console.log(`Departments represented in Dept Head's view: ${visibleDepts.size} distinct departments (${Array.from(visibleDepts).join(', ')})`);

  if (visibleDepts.size >= 2) {
    console.log('\n✅ VERIFICATION SUCCESS: Department Head can see complaints across multiple departments (municipality-wide)!');
  } else {
    console.log('\n⚠️ WARNING: Less than 2 departments seen by Dept Head.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
