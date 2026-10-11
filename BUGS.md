# IntelliCivic QA & Demo Readiness Bug Tracking

## Summary of Resolved Defects

### 1. Database Connection Reliability & Neon Cold-Start Handling
- **Issue**: Tests and server invocations failed intermittently with `Can't reach database server at ep-raspy-voice-aerpv8ej-pooler.c-2.us-east-2.aws.neon.tech:5432` and `ConnectionReset (10054)`.
- **Root Cause**: Neon PostgreSQL database compute nodes auto-suspend when idle. Prisma's default connection timeout is 5.0 seconds, which expires before Neon finishes waking up (~6-8s). Moreover, Playwright workers run in separate child processes where `.env` was not preloaded at the runner config level.
- **Resolution**:
  - Configured `connect_timeout=25&pool_timeout=25` on Prisma datasource URL in `src/lib/prisma.ts`.
  - Added connection warmup retry loop in `e2e/global-setup.ts` and `scripts/seed-demo.js`.
  - Added `dotenv.config()` and 60-second test timeouts in `playwright.config.ts`.

### 2. Staff Lifecycle & Deletion Preflight Phrasing
- **Issue**: `e2e/staff-user-lifecycle.spec.ts` test 2 failed expecting substring `'open assigned complaint'` in blocker message.
- **Root Cause**: `getDeletePreflight` in `src/lib/staff-dept-store.ts` phrased the blocker message as `User has X open complaint(s) assigned. Reassign them first.`.
- **Resolution**: Updated phrasing to `User has ${openAssignedComplaints} open assigned complaint(s). Reassign them first.` in `src/lib/staff-dept-store.ts`.

### 3. Demo Role Compatibility User Seeding
- **Issue**: `e2e/staff-user-lifecycle.spec.ts` test 1 expected a pre-existing citizen with email `23cs025@kpriet.ac.in` to trigger HTTP 409 Conflict with structured conflict metadata.
- **Root Cause**: `scripts/seed-demo.js` did not include `23cs025@kpriet.ac.in` among the test compatibility seeds, resulting in 201 Created on fresh databases instead of 409 Conflict.
- **Resolution**: Added `23cs025@kpriet.ac.in` to the idempotent compatibility seed block in `scripts/seed-demo.js`.

### 4. Offline Submission & Canvas Compression Resiliency
- **Issue**: In `e2e/citizen-offline-submission.spec.ts`, test 1 hung on offline submission without transitioning to the "Saved Offline" card.
- **Root Cause**: For small or uncompressed data URLs (e.g. 63-byte test buffer), `compressPhoto` passed them to HTML5 Canvas in headless Chromium where `canvas.toBlob` could hang without firing callbacks. In addition, `openDatabase()` in `src/lib/offline-queue.ts` had no timeout guard against blocked IndexedDB upgrades.
- **Resolution**:
  - In `src/lib/offline-queue.ts`, bypass canvas compression completely if `blobOrFile.size <= maxBytes` (1MB).
  - Added safety timeout fallback to `canvas.toBlob` and `openDatabase()`.
  - Added `closeDatabase()` helper and exposed it on `window.__offlineQueue`.

### 5. Mobile Layout Heading Visibility
- **Issue**: In `e2e/citizen-offline-submission.spec.ts`, mobile 375px test failed waiting for visible `h1` element (`File a New Complaint`).
- **Root Cause**: In `src/app/citizen/complaints/new/page.tsx`, the `<h1>` element had `hidden md:block` classes, rendering it invisible on mobile viewports.
- **Resolution**: Replaced `hidden md:block` with responsive typography `text-xl sm:text-2xl` so the heading is visible on both mobile and desktop screens.

### 6. Admin Staff Permanent Deletion & Atomic Impact Resolution
- **Issue**: Admins needed the ability to permanently delete staff members with full clarity of blockers, alternatives (reassign, deactivate, archive), and safe cascading data handling without schema drops.
- **Root Cause**: Staff deletion was previously blocked or failed due to active foreign key references (assigned complaints, field worker hierarchy, evidence authorship, audit log foreign keys, notifications).
- **Resolution**:
  - Built comprehensive impact preflight in `src/lib/staff-dept-store.ts` calculating active complaints, worker subordinates, evidence, audit logs, and safeguards (self, super admin, last admin, other municipality).
  - Implemented `permanentlyDeleteUser` using a single atomic `prisma.$transaction`: reassigns or unassigns open complaints, detaches worker subordinates, preserves evidence rows with author name snapshots, snapshots audit log actor info into metadata, and creates a clean `STAFF_PERMANENTLY_DELETED` audit log without leaking sensitive hashes.
  - Implemented 3-step modal on Admin Staff UI (`src/app/admin/staff/page.tsx`) with impact assessment, alternatives, and explicit confirmation typing.
  - In `e2e/staff-permanent-delete.spec.ts`, split Desktop (1280px) and Mobile (375px) tests into dedicated blocks with 90s timeouts to ensure resilient end-to-end execution.

### 7. Super Admin Protection Hierarchy & Root Admin RBAC Resolution
- **Issue**: Non-root Super Admins were able to deactivate or soft-delete other Super Admins in certain code paths, while Root Admin was blocked from permanently deleting other Super Admins as required by governance specifications.
- **Root Cause**: `assertCanManageStaff` evaluated generic Super Admin protection rules before evaluating Root Admin privileges, and did not distinguish between permanent deletion (which Root Admin is allowed to perform on peer Super Admins) versus deactivation and soft deletion (which are permanently prohibited for all Super Admins, including by Root Admin).
- **Resolution**:
  - Restructured `assertCanManageStaff` in `src/lib/staff-dept-store.ts`:
    - Strict protection block: `action === 'deactivate' || action === 'delete' || action === 'archive'` against `SUPER_ADMIN` targets is rejected with 403 for everyone.
    - Root Admin check: grants Root Admin authority to manage all other accounts, including permanent deletion of other Super Admins.
    - Peer protection block: blocks non-root administrators from permanently deleting other Super Admin targets with 403.
  - Verified across both `e2e/staff-permanent-delete.spec.ts` (all 12 tests passing) and `e2e/sweep/admin-rbac-edge-outcome.spec.ts` (all 10 tests passing).

### 8. Prisma Interactive Transaction Query Optimization over Remote Neon Pooler
- **Issue**: `permanentlyDeleteUser` previously executed 13+ sequential queries across Prisma's interactive transaction connection, resulting in 10-14s latency per deletion over remote Neon poolers and causing assertion timeouts in UI tests (such as test 8a in `staff-permanent-delete.spec.ts`).
- **Root Cause**: Redundant queries were executed explicitly inside the interactive transaction for foreign keys that are already natively handled by PostgreSQL schema constraints (`ON DELETE CASCADE` for `notifications` and `refresh_tokens`, and `ON DELETE SET NULL` for `status_histories`).
- **Resolution**:
  - Pruned redundant queries in `src/lib/staff-dept-store.ts` (`permanentlyDeleteUser`), letting Postgres handle foreign key cascading automatically at zero roundtrip overhead.
  - Pipelined independent updates (`evidence`, `assignedOfficerId`, `assignments`) concurrently within `Promise.all`.
  - Added authorization flags (`isAuthorized`, `isSuspended`, `deletedAt`) directly into `AdminPayload` in `src/lib/admin-auth.ts`, eliminating secondary `prisma.user.findUnique` lookups on every admin request.
  - Total transaction time dropped from ~12s to ~1.2s, with all 12 tests in `staff-permanent-delete.spec.ts` completing in 3.3 minutes down from over 8.3 minutes.

### 9. Citizen V2 Triage & Duplicate Demonstration Seeds
- **Issue**: Citizen V2 screenshot captures and regression sweeps required pre-existing complaints in `REJECTED` and duplicate candidates with official resolution notes to test resolution note rendering, reopen buttons, and duplicate detection cards.
- **Root Cause**: Fresh or test databases lacked seeded complaints matching exact duplicate text and rejected resolution notes with original category tracking.
- **Resolution**:
  - Seeded `cmp-rejected-demo` in `scripts/seed-demo.js` with `status: 'REJECTED'`, `resolutionNotes`, `originalCategoryId`, and category override tracking.
  - Seeded `cmp-pothole-dup-target` with exact duplicate title and description for test 2 duplicate check.
  - Seeded un-suspended active state for `superadmin.test@smartcity.gov.in`.


