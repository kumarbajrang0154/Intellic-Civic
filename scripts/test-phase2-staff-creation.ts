import { PrismaClient } from '@prisma/client';
import { createStaff } from '../src/services/staffService';
import { ensureSuperAdminUser } from '../src/lib/staff-dept-store';

const prisma = new PrismaClient();

async function testPhase2Creation() {
  console.log('=== Phase 2 Staff Creation Verification ===');

  // Ensure real super admin exists for audit log FK
  const adminUser = await ensureSuperAdminUser();
  const actor = { id: adminUser.id, name: adminUser.name };

  // 1. Fetch an existing Department Officer to use as assigned officer for Field Worker test
  const officer = await prisma.user.findFirst({
    where: { role: 'DEPARTMENT_OFFICER', departmentId: { not: null } },
    include: { department: true },
  });

  if (!officer) {
    console.error('Error: No active Department Officer found in DB for test.');
    process.exit(1);
  }

  console.log(`Found Officer for testing: ${officer.name} (${officer.email}) in Department: ${officer.department?.name} (${officer.departmentId})`);

  // 2. Test DEPARTMENT_HEAD creation without departmentId
  const timestamp = Date.now();
  const deptHeadEmail = `test.depthead.${timestamp}@coimbatore.gov.in`;
  console.log(`\nTesting DEPARTMENT_HEAD creation (no departmentId required)...`);

  const deptHeadResult = await createStaff(
    {
      name: `Test Dept Head ${timestamp}`,
      email: deptHeadEmail,
      role: 'DEPARTMENT_HEAD',
      departmentId: null,
    },
    actor,
  );

  if (!deptHeadResult.ok) {
    console.error('DEPARTMENT_HEAD creation failed:', deptHeadResult.message);
    process.exit(1);
  }

  console.log('DEPARTMENT_HEAD creation SUCCESS:');
  console.log('  ID:', deptHeadResult.data.id);
  console.log('  Name:', deptHeadResult.data.name);
  console.log('  Email:', deptHeadResult.data.email);
  console.log('  Role:', deptHeadResult.data.role);
  console.log('  Department ID:', deptHeadResult.data.departmentId, '(Expected: null)');
  console.log('  Municipality ID:', deptHeadResult.data.municipalityId, '(Expected: non-null Coimbatore Municipality ID)');

  // Verify DB record directly
  const dbHead = await prisma.user.findUnique({ where: { id: deptHeadResult.data.id } });
  console.log('  DB Verification -> departmentId:', dbHead?.departmentId, '| municipalityId:', dbHead?.municipalityId);

  // 3. Test FIELD_WORKER creation with assignedOfficerId
  const fieldWorkerEmail = `test.fieldworker.${timestamp}@coimbatore.gov.in`;
  console.log(`\nTesting FIELD_WORKER creation (with assignedOfficerId)...`);

  const fieldWorkerResult = await createStaff(
    {
      name: `Test Field Worker ${timestamp}`,
      email: fieldWorkerEmail,
      role: 'FIELD_WORKER',
      departmentId: officer.departmentId,
      assignedOfficerId: officer.id,
    },
    actor,
  );

  if (!fieldWorkerResult.ok) {
    console.error('FIELD_WORKER creation failed:', fieldWorkerResult.message);
    process.exit(1);
  }

  console.log('FIELD_WORKER creation SUCCESS:');
  console.log('  ID:', fieldWorkerResult.data.id);
  console.log('  Name:', fieldWorkerResult.data.name);
  console.log('  Email:', fieldWorkerResult.data.email);
  console.log('  Role:', fieldWorkerResult.data.role);
  console.log('  Department ID:', fieldWorkerResult.data.departmentId);
  console.log('  Assigned Officer ID:', fieldWorkerResult.data.assignedOfficerId);
  console.log('  Assigned Officer Name:', fieldWorkerResult.data.assignedOfficerName);
  console.log('  Municipality ID:', fieldWorkerResult.data.municipalityId);

  // Verify DB record directly
  const dbWorker = await prisma.user.findUnique({ where: { id: fieldWorkerResult.data.id } });
  console.log('  DB Verification -> departmentId:', dbWorker?.departmentId, '| assignedOfficerId:', dbWorker?.assignedOfficerId, '| municipalityId:', dbWorker?.municipalityId);

  // Clean up test records
  if (dbHead) await prisma.user.delete({ where: { id: dbHead.id } });
  if (dbWorker) await prisma.user.delete({ where: { id: dbWorker.id } });
  console.log('\nTest records cleaned up cleanly.');
  console.log('=== Phase 2 Verification Completed Successfully ===');
}

testPhase2Creation()
  .catch((e) => {
    console.error('Test script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
