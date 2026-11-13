# Phase 1 Deployment & Migration Runbook

This document covers the production deployment steps, Prisma migration commands, Vercel environment variables, and safe rollback procedure for **Phase 1: Complaint Loop Completion** (SLA Auto-Escalation, Citizen Feedback & Reopen, "Me Too" Upvotes, and Transactional Email Notifications).

---

## 1. Pre-Flight Checklist & Backup Procedures

Before applying any migration to the production database:

1. **Static Validation**: Verify all unit tests, `npm run lint`, `npm run typecheck`, and `npm run build` pass cleanly against the target commit on `main`.
2. **Environment Configuration**: Ensure required Vercel environment variables listed in Section 4 are configured for **Production** (e.g., `CRON_SECRET`, `DIRECT_URL`).
3. **Database Pre-Migration Backup (CRITICAL)**:
   - **Neon Snapshot Branch**:
     ```bash
     # Create an instant copy-on-write snapshot branch via Neon CLI
     neon branches create --name pre-phase1-backup
     ```
   - **pg_dump Logical Backup (Host/Credentials masked)**:
     ```bash
     # Export schema and data using the unpooled DIRECT_URL
     pg_dump "$DIRECT_URL" \
       --format=custom \
       --file="backup_pre_phase1_$(date +%Y%m%d_%H%M%S).dump" \
       --no-owner \
       --no-privileges
     ```
4. Confirm `DIRECT_URL` points to the unpooled Neon connection string (port 5432 direct, not pooled port 6543) for DDL operations.

---

## 2. Production Database Migration Apply

**NEVER run `prisma migrate dev` against production.**

### Method A: Automated Prisma Release Step (Recommended)
Run from a trusted CI/CD release runner or secure deployment shell:

```bash
npx prisma migrate deploy
```

Expected migration applied:
- `20261111180000_phase1_complaint_loop`

### Method B: Manual Transactional SQL Apply (Fallback)
If applying via `psql` or Neon SQL console:

```sql
BEGIN;

-- Extend NotificationType enum idempotently
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SLA_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_REOPENED';

-- Add additive columns and index to complaints
ALTER TABLE "complaints"
  ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voteCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "complaints_escalatedAt_idx" ON "complaints"("escalatedAt");

-- Create complaint_votes table and constraints
CREATE TABLE IF NOT EXISTS "complaint_votes" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "complaint_votes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "complaint_votes_citizenId_idx" ON "complaint_votes"("citizenId");
CREATE UNIQUE INDEX IF NOT EXISTS "complaint_votes_complaintId_citizenId_key" ON "complaint_votes"("complaintId", "citizenId");

ALTER TABLE "complaint_votes"
  DROP CONSTRAINT IF EXISTS "complaint_votes_complaintId_fkey",
  ADD CONSTRAINT "complaint_votes_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaint_votes"
  DROP CONSTRAINT IF EXISTS "complaint_votes_citizenId_fkey",
  ADD CONSTRAINT "complaint_votes_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create email_deliveries table and indexes
CREATE TABLE IF NOT EXISTS "email_deliveries" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_deliveries_status_idx" ON "email_deliveries"("status");
CREATE INDEX IF NOT EXISTS "email_deliveries_createdAt_idx" ON "email_deliveries"("createdAt");

COMMIT;
```

---

## 3. Post-Apply Verification

### A. Schema Verification
Run a read-only check against `information_schema`:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('complaint_votes', 'email_deliveries');

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'complaints'
  AND column_name IN ('voteCount', 'escalatedAt');
```

Verify migration status via Prisma:
```bash
npx prisma migrate status
```

---

## 4. Required Vercel Environment Variables

| Variable | Required? | Purpose | Behavior if Missing |
| --- | --- | --- | --- |
| `CRON_SECRET` | **Required in Prod** | Shared secret verified with `crypto.timingSafeEqual` by `GET/POST /api/cron/sla-escalation`. Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`. | Endpoint rejects all requests with `401 Unauthorized`; scheduled SLA escalations will not run. |
| `RESEND_API_KEY` | Optional (Recommended) | Authenticates HTTPS requests to Resend (`https://api.resend.com/emails`) in `src/services/email-service.ts`. | Email step logs a non-PII warning and returns `SKIPPED`; in-app `Notification` rows and DB transactions still succeed normally. |
| `EMAIL_FROM` | Optional | Verified sender address (`Display Name <email@domain>`) for outbound transactional emails. | Falls back to default `IntelliCivic <notifications@intellicivic.gov.in>`. If domain is unverified in Resend, API returns 4xx and failure is logged to `email_deliveries` with `status = 'FAILED'`. |
| `EMAIL_HMAC_SECRET` | **Recommended in Prod** | Dedicated HMAC-SHA256 secret used to hash recipient email addresses before writing `recipientHash` to `email_deliveries`. | Logs a non-PII warning in production and falls back to deriving a key from `RATE_LIMIT_HMAC_SECRET` / `JWT_SECRET` (or dev seed); plaintext emails are never stored in `email_deliveries`. |
| `NEXT_PUBLIC_FRONTEND_URL` | Recommended | Origin used by `buildAppUrl(...)` when generating links inside emails (complaint links, `#feedback` CTA). | Relative path (`/citizen/complaints/...`) is rendered instead of an absolute `https://...` URL. |
| `DATABASE_URL` / `DIRECT_URL` | Existing Required | Neon pooled runtime URL + unpooled DDL URL. | App/cron fail with 500; migration cannot run. |

---

## 5. Vercel Cron Verification

`vercel.json` schedules:

```json
{
  "path": "/api/cron/sla-escalation",
  "schedule": "0 3 * * *"
}
```

> **Note**: Vercel Hobby plan enforces daily cron limits (`0 3 * * *` runs at 03:00 UTC daily).

Manual verification against production after deployment:

```bash
curl -sS -X GET "https://<your-domain>/api/cron/sla-escalation" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Expected response (`200 OK` JSON):
```json
{
  "success": true,
  "summary": {
    "scanned": 0,
    "escalated": 0,
    "notificationsDispatched": 0
  }
}
```

---

## 6. Rollback Procedure

### A. Application Rollback
Redeploy or promote the previous passing Vercel deployment before Phase 1. Note that additive nullable columns (`escalatedAt`) and new tables (`complaint_votes`, `email_deliveries`) are fully backwards-compatible with prior builds.

### B. Database Rollback (Only if schema revert is strictly required)
> **Warning:** Dropping tables or columns permanently deletes recorded votes, escalation timestamps, and email delivery audit logs.
> PostgreSQL enum values (`SLA_ESCALATED`, `COMPLAINT_REOPENED`) cannot be dropped via `ALTER TYPE DROP VALUE` in standard PostgreSQL; leaving unused enum values in place is safe for rollbacks.

Run against the unpooled `DIRECT_URL` only after confirming application code no longer references Phase 1 fields:

```sql
BEGIN;

DROP TABLE IF EXISTS "email_deliveries";
DROP TABLE IF EXISTS "complaint_votes";
DROP INDEX IF EXISTS "complaints_escalatedAt_idx";
ALTER TABLE "complaints"
  DROP COLUMN IF EXISTS "voteCount",
  DROP COLUMN IF EXISTS "escalatedAt";

COMMIT;
```

Then record the migration as rolled back in Prisma's tracking table:

```bash
npx prisma migrate resolve --rolled-back "20261111180000_phase1_complaint_loop"
```