import dotenv from 'dotenv';
import path from 'path';

// Ensure .env is loaded
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default async function globalSetup() {
  const dbUrl = process.env.DATABASE_URL;
  const expectedHost = process.env.TEST_DATABASE_HOST?.trim();

  if (!expectedHost) {
    throw new Error(
      `\n====================================================================\n` +
      `[DATABASE SAFETY GUARD] ABORTED: TEST_DATABASE_HOST is not set.\n` +
      `Tests are blocked from running to protect against touching the wrong database.\n` +
      `Configure TEST_DATABASE_HOST in .env matching your test database host.\n` +
      `====================================================================\n`
    );
  }

  if (!dbUrl) {
    throw new Error(
      `\n====================================================================\n` +
      `[DATABASE SAFETY GUARD] ABORTED: DATABASE_URL is not set in environment.\n` +
      `====================================================================\n`
    );
  }

  let actualHost = '';
  let actualHostname = '';
  try {
    const parsed = new URL(dbUrl);
    actualHost = parsed.host;
    actualHostname = parsed.hostname;
  } catch {
    throw new Error(
      `\n====================================================================\n` +
      `[DATABASE SAFETY GUARD] ABORTED: DATABASE_URL could not be parsed as a valid URL.\n` +
      `====================================================================\n`
    );
  }

  if (actualHost !== expectedHost && actualHostname !== expectedHost) {
    throw new Error(
      `\n====================================================================\n` +
      `[DATABASE SAFETY GUARD] ABORTED: DATABASE_URL host (${actualHost}) does not match TEST_DATABASE_HOST (${expectedHost}).\n` +
      `Tests are blocked from touching non-test databases.\n` +
      `====================================================================\n`
    );
  }

  console.log(`[DATABASE SAFETY GUARD] Verified: DATABASE_URL host matches TEST_DATABASE_HOST (${expectedHost}).`);
}
