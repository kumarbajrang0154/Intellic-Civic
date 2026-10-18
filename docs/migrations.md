# Database Migration Runbook & Baseline Strategy

## 1. How the Baseline Was Decided

### Historical Architecture
IntelliCivic originally managed database schema iterations during early development and initial deployment via `prisma db push`. Consequently, the production Neon PostgreSQL database already contains all core tables, enums, indexes, and relations (`users`, `municipalities`, `complaints`, `evidence`, `notifications`, `platform_settings`, etc.).

### Evaluation of `0_init` (Full-Schema Baseline)
In commit `fed9757`, an initial migration `0_init` containing DDL for the entire database schema was introduced alongside `20261014170000_add_rate_limit_bucket`.
- **Production Conflict**: Because production was never initialized via Prisma Migrate, the `_prisma_migrations` table in production contains no prior migration records.
- **Failure Mode**: Running `npx prisma migrate deploy` on production with `0_init` present would cause Prisma to execute `0_init/migration.sql`. PostgreSQL will immediately reject the statements with fatal errors such as `ERROR: relation "municipalities" already exists` or `ERROR: type "UserRole" already exists`.
- **Zero-Operator-Intervention Requirement**: Standard Prisma baselining requires an operator to manually run `npx prisma migrate resolve --applied 0_init` against production before running `npx prisma migrate deploy`. To avoid requiring manual operator steps and ensure automated deployments succeed reliably, `0_init` was eliminated.

### Migration Decision
The existing production database is adopted as the implicit schema baseline. The migrations directory contains only forward-looking, additive migrations starting with:
- `20261014170000_add_rate_limit_bucket`: Creates the isolated `rate_limit_buckets` table for serverless Postgres rate limiting.

---

## 2. Production Migration Deployment Command

Production deployments must execute migrations using the unpooled direct database connection (`DIRECT_URL`). Connection poolers (such as PgBouncer) do not support the advisory locks and session-level transactional DDL required by Prisma Migrate.

```bash
npx prisma migrate deploy
```

In environments where `DATABASE_URL` is pooled and `DIRECT_URL` is unpooled, Prisma automatically utilizes `directUrl = env("DIRECT_URL")` defined in `prisma/schema.prisma`.

To run explicitly against the direct URL:
```bash
DATABASE_URL="$DIRECT_URL" npx prisma migrate deploy
```

---

## 3. Incident Recovery: If a Migration Fails Midway

If a migration fails midway (e.g. network timeout, transient database connection drop, or lock conflict):

### Step 1: Diagnose Migration State
Check the current state of migrations:
```bash
npx prisma migrate status
```
If a migration was marked as failed in `_prisma_migrations`, Prisma will report:
`The "20261014170000_add_rate_limit_bucket" migration started at ... failed.`

### Step 2: Determine Table State
Check whether the target table was partially created in PostgreSQL:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.\$queryRawUnsafe(\"SELECT table_name FROM information_schema.tables WHERE table_name = 'rate_limit_buckets'\")
  .then(console.log)
  .finally(() => p.\$disconnect());
"
```

### Step 3A: Roll Back and Retry (If Partially Applied or Failed)
1. Drop the partially created table if needed:
   ```sql
   DROP TABLE IF EXISTS "rate_limit_buckets";
   ```
2. Mark the failed migration as rolled back in Prisma's tracking table:
   ```bash
   npx prisma migrate resolve --rolled-back 20261014170000_add_rate_limit_bucket
   ```
3. Re-run deployment:
   ```bash
   npx prisma migrate deploy
   ```

### Step 3B: Mark as Applied (If Table Fully Created Before Network Severed)
If the table `rate_limit_buckets` already exists and matches the schema, mark the migration as resolved:
```bash
npx prisma migrate resolve --applied 20261014170000_add_rate_limit_bucket
```
Then verify with:
```bash
npx prisma migrate status
```
