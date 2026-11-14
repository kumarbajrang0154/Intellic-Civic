/**
 * CommonJS export for Node.js scripts
 */
function extractDbHost(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().trim();
  } catch {
    const match = rawUrl.match(/@([^/:?]+)/);
    return match ? match[1].toLowerCase().trim() : '';
  }
}

function isProductionDatabaseHost(options = {}) {
  const env = options.env || process.env;
  const prodHost = env.PRODUCTION_DB_HOST ? env.PRODUCTION_DB_HOST.toLowerCase().trim() : '';
  if (!prodHost) return false;

  const dbHost = extractDbHost(env.DATABASE_URL);
  const directHost = extractDbHost(env.DIRECT_URL);

  return (
    (Boolean(dbHost) && (dbHost === prodHost || dbHost.endsWith('.' + prodHost))) ||
    (Boolean(directHost) && (directHost === prodHost || directHost.endsWith('.' + prodHost)))
  );
}

function assertNotProductionDatabase(options = {}) {
  const env = options.env || process.env;
  const exitFn = options.exitFn || ((code) => process.exit(code));
  const logFn = options.logFn || ((msg) => console.error(msg));

  const prodHost = env.PRODUCTION_DB_HOST ? env.PRODUCTION_DB_HOST.toLowerCase().trim() : '';
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

module.exports = {
  extractDbHost,
  isProductionDatabaseHost,
  assertNotProductionDatabase,
};
