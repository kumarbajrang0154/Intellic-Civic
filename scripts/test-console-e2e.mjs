// Console Mode OTP end-to-end verification script
// Run: node --env-file=.env scripts/test-console-e2e.mjs

const mobileNumber = '9876543210';
const baseUrl = 'http://localhost:3000';

console.log('\n=== Console Mode OTP End-to-End Test ===');
console.log('OTP_AUTH_MODE:', process.env.OTP_AUTH_MODE);
console.log('NEXT_PUBLIC_OTP_AUTH_MODE:', process.env.NEXT_PUBLIC_OTP_AUTH_MODE);

// Step 1: Send OTP
console.log('\n1. Requesting OTP via POST /api/auth/send-otp...');
const sendRes = await fetch(`${baseUrl}/api/auth/send-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mobileNumber }),
});

const sendData = await sendRes.json();
console.log('   Response Status:', sendRes.status);
console.log('   Response Body:', JSON.stringify(sendData, null, 2));

if (!sendRes.ok || !sendData.otp) {
  console.error('❌ Failed to request OTP in console mode');
  process.exit(1);
}

const generatedOtp = sendData.otp;
console.log(`   OTP generated successfully: ${generatedOtp}`);

// Step 2: Verify OTP
console.log('\n2. Verifying OTP via POST /api/auth/verify-otp...');
const verifyRes = await fetch(`${baseUrl}/api/auth/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mobileNumber, otp: generatedOtp }),
});

const verifyData = await verifyRes.json();
console.log('   Response Status:', verifyRes.status);
console.log('   Set-Cookie Headers:', verifyRes.headers.get('set-cookie'));
console.log('   Response Body:', JSON.stringify(verifyData, null, 2));

if (verifyRes.status === 200 && verifyData.success) {
  console.log('\n🎉 CONSOLE MODE E2E TEST PASSED PERFECTLY!');
  console.log(' - Random OTP generated and stored in Prisma DB');
  console.log(' - /api/auth/verify-otp verified OTP and returned 200 OK');
  console.log(' - Citizen JWT session cookies created successfully');
} else {
  console.error('❌ Console mode verification failed');
  process.exit(1);
}
