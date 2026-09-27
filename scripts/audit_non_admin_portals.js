const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { SignJWT } = require('jose');

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createJwtToken(payload, expiresIn = '7d') {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(JWT_SECRET);
}

async function main() {
  console.log('====================================================');
  console.log('SYSTEMATIC AUDIT ACROSS ALL NON-ADMIN PORTALS');
  console.log('====================================================\n');

  // 1. Fetch test users for each role
  const citizenUser = await prisma.user.findFirst({ where: { role: 'CITIZEN' } });
  const deptHeadUser = await prisma.user.findFirst({ where: { role: 'DEPARTMENT_HEAD' } });
  const officerUser = await prisma.user.findFirst({ where: { role: 'DEPARTMENT_OFFICER' } });
  const fieldWorkerUser = await prisma.user.findFirst({ where: { role: 'FIELD_WORKER' } });

  console.log('Test Users Found:');
  console.log('  CITIZEN:', citizenUser ? `${citizenUser.id} (${citizenUser.email || citizenUser.mobileNumber})` : 'NONE');
  console.log('  DEPT_HEAD:', deptHeadUser ? `${deptHeadUser.id} (${deptHeadUser.email}) deptId: ${deptHeadUser.departmentId}` : 'NONE');
  console.log('  OFFICER:', officerUser ? `${officerUser.id} (${officerUser.email}) deptId: ${officerUser.departmentId}` : 'NONE');
  console.log('  FIELD_WORKER:', fieldWorkerUser ? `${fieldWorkerUser.id} (${fieldWorkerUser.email}) officerId: ${fieldWorkerUser.assignedOfficerId}` : 'NONE');
  console.log('\n----------------------------------------------------\n');

  // Generate tokens
  const citizenToken = citizenUser ? await createJwtToken({ sub: citizenUser.id, role: 'CITIZEN', email: citizenUser.email, mobileNumber: citizenUser.mobileNumber, isAuthorized: true }) : null;
  const deptHeadToken = deptHeadUser ? await createJwtToken({ sub: deptHeadUser.id, role: 'DEPARTMENT_HEAD', email: deptHeadUser.email, departmentId: deptHeadUser.departmentId, municipalityId: deptHeadUser.municipalityId, isAuthorized: true }) : null;
  const officerToken = officerUser ? await createJwtToken({ sub: officerUser.id, role: 'DEPARTMENT_OFFICER', email: officerUser.email, departmentId: officerUser.departmentId, municipalityId: officerUser.municipalityId, isAuthorized: true }) : null;
  const fieldWorkerToken = fieldWorkerUser ? await createJwtToken({ sub: fieldWorkerUser.id, role: 'FIELD_WORKER', email: fieldWorkerUser.email, departmentId: fieldWorkerUser.departmentId, assignedOfficerId: fieldWorkerUser.assignedOfficerId, isAuthorized: true }) : null;

  const testComplaint = await prisma.complaint.findFirst();
  const complaintId = testComplaint ? testComplaint.id : 'cmp-123';

  const baseUrl = 'http://localhost:3000';

  async function testRoute(name, url, method = 'GET', token, body = null) {
    const headers = { 'Cookie': `ic_access_token=${token}` };
    if (body) headers['Content-Type'] = 'application/json';
    try {
      const res = await fetch(`${baseUrl}${url}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      let json = null;
      try { json = await res.json(); } catch (e) {}
      const status = res.status;
      const ok = status >= 200 && status < 300;
      const statusSymbol = ok ? '✅' : (status === 401 || status === 403 ? '🔒' : '❌');
      console.log(`${statusSymbol} [${status}] ${name} -> ${method} ${url}`);
      if (!ok) {
        console.log(`     Error details:`, JSON.stringify(json || { statusText: res.statusText }));
      }
      return { status, ok, json };
    } catch (err) {
      console.log(`💥 ERROR ${name} -> ${method} ${url}: ${err.message}`);
      return { status: 500, ok: false, error: err.message };
    }
  }

  // PORTAL 1: CITIZEN PORTAL
  console.log('--- 1. CITIZEN PORTAL AUDIT ---');
  await testRoute('Citizen Auth Me', '/api/auth/me', 'GET', citizenToken);
  await testRoute('Citizen Profile GET', '/api/citizen/profile', 'GET', citizenToken);
  await testRoute('Citizen Profile PUT', '/api/citizen/profile', 'PUT', citizenToken, {
    name: citizenUser?.name || 'Test Citizen',
    email: citizenUser?.email || 'citizen@test.com',
    address: '123 Main Street',
    avatarUrl: ''
  });
  await testRoute('Citizen Complaints List', '/api/complaints', 'GET', citizenToken);
  await testRoute('Citizen Check Duplicate', '/api/complaints/check-duplicate', 'POST', citizenToken, {
    title: 'Water Leak on Main Street',
    description: 'Major pipe leak flowing on road for 3 hours near central market area'
  });
  await testRoute('Citizen Complaint Detail', `/api/complaints/${complaintId}`, 'GET', citizenToken);
  await testRoute('Citizen Notifications', '/api/notifications', 'GET', citizenToken);
  await testRoute('Citizen Feedback', `/api/complaints/${complaintId}/feedback`, 'POST', citizenToken, {
    rating: 5,
    feedbackNotes: 'Great service'
  });
  await testRoute('Citizen Mark Satisfactory', `/api/complaints/${complaintId}/mark-satisfactory`, 'POST', citizenToken, {
    satisfied: true
  });
  await testRoute('Citizen Reopen Complaint', `/api/complaints/${complaintId}/reopen`, 'POST', citizenToken, {
    reason: 'Issue was not fully resolved, pothole still open'
  });

  // PORTAL 2: DEPARTMENT HEAD PORTAL
  console.log('\n--- 2. DEPARTMENT HEAD PORTAL AUDIT ---');
  await testRoute('Dept Head Auth Me', '/api/auth/me', 'GET', deptHeadToken);
  await testRoute('Dept Head Profile GET', '/api/staff/profile', 'GET', deptHeadToken);
  await testRoute('Dept Head Profile PUT', '/api/staff/profile', 'PUT', deptHeadToken, { name: deptHeadUser?.name || 'Head' });
  await testRoute('Dept Head Complaints List (All Depts)', '/api/complaints', 'GET', deptHeadToken);
  await testRoute('Dept Head Complaints Pending AI Confirmation', '/api/complaints?pendingAiConfirmation=true', 'GET', deptHeadToken);
  await testRoute('Dept Head Complaint Detail', `/api/complaints/${complaintId}`, 'GET', deptHeadToken);
  await testRoute('Dept Head Verify Triage', `/api/complaints/${complaintId}/verify-triage`, 'POST', deptHeadToken, {
    action: 'CONFIRM'
  });
  await testRoute('Dept Head Reject Suggestion', `/api/complaints/${complaintId}/reject-suggestion`, 'POST', deptHeadToken, {
    overrideDepartmentId: 'dept_solid_waste',
    overrideCategoryId: 'cat-sanitation',
    reason: 'Wrong AI prediction'
  });
  await testRoute('Dept Head Department Staff Team Roster', `/api/departments/dept_roads_infra/staff`, 'GET', deptHeadToken);

  // PORTAL 3: DEPARTMENT OFFICER PORTAL
  console.log('\n--- 3. DEPARTMENT OFFICER PORTAL AUDIT ---');
  await testRoute('Officer Auth Me', '/api/auth/me', 'GET', officerToken);
  await testRoute('Officer Profile GET', '/api/staff/profile', 'GET', officerToken);
  await testRoute('Officer Complaints Queue', '/api/complaints', 'GET', officerToken);
  await testRoute('Officer Complaint Detail', `/api/complaints/${complaintId}`, 'GET', officerToken);
  await testRoute('Officer Get Field Workers Dropdown', `/api/departments/${officerUser?.departmentId || 'dept_roads_infra'}/staff?role=FIELD_WORKER&assignedOfficerId=${officerUser?.id}`, 'GET', officerToken);
  await testRoute('Officer Assign Field Worker', `/api/complaints/${complaintId}/assign`, 'POST', officerToken, {
    fieldWorkerId: fieldWorkerUser?.id
  });
  await testRoute('Officer Status Update', `/api/complaints/${complaintId}/status`, 'PATCH', officerToken, {
    status: 'IN_PROGRESS',
    notes: 'Starting work'
  });

  // PORTAL 4: FIELD WORKER PORTAL
  console.log('\n--- 4. FIELD WORKER PORTAL AUDIT ---');
  await testRoute('Field Worker Auth Me', '/api/auth/me', 'GET', fieldWorkerToken);
  await testRoute('Field Worker Profile GET', '/api/staff/profile', 'GET', fieldWorkerToken);
  await testRoute('Field Worker Complaints Queue', '/api/field-worker/complaints', 'GET', fieldWorkerToken);
  await testRoute('Field Worker Complaint Detail', `/api/field-worker/complaints/${complaintId}`, 'GET', fieldWorkerToken);
  await testRoute('Field Worker Start Work', `/api/field-worker/complaints/${complaintId}/start`, 'POST', fieldWorkerToken);
  await testRoute('Field Worker Upload Evidence Photo', `/api/field-worker/complaints/${complaintId}/evidence`, 'POST', fieldWorkerToken, {
    stage: 'BEFORE',
    imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
    notes: 'Before photo'
  });
  await testRoute('Field Worker Submit for Review', `/api/field-worker/complaints/${complaintId}/submit-for-review`, 'POST', fieldWorkerToken, {
    remarks: 'Work completed successfully and verified on site'
  });

  console.log('\n====================================================');
  console.log('AUDIT SCRIPT COMPLETED');
  console.log('====================================================');
}

main().finally(() => prisma.$disconnect());
