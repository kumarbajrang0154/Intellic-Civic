const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== STEP 0: DATABASE & HYPOTHESIS CHECK ===');
  const dhs = await prisma.user.findMany({ where: { role: 'DEPARTMENT_HEAD' } });
  console.log(`Found ${dhs.length} DEPARTMENT_HEAD accounts in DB:`);
  for (const dh of dhs) {
    console.log(`- ID: ${dh.id}, Email: ${dh.email}, Name: ${dh.name}, MunicipalityId: ${dh.municipalityId}, DepartmentId: ${dh.departmentId}`);
  }

  // Check if any DH has null municipalityId
  const missingMunDH = dhs.filter(u => !u.municipalityId);
  if (missingMunDH.length > 0) {
    console.error('FAIL: Found DEPARTMENT_HEAD accounts missing municipalityId:', missingMunDH.map(u => u.email));
  } else {
    console.log('PASS: All DEPARTMENT_HEAD accounts have municipalityId set correctly.');
  }

  // Dev login as head.roads@smartcity.gov.in
  console.log('\n=== STEP 1: DEPT HEAD PORTAL AUDIT ===');
  const loginRes = await fetch('http://localhost:3000/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'head.roads@smartcity.gov.in' }),
  });

  const cookieHeader = loginRes.headers.get('set-cookie');
  if (!cookieHeader) {
    console.error('FAIL: dev-login did not return set-cookie header');
    return;
  }
  const cookies = cookieHeader.split(';')[0];
  console.log('Login successful. Session Cookie obtained.');

  const headers = { Cookie: cookies, 'Content-Type': 'application/json' };

  // 1. /api/auth/me
  const meRes = await fetch('http://localhost:3000/api/auth/me', { headers });
  const meData = await meRes.json();
  console.log(`GET /api/auth/me => Status: ${meRes.status}, Role: ${meData.user?.role}, DeptId: ${meData.user?.departmentId}, MunId: ${meData.user?.municipalityId}`);

  // 2. Dashboard APIs
  console.log('\n--- 2. Dashboard (/dept-head) ---');
  const compRes = await fetch('http://localhost:3000/api/complaints?limit=100', { headers });
  const compData = await compRes.json();
  console.log(`GET /api/complaints?limit=100 => Status: ${compRes.status}, Total items: ${compData.data?.length}`);
  
  if (compData.data && compData.data.length > 0) {
    const deptsInQueue = new Set(compData.data.map(c => c.departmentId || c.department?.id).filter(Boolean));
    console.log(`Complaints span ${deptsInQueue.size} distinct department(s):`, Array.from(deptsInQueue));
  }

  const aiPendingRes = await fetch('http://localhost:3000/api/complaints?pendingAiConfirmation=true&limit=100', { headers });
  const aiPendingData = await aiPendingRes.json();
  console.log(`GET /api/complaints?pendingAiConfirmation=true => Status: ${aiPendingRes.status}, Pending AI Count: ${aiPendingData.data?.length}`);

  // 3. Queue & Filters (/dept-head/complaints)
  console.log('\n--- 3. Complaints Queue & Filters (/dept-head/complaints) ---');
  const filterStatusRes = await fetch('http://localhost:3000/api/complaints?page=1&limit=15&status=IN_PROGRESS', { headers });
  console.log(`GET /api/complaints?status=IN_PROGRESS => Status: ${filterStatusRes.status}`);

  const filterPriorityRes = await fetch('http://localhost:3000/api/complaints?page=1&limit=15&priority=HIGH', { headers });
  console.log(`GET /api/complaints?priority=HIGH => Status: ${filterPriorityRes.status}`);

  // 4. AI Suggestions (/dept-head/ai-suggestions) & Confirm/Override
  console.log('\n--- 4. AI Suggestions (/dept-head/ai-suggestions) ---');
  const suggestionsRes = await fetch('http://localhost:3000/api/complaints?pendingAiConfirmation=true&limit=50', { headers });
  const suggestionsData = await suggestionsRes.json();
  console.log(`GET AI suggestions => Status: ${suggestionsRes.status}, Items: ${suggestionsData.data?.length}`);

  if (suggestionsData.data && suggestionsData.data.length > 0) {
    const targetComp = suggestionsData.data[0];
    console.log(`Testing AI confirm on complaint ID: ${targetComp.id} (${targetComp.ticketId})`);
    
    // Confirm suggestion
    const confirmRes = await fetch(`http://localhost:3000/api/complaints/${targetComp.id}/verify-triage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'confirm' }),
    });
    const confirmBody = await confirmRes.json();
    console.log(`POST /api/complaints/${targetComp.id}/verify-triage (confirm) => Status: ${confirmRes.status}, Body:`, confirmBody);
  } else {
    console.log('No pending AI suggestions to test confirm/override on.');
  }

  // 5. Complaint Detail (/dept-head/complaints/[id])
  console.log('\n--- 5. Complaint Detail & Actions (/dept-head/complaints/[id]) ---');
  if (compData.data && compData.data.length > 0) {
    const sampleComp = compData.data[0];
    const detailRes = await fetch(`http://localhost:3000/api/complaints/${sampleComp.id}`, { headers });
    const detailData = await detailRes.json();
    console.log(`GET /api/complaints/${sampleComp.id} => Status: ${detailRes.status}, Title: "${detailData.title}", Status: ${detailData.status}, Dept: ${detailData.department?.name || 'Unassigned'}`);

    // Check staff lookup for officer assignment
    const deptId = detailData.department?.id || 'all';
    const staffRes = await fetch(`http://localhost:3000/api/departments/${deptId}/staff`, { headers });
    const staffData = await staffRes.json();
    console.log(`GET /api/departments/${deptId}/staff => Status: ${staffRes.status}, Officers count: ${staffData.officers?.length}`);

    if (staffData.officers && staffData.officers.length > 0) {
      const officerToAssign = staffData.officers[0];
      console.log(`Testing officer assignment to officer ID ${officerToAssign.id} (${officerToAssign.name})`);
      const assignRes = await fetch(`http://localhost:3000/api/complaints/${sampleComp.id}/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ officerId: officerToAssign.id, notes: 'Audit assignment' }),
      });
      console.log(`POST /api/complaints/${sampleComp.id}/assign => Status: ${assignRes.status}`);
    }

    // Test reassigning ticket to a different department
    const deptsRes = await fetch('http://localhost:3000/api/departments', { headers });
    if (deptsRes.ok) {
      const deptsData = await deptsRes.json();
      console.log(`GET /api/departments => Status: ${deptsRes.status}, Total departments: ${deptsData.length}`);
      if (deptsData.length > 1) {
        const otherDept = deptsData.find(d => d.id !== detailData.department?.id) || deptsData[1];
        console.log(`Testing reassigning ticket ${sampleComp.id} to department: ${otherDept.name} (${otherDept.id})`);
        const reassignRes = await fetch(`http://localhost:3000/api/complaints/${sampleComp.id}/verify-triage`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'override', overrideDepartmentId: otherDept.id, notes: 'Audit department reassign' }),
        });
        const reassignBody = await reassignRes.json();
        console.log(`POST /api/complaints/${sampleComp.id}/verify-triage (reassign dept) => Status: ${reassignRes.status}, Body:`, reassignBody);
      }
    }
  }

  // 6. Team Roster (/dept-head/team)
  console.log('\n--- 6. Team Roster (/dept-head/team) ---');
  const rosterRes = await fetch('http://localhost:3000/api/departments/all/staff', { headers });
  const rosterData = await rosterRes.json();
  console.log(`GET /api/departments/all/staff => Status: ${rosterRes.status}, Officers: ${rosterData.officers?.length}, FieldWorkers: ${rosterData.fieldWorkers?.length}`);

  // 7. Profile (/dept-head/profile)
  console.log('\n--- 7. Profile Update (/dept-head/profile) ---');
  const profileRes = await fetch('http://localhost:3000/api/staff/profile', {
    method: 'PUT',
    headers,
    body: JSON.stringify({ name: 'Rajesh Sharma (Dept Head)', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' }),
  });
  const profileData = await profileRes.json();
  console.log(`PUT /api/staff/profile => Status: ${profileRes.status}, Updated name: ${profileData.profile?.name}, avatarUrl: ${profileData.profile?.avatarUrl}`);

  // Verify persistence
  const checkMeRes = await fetch('http://localhost:3000/api/auth/me', { headers });
  const checkMeData = await checkMeRes.json();
  console.log(`GET /api/auth/me (after profile update) => Name: ${checkMeData.user?.name}, AvatarUrl: ${checkMeData.user?.avatarUrl}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
