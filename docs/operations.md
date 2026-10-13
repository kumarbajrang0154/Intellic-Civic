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
| `OTP_AUTH_MODE` | Server | `console` (or `firebase`) | `firebase` | `firebase` | Citizen mobile OTP authentication mode |
| `NEXT_PUBLIC_OTP_AUTH_MODE` | Client | `console` (or `firebase`) | `firebase` | `firebase` | Frontend OTP UI mode toggle |
| `UPSTASH_REDIS_REST_URL` | Server | Optional (falls back to memory) | Required | **Required** | Upstash Serverless Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Server | Optional (falls back to memory) | Required | **Required** | Upstash Serverless Redis REST token |
| `SENTRY_DSN` | Server | Optional (no-op if unset) | Optional | **Required** | Server-side Sentry error ingest |
| `NEXT_PUBLIC_SENTRY_DSN` | Client | Optional (no-op if unset) | Optional | **Required** | Client-side Sentry error ingest |
| `GEMINI_API_KEY` | Server | Dev API key | Staging API key | Production API key | Google Gemini Generative AI |
| `GEMINI_MODEL` | Server | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | `gemini-3.1-flash-lite` | Primary classification/parsing model |
| `GROQ_API_KEY` | Server | Optional failover | Optional failover | Staging/Prod failover | High-speed fallback AI provider |
| `GROQ_MODEL` | Server | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | `qwen/qwen3.8-27b` | Groq failover model |

---

## 2. Rate Limiting Architecture & Verification

Rate limiting is governed by `@/lib/rate-limit.ts` using Upstash Serverless Redis across all Vercel Lambdas.

### Named Presets
- `auth`: **5 requests / 60s** (Strict: OTP send, OTP verify, Staff login, Dev login).
- `complaintCreate`: **10 requests / 60s** (Scoped per authenticated citizen ID).
- `ai`: **20 requests / 60s** (Voice parsing, AI diagnostics).
- `upload`: **20 requests / 60s** (Cloudinary signature generation, Evidence submission).
- `general`: **60 requests / 60s** (General API operations).

### Fail-Closed vs. Fail-Open Architecture
1. **Local Development / Test (`NODE_ENV !== 'production'`)**:
   - If Upstash credentials are missing, automatically falls back to an in-memory sliding window limiter with a console warning.
2. **Production (`NODE_ENV === 'production'`)**:
   - **Auth / OTP routes (`preset: 'auth'`) MUST FAIL CLOSED (HTTP 503 Service Unavailable)** if Redis is unconfigured or unreachable. This prevents brute-force attacks and credential stuffing when the security boundary cannot be guaranteed.
   - **Non-auth routes (`preset: 'general', 'ai', 'upload', 'complaintCreate'`) FAIL OPEN** with logged critical warnings and Sentry incident tags, ensuring user civics workflows are not dropped during infrastructure hiccups.

### Verification Steps
```bash
# Verify Auth Rate Limiting (Sends 6 requests to OTP endpoint; 6th triggers 429)
for i in {1..6}; do
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

### Deploying to Vercel
1. Ensure the following environment variables are configured in the Vercel Project Settings:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `JWT_SECRET`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `SENTRY_DSN`
   - `NEXT_PUBLIC_SENTRY_DSN`
   - `GEMINI_API_KEY`
   - `GROQ_API_KEY`
2. Trigger deployment:
   ```bash
   git push origin main
   ```
   Or deploy via Vercel CLI:
   ```bash
   vercel --prod
   ```

### Instant Rollback Procedure
If a production issue or regression occurs:
1. **Vercel Instant Rollback**:
   - Go to **Vercel Dashboard** → Project **Deployments**.
   - Locate the last known good deployment.
   - Click the three dots `...` → **Instant Rollback**.
   - Traffic instantly switches to the previous immutable deployment artifact within < 2 seconds.
2. **Git Rollback**:
   ```bash
   git revert HEAD -m 1
   git push origin main
   ```
3. **Database Integrity**:
   - Phase 0 changes introduced **zero schema changes** (`prisma/schema.prisma` was untouched). Database rollbacks are not required.
