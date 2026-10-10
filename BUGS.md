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
