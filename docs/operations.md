# IntelliCivic Operations Manual

This document details the operational configuration, security boundaries, rate limiting, error monitoring, CI/CD pipeline, and rollback procedures for the IntelliCivic production platform.

---

## 1. Environment Variables Matrix

| Variable | Scope | Development | Staging / Preview | Production | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Server | Local/Dev Neon Pooler | Staging Neon Pooler | Production Neon Pooler | Prisma transactional connection pooler |
| `DIRECT_URL` | Server | Local/Dev Direct Host | Staging Direct Host | Production Direct Host | Direct migration & DDL connection |
| `TEST_DATABASE_HOST` | Server | Dev Neon Hostname | Staging Neon Hostname | **NEVER SET TO PROD** | Safety guard preventing tests touching production |
| `JWT_SECRET` | Server | Dev secret (>=32 chars) | Staging secret | High-entropy secret | Session HMAC signing key |
| `RATE_LIMIT_HMAC_SECRET` | Server | Dev fallback secret | Staging secret | **Required** (High entropy) | Secret for HMAC-SHA256 hashing mobile numbers in rate limit keys |
| `OTP_AUTH_MODE` | Server | `console` (or `firebase`) | `firebase` | `firebase` | Citizen mobile OTP authentication mode |
| `NEXT_PUBLIC_OTP_AUTH_MODE` | Client | `console` (or `firebase`) | `firebase` | `firebase` | Frontend OTP UI mode toggle |
| `UPSTASH_REDIS_REST_URL` | Server | Optional | Optional | Optional | Upstash Serverless Redis REST endpoint (Neon Postgres limiter used if omitted) |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Optional | Optional | Optional | Upstash Serverless Redis REST token (Neon Postgres limiter used if omitted) |
| `SENTRY_DSN` | Server | Optional (no-op if unset) | Optional | **Required** | Server-side Sentry error ingest |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Optional (no-op if unset) | Optional | **Required** | Client-side Sentry error ingest |
| `GEMINI_API_KEY` | Server | Dev API key | Staging API key | Production API key | Google Gemini Generative AI |
| `GEMINI_MODEL` | Server | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | Primary classification/parsing model |
| `GROQ_API_KEY` | Server | Optional failover | Optional failover | Staging/Prod failover | High-speed fallback AI provider |
| `GROQ_MODEL` | Server | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | Groq failover model |

---

## 2. Rate Limiting Architecture & Verification

Rate limiting is governed by `@/lib/rate-limit.ts`. IntelliCivic implements a tiered, resilient rate limiting strategy requiring zero external accounts by default:
1. **Upstash Redis (Optional)**: If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present, distributed sliding window limiting across Vercel Lambdas is handled by Upstash.
2. **Neon Postgres Atomic Limiter (Default for Production)**: If Upstash is not configured, production instances automatically use an atomic Postgres upsert limiter backed by the `rate_limit_buckets` table. Using single-statement `INSERT ... ON CONFLICT ("key") DO UPDATE` with tagged parameters, it operates safely across serverless Lambdas with zero race conditions.
3. **In-Memory Store (Local Dev & Testing)**: In non-production environments without Upstash, an in-memory sliding window store is used.

### Named Presets & OTP Specific Limits
- `auth`: **10 requests / 60s** (Strict: staff-login, dev-login, and general auth endpoints).
- `send-otp` (Phone): **3 requests / 10 minutes** per phone number (hashed with HMAC-SHA256; raw phone number is never stored as key).
- `send-otp` (IP): **10 requests / 10 minutes** per client IP.
- `verify-otp` (Phone): **5 verification attempts / 10 minutes** per phone number.
- `complaintCreate`: **10 requests / 60s** (Scoped per authenticated citizen ID).
- `ai`: **20 requests / 60s** (Voice parsing, AI diagnostics).
- `upload`: **20 requests / 60s** (Cloudinary signature generation, Evidence submission).
- `general`: **60 requests / 60s** (General API operations).

### Fail-Closed vs. Fail-Open Architecture
- **Auth Routes (`preset: 'auth'`, `send-otp`, `verify-otp`)**: If the rate limiter backend (Postgres or Upstash) experiences an internal error, auth routes **FAIL CLOSED (HTTP 503 Service Unavailable with `Retry-After: 60`)**. This strictly preserves security boundaries against brute force.
- **Non-Auth Routes**: Non-auth endpoints **FAIL OPEN** with logged critical warnings and Sentry error monitoring (`reportRateLimitFailOpen`), preventing citizen grievance workflows from being blocked during transient database hiccups.

### Verification Steps
```bash
# Verify Auth Rate Limiting (Sends requests to OTP endpoint; triggers 429 when threshold exceeded)
for i in {1..4}; do
  curl -i -X POST http://localhost:3000/api/auth/send-otp \
    -H "Content-Type: application/json" \
    -d '{"mobileNumber":"9876543210"}'
done
```
Expect HTTP `429 Too Many Requests` with response headers:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json

{
  "statusCode": 429,
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

---

## 3. Sentry Error Monitoring & PII Scrubbing

### Configuration
Sentry is initialized across Client, Server, and Edge runtimes via:
- `sentry.client.config.ts`
- `sentry.server.config.ts`
- `sentry.edge.config.ts`
- Wrapped in `next.config.js` via `withSentryConfig`.

### Zero-PII Policy
In `src/lib/sentry-scrubber.ts`, all events passed to `beforeSend`:
- Scrub all request `Cookie`, `Authorization`, and `x-api-key` headers.
- Wipe `request.data` (payload bodies completely scrubbed).
- Remove `user.email`, `user.ip_address`, and `user.username`.
- Regex scrub email addresses and Indian 10-digit mobile numbers from breadcrumbs, messages, and exception stack traces.

### AI Telemetry
Whenever Gemini encounters an HTTP error (400, 403, 404, 429) and fails over to Groq or heuristic fallback, `reportGeminiFallback` sends a tagged operational event to Sentry with zero PII:
`tag: { service: 'ai-provider', primaryProvider: 'gemini', failoverTarget: 'groq'|'heuristic', httpStatus: '...' }`.

### Verification Steps
In non-production environments:
```bash
curl -X POST http://localhost:3000/api/admin/sentry-test
```
Returns:
```json
{
  "success": true,
  "sentryConfigured": true,
  "message": "Sentry test events successfully dispatched."
}
```
*(In production, this route returns 404 Not Found to prevent endpoint abuse).*

---

## 4. CI/CD Pipeline

The GitHub Actions workflow `.github/workflows/ci.yml` triggers on `push` and `pull_request` to `main`:
1. **Gitleaks**: Scans commit history for leaked API keys, tokens, or private credentials.
2. **Dependencies (`npm ci`)**: Clean install against committed `package-lock.json`.
3. **Prisma Generate**: Generates typed Prisma Client.
4. **Lint (`npm run lint`)**: Runs Next.js ESLint rules.
5. **Typecheck (`npm run typecheck`)**: Executes `tsc --noEmit`.
6. **Build (`npm run build`)**: Produces Next.js production build artifacts.
7. **Audit (`npm audit --audit-level=high`)**: Reports high and critical dependency vulnerabilities.
8. **E2E Regression Job**: Runs Playwright regression suite **ONLY** if GitHub Repository Secrets `TEST_DATABASE_URL` and `TEST_DATABASE_HOST` are explicitly provided. If missing, the job skips cleanly to prevent CI touching any unknown or production database.

---

## 5. Deployment & Rollback Runbook

### Deployment Procedure
The deployment pipeline must execute steps in this exact order:

1. **Deploy Database Migration**:
   Run Prisma migration deploy using the direct database connection:
   ```bash
   npx prisma migrate deploy
   ```
   *Note: This applies the `20261014170000_add_rate_limit_bucket` migration creating the `rate_limit_buckets` table for Postgres rate limiting.*

2. **Configure Required Environment Variables**:
   Ensure the following variable is configured on the deployment platform (e.g., Vercel Project Settings):
   - `RATE_LIMIT_HMAC_SECRET`: High-entropy 32+ character random secret used for HMAC-SHA256 phone hashing.
   Confirm other production secrets are present:
   - `DATABASE_URL` & `DIRECT_URL`
   - `JWT_SECRET`
   - `SENTRY_DSN` & `NEXT_PUBLIC_SENTRY_DSN`
   - `GEMINI_API_KEY` (and optional `GROQ_API_KEY`)
   *(Note: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are completely optional).*

3. **Deploy Application Artifact**:
   Deploy the Next.js application build via Vercel Git integration (`git push origin main`) or CLI:
   ```bash
   vercel --prod
   ```

4. **Post-Deployment Smoke Test**:
   Execute endpoint verification on `send-otp` and health checks:
   ```bash
   curl -i -X POST https://your-production-domain.vercel.app/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"mobileNumber":"9876543210"}'
   ```

### Rollback Procedure
If a production defect or operational incident occurs:

1. **Vercel Instant Rollback**:
   - Navigate to **Vercel Dashboard** → **Deployments**.
   - Locate the previous known good deployment.
   - Click `...` → **Instant Rollback**. Traffic reverts in < 2 seconds.

2. **Git Rollback**:
   ```bash
   git revert HEAD -m 1
   git push origin main
   ```

3. **Database Rollback Note**:
   - The `rate_limit_buckets` table is completely additive and non-breaking for existing user/complaint data.
   - If rolling back application code to a prior commit, the table can remain in the database without side effects.
   - If manual removal is explicitly required:
     ```sql
     DROP TABLE IF EXISTS "rate_limit_buckets";
     ```
