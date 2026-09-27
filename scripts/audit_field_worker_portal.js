const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  console.log('================================================================');
  console.log('  FIELD WORKER PORTAL SYSTEMATIC AUDIT & BUG DETECTION');
  console.log('================================================================\n');

  // 1. Dev Login as Field Worker
  console.log('1. Logging in as Field Worker (fieldworker@intellicivic.gov.in)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fieldworker@intellicivic.gov.in', role: 'FIELD_WORKER' }),
  });
  console.log('Login HTTP status:', loginRes.status);
  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) {
    console.error('FAILED: No set-cookie header received during dev-login');
    process.exit(1);
  }
  const cookies = setCookie.split(';')[0];
  console.log('Auth Cookie obtained:', cookies.substring(0, 30) + '...');

  // 2. Fetch /api/field-worker/complaints
  console.log('\n2. Testing GET /api/field-worker/complaints?status=ALL&limit=100...');
  const complaintsRes = await fetch(`${BASE_URL}/api/field-worker/complaints?status=ALL&limit=100`, {
    headers: { Cookie: cookies },
  });
  console.log('Complaints list HTTP status:', complaintsRes.status);
  const complaintsData = await complaintsRes.json();
  console.log(`Retrieved ${complaintsData.data ? complaintsData.data.length : 0} assigned complaints.`);
  if (complaintsData.data && complaintsData.data.length > 0) {
    console.log('Sample complaint assigned to fw-demo-1:', complaintsData.data[0].id, complaintsData.data[0].title);
  }

  // 3. Test Access Control: Try viewing an unassigned complaint
  console.log('\n3. Testing Access Control (attempting to view unassigned complaint)...');
  // Create or pick an unassigned complaint ID from DB or test ID
  const unassignedId = 'cmp-unassigned-test-999';
  const accessTestRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${unassignedId}`, {
    headers: { Cookie: cookies },
  });
  console.log(`Unassigned complaint fetch HTTP status: ${accessTestRes.status}`);
  const accessTestData = await accessTestRes.json();
  console.log('Response message:', accessTestData.message);

  // 4. Test Detail Page of assigned complaint
  const targetComplaint = complaintsData.data && complaintsData.data.length > 0 ? complaintsData.data[0] : null;
  if (targetComplaint) {
    console.log(`\n4. Testing GET /api/field-worker/complaints/${targetComplaint.id}...`);
    const detailRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}`, {
      headers: { Cookie: cookies },
    });
    console.log('Detail HTTP status:', detailRes.status);

    // 5. Test Start Work
    console.log(`\n5. Testing POST /api/field-worker/complaints/${targetComplaint.id}/start...`);
    const startRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}/start`, {
      method: 'POST',
      headers: { Cookie: cookies },
    });
    console.log('Start Work HTTP status:', startRes.status);
    const startData = await startRes.json();
    console.log('Start Work response:', startData);

    // 6. Test Evidence Upload Sequence Guard (Upload AFTER photo first)
    console.log(`\n6a. Testing Evidence Upload Sequence Guard (AFTER before BEFORE)...`);
    const afterFirstRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}/evidence`, {
      method: 'POST',
      headers: { Cookie: cookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'AFTER', imageUrl: 'https://example.com/after.jpg' }),
    });
    console.log('AFTER first HTTP status:', afterFirstRes.status);
    const afterFirstData = await afterFirstRes.json();
    console.log('Sequence Guard response:', afterFirstData);

    // 6b. Upload BEFORE photo
    console.log(`\n6b. Testing BEFORE photo upload...`);
    const beforeRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}/evidence`, {
      method: 'POST',
      headers: { Cookie: cookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'BEFORE', imageUrl: 'https://example.com/before.jpg' }),
    });
    console.log('BEFORE upload HTTP status:', beforeRes.status);
    const beforeData = await beforeRes.json();
    console.log('BEFORE upload response:', beforeData);

    // 6c. Upload AFTER photo
    console.log(`\n6c. Testing AFTER photo upload...`);
    const afterRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}/evidence`, {
      method: 'POST',
      headers: { Cookie: cookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'AFTER', imageUrl: 'https://example.com/after.jpg' }),
    });
    console.log('AFTER upload HTTP status:', afterRes.status);

    // 7. Test Submit for review validation
    console.log(`\n7a. Testing Submit for Review remarks validation (< 5 chars)...`);
    const shortRemarksRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}/submit-for-review`, {
      method: 'POST',
      headers: { Cookie: cookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'abc' }),
    });
    console.log('Short remarks HTTP status:', shortRemarksRes.status);
    const shortRemarksData = await shortRemarksRes.json();
    console.log('Validation response:', shortRemarksData);

    console.log(`\n7b. Testing Submit for Review with valid remarks...`);
    const validSubmitRes = await fetch(`${BASE_URL}/api/field-worker/complaints/${targetComplaint.id}/submit-for-review`, {
      method: 'POST',
      headers: { Cookie: cookies, 'Content-Type': 'application/json' },
      body: JSON.stringify({ remarks: 'Completed site repairs and verified asphalt sealing.' }),
    });
    console.log('Valid submit HTTP status:', validSubmitRes.status);
    const validSubmitData = await validSubmitRes.json();
    console.log('Submit response:', validSubmitData);
  }

  // 8. Test Profile API
  console.log('\n8. Testing Profile GET and PUT (/api/staff/profile)...');
  const getProfileRes = await fetch(`${BASE_URL}/api/staff/profile`, {
    headers: { Cookie: cookies },
  });
  console.log('GET Profile status:', getProfileRes.status);
  const profileData = await getProfileRes.json();
  console.log('Current Profile:', profileData.profile);

  const newAvatarUrl = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
  const putProfileRes = await fetch(`${BASE_URL}/api/staff/profile`, {
    method: 'PUT',
    headers: { Cookie: cookies, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Ramesh Kumar (Field Specialist)', avatarUrl: newAvatarUrl }),
  });
  console.log('PUT Profile status:', putProfileRes.status);
  const putProfileData = await putProfileRes.json();
  console.log('PUT Profile result:', putProfileData);

  // Re-verify profile persistence
  const verifyProfileRes = await fetch(`${BASE_URL}/api/staff/profile`, {
    headers: { Cookie: cookies },
  });
  const verifyData = await verifyProfileRes.json();
  console.log('Re-fetched Profile avatarUrl:', verifyData.profile.avatarUrl);
}

runAudit().catch(console.error);
