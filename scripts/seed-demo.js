const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { PrismaClient, UserRole, AuthProvider, ComplaintStatus, PriorityLevel } = require('@prisma/client');

// Database safety guard
const ALLOWED_TEST_HOST = 'ep-raspy-voice-aerpv8ej-pooler.c-2.us-east-2.aws.neon.tech';
const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl.includes(ALLOWED_TEST_HOST) && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
  console.error('[SAFETY ERROR] seed:demo is strictly restricted to the Neon TEST database.');
  process.exit(1);
}

const prisma = new PrismaClient();

function generate12CharPassword() {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const specials = '!@#$%&*';
  const all = upper + lower + digits + specials;

  const chars = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    digits[crypto.randomInt(0, digits.length)],
    specials[crypto.randomInt(0, specials.length)],
  ];

  for (let i = chars.length; i < 12; i++) {
    chars.push(all[crypto.randomInt(0, all.length)]);
  }

  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join('');
}

async function seed() {
  console.log('[Seed] Database safety check passed. Starting idempotent demo seed...');

  // Warm up DB with retries
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      break;
    } catch (err) {
      console.log(`[Seed] DB warmup attempt ${attempt} failed: ${err.message}. Retrying in 2s...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  // 1. Ensure Municipality
  const municipality = await prisma.municipality.upsert({
    where: { code: 'NDMC' },
    update: { name: 'New Delhi Municipal Council', city: 'New Delhi', state: 'Delhi' },
    create: {
      name: 'New Delhi Municipal Council',
      code: 'NDMC',
      city: 'New Delhi',
      state: 'Delhi',
    },
  });

  // 2. Ensure Departments
  const roadsDept = await prisma.department.upsert({
    where: { name: 'Roads & Infrastructure' },
    update: { municipalityId: municipality.id },
    create: {
      name: 'Roads & Infrastructure',
      description: 'Maintenance of municipal roads, bridges, and footpaths',
      municipalityId: municipality.id,
      headOfficeAddress: 'Block 4, Palika Kendra, Sansad Marg, New Delhi',
    },
  });

  const sanitationDept = await prisma.department.upsert({
    where: { name: 'Sanitation & Waste Management' },
    update: { municipalityId: municipality.id },
    create: {
      name: 'Sanitation & Waste Management',
      description: 'Solid waste management, garbage collection, and street cleanliness',
      municipalityId: municipality.id,
      headOfficeAddress: 'Block 6, Palika Kendra, Sansad Marg, New Delhi',
    },
  });

  const waterDept = await prisma.department.upsert({
    where: { name: 'Water Supply & Drainage' },
    update: { municipalityId: municipality.id },
    create: {
      name: 'Water Supply & Drainage',
      description: 'Water pipeline distribution, sewerage systems, and drainage networks',
      municipalityId: municipality.id,
      headOfficeAddress: 'Block 2, Palika Kendra, Sansad Marg, New Delhi',
    },
  });

  // 3. Ensure Categories
  const roadPotholeCat = await prisma.category.upsert({
    where: { name: 'Potholes & Road Damage' },
    update: { departmentId: roadsDept.id },
    create: {
      name: 'Potholes & Road Damage',
      description: 'Road depressions, potholes, broken asphalt, and road cave-ins',
      departmentId: roadsDept.id,
    },
  });

  const sanitationCat = await prisma.category.upsert({
    where: { name: 'Garbage Overflow & Waste' },
    update: { departmentId: sanitationDept.id },
    create: {
      name: 'Garbage Overflow & Waste',
      description: 'Uncollected refuse, overflowing community dumpsters, and illegal dumping',
      departmentId: sanitationDept.id,
    },
  });

  const waterCat = await prisma.category.upsert({
    where: { name: 'Water Leakage & Pipe Burst' },
    update: { departmentId: waterDept.id },
    create: {
      name: 'Water Leakage & Pipe Burst',
      description: 'High-pressure pipeline leaks, low water pressure, and contaminated supply',
      departmentId: waterDept.id,
    },
  });

  // 4. Create / Upsert Demo Staff and Citizen Accounts
  const credentialsLog = [];
  const rolesConfig = [
    {
      role: UserRole.SUPER_ADMIN,
      email: 'demo.superadmin@smartcity.gov.in',
      name: 'Demo Super Admin',
      loginId: 'SADM-DEMO01',
      deptId: null,
    },
    {
      role: UserRole.ADMIN,
      email: 'demo.admin@smartcity.gov.in',
      name: 'Demo Municipal Admin',
      loginId: 'ADM-DEMO01',
      deptId: null,
    },
    {
      role: UserRole.DEPARTMENT_HEAD,
      email: 'demo.depthead@smartcity.gov.in',
      name: 'Demo Department Head',
      loginId: 'DHD-DEMO01',
      deptId: roadsDept.id,
    },
    {
      role: UserRole.DEPARTMENT_OFFICER,
      email: 'demo.officer@smartcity.gov.in',
      name: 'Demo Nodal Officer',
      loginId: 'OFF-DEMO01',
      deptId: roadsDept.id,
    },
    {
      role: UserRole.FIELD_WORKER,
      email: 'demo.fieldworker@smartcity.gov.in',
      name: 'Demo Field Technician',
      loginId: 'FWK-DEMO01',
      deptId: roadsDept.id,
    },
  ];

  let officerUser = null;
  let fieldWorkerUser = null;

  for (const item of rolesConfig) {
    const existing = await prisma.user.findUnique({ where: { email: item.email } });
    const rawPassword = generate12CharPassword();
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    const user = await prisma.user.upsert({
      where: { email: item.email },
      update: {
        role: item.role,
        name: item.name,
        loginId: item.loginId,
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
        isAuthorized: true,
        isSuspended: false,
        deletedAt: null,
        municipalityId: municipality.id,
        departmentId: item.deptId,
      },
      create: {
        email: item.email,
        name: item.name,
        role: item.role,
        loginId: item.loginId,
        passwordHash,
        mustChangePassword: false,
        failedLoginCount: 0,
        isAuthorized: true,
        isSuspended: false,
        authProvider: AuthProvider.GOOGLE,
        municipalityId: municipality.id,
        departmentId: item.deptId,
      },
    });

    if (item.role === UserRole.DEPARTMENT_OFFICER) {
      officerUser = user;
    }
    if (item.role === UserRole.FIELD_WORKER) {
      fieldWorkerUser = user;
    }

    credentialsLog.push({
      role: item.role,
      email: item.email,
      loginId: item.loginId,
      password: rawPassword,
    });
  }

  // Link Field Worker to Officer
  if (fieldWorkerUser && officerUser) {
    await prisma.user.update({
      where: { id: fieldWorkerUser.id },
      data: { assignedOfficerId: officerUser.id },
    });
  }

  // 5. Ensure Citizen Account
  const citizen = await prisma.user.upsert({
    where: { id: 'citizen_9876543210' },
    update: {
      mobileNumber: '9876543210',
      isSuspended: false,
      isAuthorized: true,
      name: 'Bajrang Kumar',
      email: 'kumarbajrang0154@gmail.com',
      role: UserRole.CITIZEN,
      municipalityId: municipality.id,
    },
    create: {
      id: 'citizen_9876543210',
      mobileNumber: '9876543210',
      email: 'kumarbajrang0154@gmail.com',
      name: 'Bajrang Kumar',
      role: UserRole.CITIZEN,
      authProvider: AuthProvider.MOBILE_OTP,
      municipalityId: municipality.id,
      isAuthorized: true,
      isSuspended: false,
    },
  });

  // Ensure test accounts for suite compatibility
  await prisma.user.upsert({
    where: { email: 'officer.roads@smartcity.gov.in' },
    update: {
      role: UserRole.DEPARTMENT_OFFICER,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      municipalityId: municipality.id,
    },
    create: {
      id: 'usr_officer_roads_1',
      email: 'officer.roads@smartcity.gov.in',
      name: 'Amit Patel',
      role: UserRole.DEPARTMENT_OFFICER,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      municipalityId: municipality.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'fieldworker@intellicivic.gov.in' },
    update: {
      role: UserRole.FIELD_WORKER,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      assignedOfficerId: 'usr_officer_roads_1',
      municipalityId: municipality.id,
    },
    create: {
      id: 'fw-demo-1',
      email: 'fieldworker@intellicivic.gov.in',
      name: 'Ramesh Kumar',
      role: UserRole.FIELD_WORKER,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      assignedOfficerId: 'usr_officer_roads_1',
      municipalityId: municipality.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'otherfieldworker@intellicivic.gov.in' },
    update: {
      role: UserRole.FIELD_WORKER,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      assignedOfficerId: 'usr_officer_roads_1',
      municipalityId: municipality.id,
    },
    create: {
      id: 'fw-demo-other',
      email: 'otherfieldworker@intellicivic.gov.in',
      name: 'Suresh Verma',
      role: UserRole.FIELD_WORKER,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      assignedOfficerId: 'usr_officer_roads_1',
      municipalityId: municipality.id,
    },
  });

  await prisma.user.upsert({
    where: { email: 'head.roads@smartcity.gov.in' },
    update: {
      role: UserRole.DEPARTMENT_HEAD,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      municipalityId: municipality.id,
    },
    create: {
      id: 'usr_dept_head_roads',
      email: 'head.roads@smartcity.gov.in',
      name: 'Rajesh Sharma',
      role: UserRole.DEPARTMENT_HEAD,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      departmentId: roadsDept.id,
      municipalityId: municipality.id,
    },
  });

  await prisma.user.upsert({
    where: { email: '23cs025@kpriet.ac.in' },
    update: {
      role: UserRole.CITIZEN,
      isAuthorized: true,
      isSuspended: false,
      municipalityId: municipality.id,
    },
    create: {
      id: 'usr_conflict_test_user',
      email: '23cs025@kpriet.ac.in',
      name: 'Existing Conflict Citizen',
      role: UserRole.CITIZEN,
      authProvider: AuthProvider.GOOGLE,
      isAuthorized: true,
      isSuspended: false,
      municipalityId: municipality.id,
    },
  });

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
      citizenId: citizen.id,
      categoryId: roadPotholeCat.id,
      departmentId: roadsDept.id,
      assignedFieldWorkerId: 'fw-demo-1',
    },
  });

  // 6. Ensure Complaints in EVERY status
  const complaintBlueprints = [
    {
      ticketId: 'DEMO-SUBMITTED-01',
      title: 'Faulty High-Mast Streetlight at B-Block Junction',
      description: 'The street light has been flickering and completely off for the last 3 days causing nighttime safety issues.',
      status: ComplaintStatus.SUBMITTED,
      priority: PriorityLevel.MEDIUM,
      departmentId: roadsDept.id,
      categoryId: roadPotholeCat.id,
      assignedFieldWorkerId: null,
      readyForReview: false,
      resolutionNotes: null,
    },
    {
      ticketId: 'DEMO-AIPROC-01',
      title: 'Overflowing Municipal Dumpster near Public Park',
      description: 'Municipal dumpster is overflowing onto the main sidewalk, emitting strong foul odor and attracting stray cattle.',
      status: ComplaintStatus.AI_PROCESSING,
      priority: PriorityLevel.HIGH,
      departmentId: sanitationDept.id,
      categoryId: sanitationCat.id,
      assignedFieldWorkerId: null,
      readyForReview: false,
      resolutionNotes: null,
    },
    {
      ticketId: 'DEMO-REVIEW-01',
      title: 'Deep Road Cave-In near Metro Station Gate 2',
      description: 'Dangerous pothole formed after recent rainfall, measuring approximately 2 feet wide and 6 inches deep.',
      status: ComplaintStatus.PENDING_DEPT_REVIEW,
      priority: PriorityLevel.CRITICAL,
      departmentId: roadsDept.id,
      categoryId: roadPotholeCat.id,
      assignedFieldWorkerId: null,
      readyForReview: false,
      resolutionNotes: null,
    },
    {
      ticketId: 'DEMO-ASSIGNED-01',
      title: 'Major Potable Water Pipeline Leakage at Sector 4',
      description: 'Potable water is gushing onto the road from a ruptured supply line, wasting clean water and flooding pavement.',
      status: ComplaintStatus.ASSIGNED,
      priority: PriorityLevel.HIGH,
      departmentId: waterDept.id,
      categoryId: waterCat.id,
      assignedFieldWorkerId: fieldWorkerUser ? fieldWorkerUser.id : null,
      readyForReview: false,
      resolutionNotes: null,
    },
    {
      ticketId: 'DEMO-INPROG-01',
      title: 'Sunken Sewer Cover along Market Avenue',
      description: 'Iron manhole frame has collapsed by several inches; repair crew is currently on-site executing leveling.',
      status: ComplaintStatus.IN_PROGRESS,
      priority: PriorityLevel.HIGH,
      departmentId: roadsDept.id,
      categoryId: roadPotholeCat.id,
      assignedFieldWorkerId: fieldWorkerUser ? fieldWorkerUser.id : null,
      readyForReview: true,
      fieldWorkerRemarks: 'Concrete ring installed; curing in progress before road resurfacing.',
      resolutionNotes: null,
    },
    {
      ticketId: 'DEMO-RESOLVED-01',
      title: 'Urgent Pothole Patching on Connaught Outer Circle',
      description: 'Cold asphalt mixture applied, leveled with steam roller and sealed. Safe for two-wheeler and vehicle traffic.',
      status: ComplaintStatus.RESOLVED,
      priority: PriorityLevel.HIGH,
      departmentId: roadsDept.id,
      categoryId: roadPotholeCat.id,
      assignedFieldWorkerId: fieldWorkerUser ? fieldWorkerUser.id : null,
      readyForReview: true,
      resolvedAt: new Date(Date.now() - 2 * 3600 * 1000),
      resolutionNotes: 'Completed permanent bituminous patching. Site inspected and confirmed safe by Nodal Officer.',
    },
    {
      ticketId: 'DEMO-CLOSED-01',
      title: 'Broken Concrete Slab on Pedestrian Walkway',
      description: 'Replaced broken sidewalk paving stones with interlocking anti-skid pavers. Citizen marked satisfactory.',
      status: ComplaintStatus.CLOSED,
      priority: PriorityLevel.LOW,
      departmentId: roadsDept.id,
      categoryId: roadPotholeCat.id,
      assignedFieldWorkerId: fieldWorkerUser ? fieldWorkerUser.id : null,
      readyForReview: true,
      resolvedAt: new Date(Date.now() - 48 * 3600 * 1000),
      closedAt: new Date(Date.now() - 24 * 3600 * 1000),
      resolutionNotes: 'Walkway restored and verified clean.',
    },
    {
      ticketId: 'DEMO-REJECTED-01',
      title: 'Internal Apartment Complex Drainage Maintenance Request',
      description: 'Private residential society drainage network inside private gated compound.',
      status: ComplaintStatus.REJECTED,
      priority: PriorityLevel.LOW,
      departmentId: waterDept.id,
      categoryId: waterCat.id,
      assignedFieldWorkerId: null,
      readyForReview: false,
      resolutionNotes: 'Private property drainage does not fall under municipal jurisdiction. Please contact RWA.',
    },
    {
      ticketId: 'DEMO-DUPLICATE-01',
      title: 'Duplicate Report: Faulty Streetlight B-Block',
      description: 'Second report of the same faulty streetlight ticket reported earlier.',
      status: ComplaintStatus.DUPLICATE,
      priority: PriorityLevel.LOW,
      departmentId: roadsDept.id,
      categoryId: roadPotholeCat.id,
      assignedFieldWorkerId: null,
      readyForReview: false,
      resolutionNotes: 'Merged with active ticket DEMO-SUBMITTED-01.',
    },
  ];

  for (const bp of complaintBlueprints) {
    await prisma.complaint.upsert({
      where: { ticketId: bp.ticketId },
      update: {
        title: bp.title,
        description: bp.description,
        status: bp.status,
        priority: bp.priority,
        departmentId: bp.departmentId,
        categoryId: bp.categoryId,
        assignedFieldWorkerId: bp.assignedFieldWorkerId,
        readyForReview: bp.readyForReview,
        fieldWorkerRemarks: bp.fieldWorkerRemarks || null,
        resolutionNotes: bp.resolutionNotes,
        resolvedAt: bp.resolvedAt || null,
        closedAt: bp.closedAt || null,
      },
      create: {
        ticketId: bp.ticketId,
        citizenId: citizen.id,
        municipalityId: municipality.id,
        title: bp.title,
        description: bp.description,
        status: bp.status,
        priority: bp.priority,
        departmentId: bp.departmentId,
        categoryId: bp.categoryId,
        assignedFieldWorkerId: bp.assignedFieldWorkerId,
        readyForReview: bp.readyForReview,
        fieldWorkerRemarks: bp.fieldWorkerRemarks || null,
        resolutionNotes: bp.resolutionNotes,
        resolvedAt: bp.resolvedAt || null,
        closedAt: bp.closedAt || null,
      },
    });
  }

  // 7. Write credentials to git-ignored demo-credentials.local.txt
  const credsFilePath = path.join(process.cwd(), 'demo-credentials.local.txt');
  const fileLines = [
    '# ====================================================================',
    '# INTELLICIVIC DEMO CREDENTIALS (LOCAL TEST DATABASE ONLY)',
    '# Generated: ' + new Date().toISOString(),
    '# Note: NEVER commit this file. Listed in .gitignore.',
    '# ====================================================================',
    '',
  ];

  for (const c of credentialsLog) {
    fileLines.push(`Role:     ${c.role}`);
    fileLines.push(`Email:    ${c.email}`);
    fileLines.push(`Login ID: ${c.loginId}`);
    fileLines.push(`Password: ${c.password}`);
    fileLines.push('----------------------------------------------------');
  }

  fileLines.push(`Citizen Mobile: 9876543210 (Use OTP mock or dev login)`);
  fileLines.push(`Citizen Email:  demo.citizen@smartcity.gov.in`);
  fileLines.push('');

  fs.writeFileSync(credsFilePath, fileLines.join('\n'), { encoding: 'utf-8', mode: 0o600 });

  // 8. Output summary to console (PRINT LOGIN IDs ONLY, NEVER PASSWORDS)
  console.log('\n======================================================');
  console.log('DEMO ACCOUNTS SEEDED SUCCESSFULLY (Idempotent)');
  console.log('Database Host: ' + ALLOWED_TEST_HOST);
  console.log('======================================================');
  console.log('ROLE                 | EMAIL                              | AUTH METHOD');
  console.log('---------------------+------------------------------------+----------------');
  for (const c of credentialsLog) {
    console.log(`${c.role.padEnd(20)} | ${c.email.padEnd(34)} | Password / Google`);
  }
  console.log(`${'CITIZEN'.padEnd(20)} | ${'demo.citizen@smartcity.gov.in'.padEnd(34)} | Mobile OTP (9876543210)`);
  console.log('======================================================');
  console.log(`[PASSWORDS] Generated passwords written to git-ignored: demo-credentials.local.txt`);
  console.log(`[COMPLAINTS] Seeded complaints across all 9 statuses: SUBMITTED, AI_PROCESSING, PENDING_DEPT_REVIEW, ASSIGNED, IN_PROGRESS, RESOLVED, CLOSED, REJECTED, DUPLICATE.`);
}

seed()
  .catch((err) => {
    console.error('[Seed Error]', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
