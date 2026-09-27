import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { classifyComplaintRouting } from '../src/services/gemini-service';

async function verifyRouting() {
  console.log('================================================================');
  console.log('  INTELLICIVIC GEMINI SERVICE RUNTIME VERIFICATION TEST');
  console.log('================================================================');
  
  const title = 'Severe Water Pipeline Leakage & Flooding';
  const description = 'Main water supply pipe burst near Sector 4 residential colony. Clean drinking water is wasting profusely and flooding nearby houses.';

  console.log(`\nInput Complaint Title: "${title}"`);
  console.log(`Input Complaint Description: "${description}"\n`);
  
  console.log('Invoking classifyComplaintRouting()...');
  const startTime = Date.now();
  const result = await classifyComplaintRouting(description, title);
  const elapsed = Date.now() - startTime;

  console.log(`\n[Execution Time]: ${elapsed}ms`);
  console.log('[Routing Result Output]:');
  console.log(JSON.stringify(result, null, 2));

  if (result.reasoning.includes('Fallback keyword heuristic')) {
    console.error('\nResult: FAILED - Fell back to keyword heuristic!');
    process.exit(1);
  } else {
    console.log('\nResult: SUCCESS - Direct Gemini AI classification succeeded!');
  }
}

verifyRouting().catch((err) => {
  console.error('Execution Error:', err);
  process.exit(1);
});
