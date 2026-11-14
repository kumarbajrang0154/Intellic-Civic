/**
 * Database Deny-List Guard
 *
 * Enforces strict protection against executing tests, seeds, or migrations
 * against the production database host specified in PRODUCTION_DB_HOST.
 * Exits with code 1 immediately if DATABASE_URL or DIRECT_URL matches
 * PRODUCTION_DB_HOST, regardless of TEST_DATABASE_HOST configuration.
 *
 * NOTE: Contains ZERO hardcoded production hostnames.
 */

export interface DbGuardOptions {
  env?: Record<string, string | undefined>;
  exitFn?: (code: number) => void;
  logFn?: (msg: string) => void;
}

export function extractDbHost(rawUrl?: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().trim();
  } catch {
    const match = rawUrl.match(/@([^/:?]+)/);
    return match ? match[1].toLowerCase().trim() : '';
  }
}

export function isProductionDatabaseHost(options: DbGuardOptions = {}): boolean {
  const env = options.env ?? process.env;
  const prodHost = env.PRODUCTION_DB_HOST?.toLowerCase().trim();
  if (!prodHost) return false;

  const dbHost = extractDbHost(env.DATABASE_URL);
  const directHost = extractDbHost(env.DIRECT_URL);

  return (
    (Boolean(dbHost) && (dbHost === prodHost || dbHost.endsWith('.' + prodHost))) ||
    (Boolean(directHost) && (directHost === prodHost || directHost.endsWith('.' + prodHost)))
  );
}

export function assertNotProductionDatabase(options: DbGuardOptions = {}): void {
  const env = options.env ?? process.env;
  const exitFn = options.exitFn ?? ((code: number) => process.exit(code));
  const logFn = options.logFn ?? ((msg: string) => console.error(msg));

  const prodHost = env.PRODUCTION_DB_HOST?.toLowerCase().trim();
  if (!prodHost) {
    return;
  }

  const dbHost = extractDbHost(env.DATABASE_URL);
  const directHost = extractDbHost(env.DIRECT_URL);

  const isViolation =
    (Boolean(dbHost) && (dbHost === prodHost || dbHost.endsWith('.' + prodHost))) ||
    (Boolean(directHost) && (directHost === prodHost || directHost.endsWith('.' + prodHost)));

  if (isViolation) {
    logFn(
      `\n====================================================================\n` +
      `[DATABASE SAFETY GUARD] VIOLATION: DATABASE_URL host matches PRODUCTION_DB_HOST.\n` +
      `Database operations are strictly forbidden against the production database,\n` +
      `even if TEST_DATABASE_HOST matches it in the environment.\n` +
      `Execution aborted (exit code 1).\n` +
      `====================================================================\n`
    );
    exitFn(1);
    throw new Error('[DATABASE SAFETY GUARD] Aborted: DATABASE_URL host matches PRODUCTION_DB_HOST.');
  }
}

// Auto-run guard when executed directly from CLI or node
if (typeof require !== 'undefined' && require.main === module) {
  assertNotProductionDatabase();
}
