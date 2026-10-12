# IntelliCivic — Production Architecture & Defense-in-Depth Security

## 1. Executive Architecture Overview

IntelliCivic is an AI-powered municipal complaint management, automated triage, and field operations platform built on modern web and cloud architecture:

```
[ Citizen / Staff Browser / PWA ]
              │ (HTTPS + TLS 1.3)
              ▼
    [ Next.js 14 App Router ]
    ├── Middleware (Path gating & fast-path redirects)
    ├── Route Handlers (/api/* with server-side RBAC & Input Validation)
    └── Server Components & React UI (Accessible WCAG 2.2 AA compliant)
              │
       ┌──────┴──────┐
       ▼             ▼
[ Neon PostgreSQL ] [ AI Engine ]
(Connection Pooler) (Gemini Flash Lite -> Failover: Groq Qwen)
```

---

## 2. Authentication & Authorization Architecture

### 2.1 Multi-Tier Role-Based Access Control (RBAC)
The platform strictly enforces 6 distinct user roles across server-side boundaries:
1. **CITIZEN**: Can report issues, track their tickets, reopen rejected tickets once, and update their profile. Scoped strictly to their own complaint data (`citizenId === auth.user.id`).
2. **FIELD_WORKER**: Field-level operatives. Scoped strictly to assigned complaints (`assignedFieldWorkerId === auth.user.id`). Can update workflow stages (`start`, `evidence` BEFORE/DURING/AFTER, `submit-for-review`).
3. **DEPARTMENT_OFFICER**: Middle-tier municipal officers managing complaint assignment and verification within their assigned department (`departmentId`).
4. **DEPARTMENT_HEAD**: Department leadership overseeing municipality-wide complaints and cross-department collaboration.
5. **ADMIN**: Municipal corporation administrators managing staff accounts, department settings, and complaint triage.
6. **SUPER_ADMIN**: Platform administrators with root administrative privileges, platform-wide configuration, and emergency governance authority.

### 2.2 Cryptographic Session Tokens (HMAC-SHA256)
- **Token Format**: Standard JSON Web Tokens (JWT) signed using HMAC-SHA256 with server-side `JWT_SECRET_KEY` via the `jose` library.
- **Cryptographic Verification**: Every protected server endpoint invokes `verifyJwtToken()` which validates token integrity and rejects forged, tampered, or expired tokens.
- **Cookie Security**:
  - `ic_access_token`: Stored in `HttpOnly`, `Secure` (production), `SameSite=Lax` cookies with a 7-day expiration.
  - `ic_refresh_token`: Stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies with a 30-day expiration, protected by token type validation and revocation.

### 2.3 Timing-Attack Resistance & Credential Protection
- Staff password verification uses `bcryptjs` with salt rounds >= 10.
- When an email address is not found in the database, the server runs a simulated `bcrypt.compare` against a precomputed constant hash (`DUMMY_BCRYPT_HASH`) to prevent response-time side-channel user enumeration attacks.
- Account lockout policy: Accounts are locked for 15 minutes upon 5 consecutive failed login attempts, tracked atomically in `failedLoginCount` and `lockedUntil`.
- Per-IP rate limiting: An in-memory sliding window limits login attempts to 30 requests/minute per client IP.

### 2.4 OAuth 2.0 State Verification (CSRF Protection)
- Google OAuth flow generates a cryptographically random UUID `state` parameter stored in an `HttpOnly`, `SameSite=Lax` cookie (`oauth_state`) for 10 minutes.
- The callback route verifies `state === cookieState`, preventing OAuth login CSRF attacks.

---

## 3. Defense-in-Depth Security Controls

### 3.1 HTTP Security Headers
Configured across all responses in `next.config.js`:
- `X-Frame-Options: SAMEORIGIN`: Eliminates external clickjacking attempts.
- `X-Content-Type-Options: nosniff`: Prevents MIME-type sniffing exploits.
- `Referrer-Policy: strict-origin-when-cross-origin`: Restricts sensitive URI referrer leakage.
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`: Mandates HTTPS across all subdomains.
- `Permissions-Policy: camera=(self), microphone=(self), geolocation=(self)`: Restricts browser device hardware access to first-party origins.

### 3.2 Error Response Sanitization
- API routes sanitize internal exceptions in production.
- Stack traces, database connection strings, table structures, and internal paths are never exposed in JSON responses (`process.env.NODE_ENV !== 'production' ? error.message : undefined`).

### 3.3 Safe Secrets Management
- All secrets reside in root `.env` (ignored by `.gitignore`).
- Public variables are explicitly prefixed with `NEXT_PUBLIC_`.
- Server-side credentials (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_SECRET`, `FIREBASE_PRIVATE_KEY`, `CLOUDINARY_API_SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`) are never bundled into client-side JS bundles.

---

## 4. Operational Runbooks & Logging

### 4.1 Audit Logging
- Privileged staff operations (user creation, role assignment, deactivation, permanent deletion, status changes) are written to the database `AuditLog` table with timestamp, actor info, entity ID, and metadata snapshots.
- Passwords, hashes, and session tokens are strictly excluded from audit payloads.

### 4.2 Security Incident Checklist
1. **Secret Rotation**:
   - Immediately update `JWT_SECRET` in environment variables to invalidate all active sessions.
   - Rotate Database credentials in Neon Console and update `DATABASE_URL` / `DIRECT_URL`.
   - Rotate AI API keys (`GEMINI_API_KEY`, `GROQ_API_KEY`).
2. **Account Lockout Recovery**:
   - Authorized admins can unlock staff accounts via `POST /api/admin/staff/[id]/unlock` which atomically resets `failedLoginCount: 0` and `lockedUntil: null`.
