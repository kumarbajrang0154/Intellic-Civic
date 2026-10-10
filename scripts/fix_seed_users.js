const { PrismaClient, UserRole, AuthProvider, ComplaintStatus, PriorityLevel } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Syncing database users and seed state...');

  // 1. Resolve mobile number conflict between 0cecd3fc and citizen_9876543210
  const otherCitizen = await prisma.user.findUnique({ where: { id: '0cecd3fc-e75f-440f-b790-0ea7ecd9c196' } });
  if (otherCitizen && otherCitizen.mobileNumber === '9876543210') {
    await prisma.user.update({
      where: { id: '0cecd3fc-e75f-440f-b790-0ea7ecd9c196' },
      data: { mobileNumber: null },
    });
    console.log('Cleared mobile from 0cecd3fc');
  }

  // 2. Ensure citizen_9876543210 has mobileNumber 9876543210 and is active
  await prisma.user.upsert({
    where: { id: 'citizen_9876543210' },
    update: {
      mobileNumber: '9876543210',
      isSuspended: false,
      isAuthorized: true,
      name: 'Bajrang Kumar',
      email: 'kumarbajrang0154@gmail.com',
      role: UserRole.CITIZEN,
    },
    create: {
      id: 'citizen_9876543210',
      mobileNumber: '9876543210',
      email: 'kumarbajrang0154@gmail.com',
      name: 'Bajrang Kumar',
      role: UserRole.CITIZEN,
      authProvider: AuthProvider.MOBILE_OTP,
      isAuthorized: true,
      isSuspended: false,
    },
  });
  console.log('Ensured citizen_9876543210');

  // 3. Ensure core departments
  const roadsDept = await prisma.department.findFirst({ where: { name: { contains: 'Road', mode: 'insensitive' } } });
  const roadsDeptId = roadsDept ? roadsDept.id : undefined;

  // 4. Ensure usr_officer_roads_1
  await prisma.user.upsert({
    where: { email: 'officer.roads@smartcity.gov.in' },
    update: {
      role: UserRole.DEPARTMENT_OFFICER,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
    },
    create: {
      id: 'usr_officer_roads_1',
      email: 'officer.roads@smartcity.gov.in',
      name: 'Amit Patel',
      role: UserRole.DEPARTMENT_OFFICER,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
    },
  });
  console.log('Ensured officer.roads@smartcity.gov.in');

  // 5. Ensure fieldworker@intellicivic.gov.in (fw-demo-1)
  await prisma.user.upsert({
    where: { email: 'fieldworker@intellicivic.gov.in' },
    update: {
      role: UserRole.FIELD_WORKER,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
      assignedOfficerId: 'usr_officer_roads_1',
    },
    create: {
      id: 'fw-demo-1',
      email: 'fieldworker@intellicivic.gov.in',
      name: 'Ramesh Kumar',
      role: UserRole.FIELD_WORKER,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
      assignedOfficerId: 'usr_officer_roads_1',
    },
  });
  console.log('Ensured fieldworker@intellicivic.gov.in');

  // 6. Ensure otherfieldworker@intellicivic.gov.in (fw-demo-other)
  await prisma.user.upsert({
    where: { email: 'otherfieldworker@intellicivic.gov.in' },
    update: {
      role: UserRole.FIELD_WORKER,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
      assignedOfficerId: 'usr_officer_roads_1',
    },
    create: {
      id: 'fw-demo-other',
      email: 'otherfieldworker@intellicivic.gov.in',
      name: 'Suresh Verma',
      role: UserRole.FIELD_WORKER,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
      assignedOfficerId: 'usr_officer_roads_1',
    },
  });
  console.log('Ensured otherfieldworker@intellicivic.gov.in');

  // 7. Ensure head.roads@smartcity.gov.in (usr_dept_head_roads)
  await prisma.user.upsert({
    where: { email: 'head.roads@smartcity.gov.in' },
    update: {
      role: UserRole.DEPARTMENT_HEAD,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
    },
    create: {
      id: 'usr_dept_head_roads',
      email: 'head.roads@smartcity.gov.in',
      name: 'Rajesh Sharma',
      role: UserRole.DEPARTMENT_HEAD,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDeptId,
    },
  });
  console.log('Ensured head.roads@smartcity.gov.in');

  // 8. Ensure cmp-field-assigned
  await prisma.complaint.upsert({
    where: { id: 'cmp-field-assigned' },
    update: {
      status: ComplaintStatus.ASSIGNED,
      assignedFieldWorkerId: 'fw-demo-1',
    },
    create: {
      id: 'cmp-field-assigned',
      ticketId: 'INC-2026-0902-7711',
      title: 'Broken Traffic Light Wiring at Ring Road Crossing',
      description: 'Traffic signal control box door damaged. Wires exposed causing traffic light disruption.',
      status: ComplaintStatus.ASSIGNED,
      priority: PriorityLevel.HIGH,
      citizenId: 'citizen_9876543210',
      categoryId: 'cat-electricity',
      departmentId: roadsDeptId,
      assignedFieldWorkerId: 'fw-demo-1',
    },
  });
  console.log('Ensured cmp-field-assigned');
}

main().finally(() => prisma.$disconnect());
