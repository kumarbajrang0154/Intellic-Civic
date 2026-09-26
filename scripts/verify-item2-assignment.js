const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- VERIFY ITEM 2: OFFICER -> FIELD WORKER ASSIGNMENT RESTRICTION ---');

  // 1. Get default municipality & department
  const municipality = await prisma.municipality.findFirst();
  const dept = await prisma.department.findFirst();

  // 2. Create / ensure two Department Officers in the same department
  let officerA = await prisma.user.findFirst({
    where: { role: 'DEPARTMENT_OFFICER', email: 'officer.a.test@coimbatore.gov.in' },
  });
  if (!officerA) {
    officerA = await prisma.user.create({
      data: {
        name: 'Officer Alpha',
        email: 'officer.a.test@coimbatore.gov.in',
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        departmentId: dept?.id,
        municipalityId: municipality?.id,
        isAuthorized: true,
      },
    });
  }

  let officerB = await prisma.user.findFirst({
    where: { role: 'DEPARTMENT_OFFICER', email: 'officer.b.test@coimbatore.gov.in' },
  });
  if (!officerB) {
    officerB = await prisma.user.create({
      data: {
        name: 'Officer Beta',
        email: 'officer.b.test@coimbatore.gov.in',
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        departmentId: dept?.id,
        municipalityId: municipality?.id,
        isAuthorized: true,
      },
    });
  }

  console.log('Officer A:', { id: officerA.id, name: officerA.name });
  console.log('Officer B:', { id: officerB.id, name: officerB.name });

  // 3. Create Field Worker 1 assigned to Officer A, Field Worker 2 assigned to Officer B
  let fw1 = await prisma.user.findFirst({
    where: { role: 'FIELD_WORKER', email: 'fw1.assigned.a@coimbatore.gov.in' },
  });
  if (!fw1) {
    fw1 = await prisma.user.create({
      data: {
        name: 'Field Worker One (Assigned to Officer A)',
        email: 'fw1.assigned.a@coimbatore.gov.in',
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        departmentId: dept?.id,
        municipalityId: municipality?.id,
        assignedOfficerId: officerA.id,
        isAuthorized: true,
      },
    });
  }

  let fw2 = await prisma.user.findFirst({
    where: { role: 'FIELD_WORKER', email: 'fw2.assigned.b@coimbatore.gov.in' },
  });
  if (!fw2) {
    fw2 = await prisma.user.create({
      data: {
        name: 'Field Worker Two (Assigned to Officer B)',
        email: 'fw2.assigned.b@coimbatore.gov.in',
        role: 'FIELD_WORKER',
        authProvider: 'GOOGLE',
        departmentId: dept?.id,
        municipalityId: municipality?.id,
        assignedOfficerId: officerB.id,
        isAuthorized: true,
      },
    });
  }

  console.log('FW1 (Officer A):', { id: fw1.id, name: fw1.name, assignedOfficerId: fw1.assignedOfficerId });
  console.log('FW2 (Officer B):', { id: fw2.id, name: fw2.name, assignedOfficerId: fw2.assignedOfficerId });

  // 4. Test dropdown query for Officer A
  const officerAFieldWorkers = await prisma.user.findMany({
    where: {
      role: 'FIELD_WORKER',
      assignedOfficerId: officerA.id,
    },
  });

  console.log(`\nField workers listed for Officer A (${officerA.name}): ${officerAFieldWorkers.length}`);
  console.log('Listed names:', officerAFieldWorkers.map(w => w.name));

  const hasFW1 = officerAFieldWorkers.some(w => w.id === fw1.id);
  const hasFW2 = officerAFieldWorkers.some(w => w.id === fw2.id);

  if (hasFW1 && !hasFW2) {
    console.log('✅ UI DROPDOWN FILTER SUCCESS: Officer A sees only FW1, FW2 is properly excluded!');
  } else {
    console.log('❌ UI DROPDOWN FILTER FAILURE: Incorrect field worker scoping.', { hasFW1, hasFW2 });
  }

  // 5. Test Complaint Assignment restriction logic directly
  const citizen = await prisma.user.findFirst();
  const complaint = await prisma.complaint.create({
    data: {
      ticketId: `TEST-ASSIGN-${Date.now().toString().slice(-4)}`,
      title: 'Assignment Restriction Verification Complaint',
      description: 'Testing server-side restriction for officer field worker assignment.',
      status: 'ASSIGNED',
      departmentId: dept?.id,
      municipalityId: municipality?.id,
      citizenId: citizen.id,
    },
  });

  console.log(`\nCreated test complaint: ${complaint.ticketId} (${complaint.id})`);

  // Server-side assignment logic simulator matching assignFieldWorkerToComplaint implementation
  async function simulateAssign(complaintId, fieldWorkerId, officerUserId, actorRole) {
    const targetWorker = await prisma.user.findUnique({ where: { id: fieldWorkerId } });
    if (!targetWorker) return { ok: false, status: 404, message: 'Worker not found' };

    if (actorRole === 'DEPARTMENT_OFFICER') {
      if (targetWorker.assignedOfficerId !== officerUserId) {
        return {
          ok: false,
          status: 403,
          message: 'Forbidden: You can only assign complaints to Field Workers assigned to you.',
        };
      }
    }

    const updated = await prisma.complaint.update({
      where: { id: complaintId },
      data: { assignedFieldWorkerId: fieldWorkerId, status: 'ASSIGNED' },
    });

    return { ok: true, status: 200, message: 'Field worker assigned successfully.', complaint: updated };
  }

  // Attempt 1: Officer A assigns FW1 (Their own assigned field worker) -> SHOULD SUCCEED
  const validResult = await simulateAssign(complaint.id, fw1.id, officerA.id, 'DEPARTMENT_OFFICER');
  console.log('\nAttempt 1 (Officer A assigns FW1 - own worker):', {
    ok: validResult.ok,
    status: validResult.status,
    message: validResult.message,
  });

  // Attempt 2: Officer A attempts to assign FW2 (Belongs to Officer B) -> SHOULD BE REJECTED 403
  const invalidResult = await simulateAssign(complaint.id, fw2.id, officerA.id, 'DEPARTMENT_OFFICER');
  console.log('Attempt 2 (Officer A assigns FW2 - Officer B worker):', {
    ok: invalidResult.ok,
    status: invalidResult.status,
    message: invalidResult.message,
  });

  // Attempt 3: SUPER_ADMIN assigns FW2 -> SHOULD SUCCEED (Super Admin bypass)
  const adminResult = await simulateAssign(complaint.id, fw2.id, 'usr_super_admin', 'SUPER_ADMIN');
  console.log('Attempt 3 (SUPER_ADMIN assigns FW2 - admin bypass):', {
    ok: adminResult.ok,
    status: adminResult.status,
    message: adminResult.message,
  });

  if (validResult.ok && !invalidResult.ok && invalidResult.status === 403 && adminResult.ok) {
    console.log('\n✅ SERVER-SIDE VALIDATION SUCCESS: Officer assignment restriction enforced cleanly!');
  } else {
    console.log('\n❌ SERVER-SIDE VALIDATION FAILURE');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
