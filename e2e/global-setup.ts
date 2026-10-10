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

  // Warm up the Neon DB connection (it auto-suspends when idle).
  // Retry up to 5 times with exponential backoff so tests don't fail due to cold-start.
  const { PrismaClient } = await import('@prisma/client');
  const warmupClient = new PrismaClient({ datasourceUrl: dbUrl });
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await warmupClient.$queryRaw`SELECT 1`;
      console.log(`[DATABASE SAFETY GUARD] DB connection warmed up on attempt ${attempt}.`);
      lastError = null;
      break;
    } catch (err: any) {
      lastError = err;
      const delay = Math.min(2000 * attempt, 10000);
      console.warn(`[DATABASE SAFETY GUARD] DB warmup attempt ${attempt} failed: ${err?.message}. Retrying in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  await warmupClient.$disconnect().catch(() => {});
  if (lastError) {
    throw new Error(
      `\n====================================================================\n` +
      `[DATABASE SAFETY GUARD] ABORTED: Could not connect to DB after 5 attempts.\n` +
      `Last error: ${lastError.message}\n` +
      `====================================================================\n`
    );
  }
}
