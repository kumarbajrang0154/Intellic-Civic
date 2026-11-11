# Phase 1 Deployment & Migration Runbook

This document covers the production deployment steps, Prisma migration commands, Vercel environment variables, and safe rollback procedure for **Phase 1: Complaint Loop Completion** (SLA Auto-Escalation, Citizen Feedback & Reopen, "Me Too" Upvotes, and Transactional Email Notifications).

---

## 1. Pre-Flight Checklist

1. Verify all unit tests, `npm run lint`, `npm run typecheck`, and `npm run build` pass against commit on `main`.
2. Ensure Vercel environment variables listed in Section 3 are configured for **Production** (and Preview where appropriate).
3. Take a Neon branch snapshot / point-in-time checkpoint before applying schema changes to production.
4. Confirm `DIRECT_URL` points to the unpooled Neon connection string (required for Prisma schema DDL locks).

---

## 2. Production Database Migration Command

**NEVER run `prisma migrate dev` against production.** Run `prisma migrate deploy` from a trusted release environment with production `DATABASE_URL` and `DIRECT_URL` exported:

```bash
npx prisma migrate deploy
```

Expected migration applied:
- `20261111180000_phase1_complaint_loop`
  - Extends `NotificationType` enum with `SLA_ESCALATED`, `COMPLAINT_REOPENED` (using `ADD VALUE IF NOT EXISTS`).
  - Adds nullable `escalatedAt` (`TIMESTAMP(3)`) and `voteCount` (`INTEGER NOT NULL DEFAULT 0`) + index `complaints_escalatedAt_idx` on `complaints`.
  - Creates tables `complaint_votes` (unique index on `(complaintId, citizenId)`) and `email_deliveries` (`lastError VARCHAR(200)`).

Verify migration status immediately after running:

```bash
npx prisma migrate status
```

---

## 3. Required Vercel Environment Variables

| Variable | Required? | Purpose | Behavior if Missing |
| --- | --- | --- | --- |
| `CRON_SECRET` | **Required in Prod** | Shared secret verified with `crypto.timingSafeEqual` by `GET/POST /api/cron/sla-escalation`. Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`. | Endpoint rejects all requests with `401 Unauthorized`; scheduled SLA escalations will not run. |
| `RESEND_API_KEY` | Optional (Recommended) | Authenticates HTTPS requests to Resend (`https://api.resend.com/emails`) in `src/services/email-service.ts`. | Email step logs a non-PII warning and returns `SKIPPED`; in-app `Notification` rows and DB transactions still succeed normally. |
| `EMAIL_FROM` | Optional | Verified sender address (`Display Name <email@domain>`) for outbound transactional emails. | Falls back to default `IntelliCivic <notifications@intellicivic.gov.in>`. If domain is unverified in Resend, API returns 4xx and failure is logged to `email_deliveries` with `status = 'FAILED'`. |
| `EMAIL_HMAC_SECRET` | **Recommended in Prod** | Dedicated HMAC-SHA256 secret used to hash recipient email addresses before writing `recipientHash` to `email_deliveries`. | Logs a non-PII warning in production and falls back to deriving a key from `RATE_LIMIT_HMAC_SECRET` / `JWT_SECRET` (or dev seed); plaintext emails are never stored in `email_deliveries`. |
| `NEXT_PUBLIC_FRONTEND_URL` | Recommended | Origin used by `buildAppUrl(...)` when generating links inside emails (complaint links, `#feedback` CTA). | Relative path (`/citizen/complaints/...`) is rendered instead of an absolute `https://...` URL. |
| `DATABASE_URL` / `DIRECT_URL` | Existing Required | Neon pooled runtime URL + unpooled DDL URL. | App/cron fail with 500; migration cannot run. |

---

## 4. Vercel Cron Verification

`vercel.json` schedules:

```json
{
  "path": "/api/cron/sla-escalation",
  "schedule": "*/30 * * * *"
}
```

Manual verification against production after deploy (expect `200 OK` JSON summary):

```bash
curl -sS -X GET "https://<your-domain>/api/cron/sla-escalation" \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 5. Rollback Procedure

### A. Application Rollback
Redeploy or promote the previous passing Vercel deployment before Phase 1. Note that additive nullable columns (`escalatedAt`) and new tables (`complaint_votes`, `email_deliveries`) are backwards-compatible with the prior build.

### B. Database Rollback (Only if schema revert is strictly required)
> **Warning:** Dropping tables/columns permanently deletes recorded votes, escalation timestamps, and email delivery audit logs. PostgreSQL enum values (`SLA_ESCALATED`, `COMPLAINT_REOPENED`) cannot be dropped easily via `ALTER TYPE` without recreating the enum; leaving unused enum values in place is safe for rollbacks.

Run against the unpooled `DIRECT_URL` only after confirming application code no longer references the Phase 1 fields:

```sql
DROP TABLE IF EXISTS "email_deliveries";
DROP TABLE IF EXISTS "complaint_votes";
DROP INDEX IF EXISTS "complaints_escalatedAt_idx";
ALTER TABLE "complaints"
  DROP COLUMN IF EXISTS "voteCount",
  DROP COLUMN IF EXISTS "escalatedAt";
```

Then mark the migration rolled back in Prisma's migration table if rolling forward a replacement migration:

```bash
npx prisma migrate resolve --rolled-back "20261111180000_phase1_complaint_loop"
```
