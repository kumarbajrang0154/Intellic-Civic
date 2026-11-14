# Test Suite Inventory

Comprehensive classification of all 94 Playwright test suites in `e2e/` (67 files) and `tests/unit/` (27 files).

### Classification Criteria
- **Mode**:
  - `LIVE-DB`: Executes against live database / backend API routes without mocking, or performs direct Prisma queries.
  - `MOCKED`: Mocks network traffic / API requests using Playwright `page.route()`.
  - `IN-MEMORY`: Executes in-memory unit logic, pure helpers, service mocks, or in-memory state doubles without external DB or network.
- **Uses DB Deny-List Guard**:
  - `yes`: Protected by `assertNotProductionDatabase()` (via `e2e/global-setup.ts` in Playwright E2E configuration, or explicit guard assertion in unit tests).
  - `no`: Test executes in-memory or fully mocked without connecting to or mutating database state.

## End-to-End Test Suite (`e2e/` - 67 files)

| File | Mode | Uses DB Deny-List Guard |
| :--- | :--- | :--- |
| `e2e/admin-bulk-actions.spec.ts` | LIVE-DB | yes |
| `e2e/admin-staff.spec.ts` | LIVE-DB | yes |
| `e2e/ai-fallback-ui.spec.ts` | MOCKED | no |
| `e2e/ai-provider-failover.spec.ts` | LIVE-DB | yes |
| `e2e/ai-service-health.spec.ts` | LIVE-DB | yes |
| `e2e/audit-runner.spec.ts` | MOCKED | no |
| `e2e/auth-me-avatar.spec.ts` | LIVE-DB | yes |
| `e2e/auth-shell.spec.ts` | MOCKED | no |
| `e2e/capture-admin-screenshots.spec.ts` | MOCKED | no |
| `e2e/capture-citizen-mobile-fix.spec.ts` | MOCKED | no |
| `e2e/capture-citizen-v2-screenshots.spec.ts` | LIVE-DB | yes |
| `e2e/capture-dashboards-audit.spec.ts` | MOCKED | no |
| `e2e/capture-field-worker-screenshots.spec.ts` | LIVE-DB | yes |
| `e2e/capture-otp-screenshot.spec.ts` | LIVE-DB | yes |
| `e2e/capture-remaining-screenshots.spec.ts` | LIVE-DB | yes |
| `e2e/citizen-button-clickthrough.spec.ts` | MOCKED | no |
| `e2e/citizen-complaints-v2.spec.ts` | LIVE-DB | yes |
| `e2e/citizen-complaints.spec.ts` | MOCKED | no |
| `e2e/citizen-delete-restore.spec.ts` | LIVE-DB | yes |
| `e2e/citizen-mobile-layout.spec.ts` | MOCKED | no |
| `e2e/citizen-mobile-overflow.spec.ts` | MOCKED | no |
| `e2e/citizen-offline-submission.spec.ts` | LIVE-DB | yes |
| `e2e/citizen-session-suspension.spec.ts` | LIVE-DB | yes |
| `e2e/citizen-voice-parse-security.spec.ts` | LIVE-DB | yes |
| `e2e/citizen-voice.spec.ts` | MOCKED | no |
| `e2e/complaint-delete-c2.spec.ts` | LIVE-DB | yes |
| `e2e/complaint-language.spec.ts` | LIVE-DB | yes |
| `e2e/department-head.spec.ts` | MOCKED | no |
| `e2e/department-officer.spec.ts` | MOCKED | no |
| `e2e/dept-head-assignment.spec.ts` | LIVE-DB | yes |
| `e2e/dev-login-security.spec.ts` | LIVE-DB | yes |
| `e2e/field-worker-portal.spec.ts` | LIVE-DB | yes |
| `e2e/gemini-ai-classification.spec.ts` | IN-MEMORY | no |
| `e2e/gemini-image-classification.spec.ts` | IN-MEMORY | no |
| `e2e/global-error-and-gemini.spec.ts` | MOCKED | no |
| `e2e/issue-verification.spec.ts` | LIVE-DB | yes |
| `e2e/leftovers-evidence.spec.ts` | LIVE-DB | yes |
| `e2e/local-smoke/citizen.spec.ts` | MOCKED | no |
| `e2e/local-smoke/public.spec.ts` | LIVE-DB | yes |
| `e2e/local-smoke/staff.spec.ts` | LIVE-DB | yes |
| `e2e/mandatory-photo-evidence.spec.ts` | LIVE-DB | yes |
| `e2e/mobile-overflow-audit.spec.ts` | LIVE-DB | yes |
| `e2e/notifications-lifecycle.spec.ts` | LIVE-DB | yes |
| `e2e/offline-sync-real-flow.spec.ts` | MOCKED | no |
| `e2e/otp-console-flow.spec.ts` | LIVE-DB | yes |
| `e2e/photo-upload-resilience.spec.ts` | LIVE-DB | yes |
| `e2e/platform-settings.spec.ts` | LIVE-DB | yes |
| `e2e/profile-completion-block.spec.ts` | LIVE-DB | yes |
| `e2e/pwa-manifest-sw.spec.ts` | LIVE-DB | yes |
| `e2e/rate-limit.spec.ts` | LIVE-DB | yes |
| `e2e/real-mobile-overflow.spec.ts` | LIVE-DB | yes |
| `e2e/root-redirect.spec.ts` | LIVE-DB | yes |
| `e2e/scrubber-verification.spec.ts` | IN-MEMORY | no |
| `e2e/sentry-test-guard.spec.ts` | LIVE-DB | yes |
| `e2e/staff-credentials-auth.spec.ts` | LIVE-DB | yes |
| `e2e/staff-permanent-delete.spec.ts` | LIVE-DB | yes |
| `e2e/staff-user-lifecycle.spec.ts` | LIVE-DB | yes |
| `e2e/super-admin.spec.ts` | MOCKED | no |
| `e2e/sweep/admin-rbac-edge-outcome.spec.ts` | LIVE-DB | yes |
| `e2e/sweep/api-sweep.spec.ts` | LIVE-DB | yes |
| `e2e/sweep/citizen-outcome.spec.ts` | LIVE-DB | yes |
| `e2e/sweep/staff-officer-fw-outcome.spec.ts` | LIVE-DB | yes |
| `e2e/task5-citizen-mobile-clickthrough.spec.ts` | MOCKED | no |
| `e2e/task6-offline-submission.spec.ts` | MOCKED | no |
| `e2e/touch-targets.spec.ts` | MOCKED | no |
| `e2e/ui-staff-dialogs.spec.ts` | LIVE-DB | yes |
| `e2e/voice-dictation-error.spec.ts` | LIVE-DB | yes |

## Unit Test Suite (`tests/unit/` - 27 files)

| File | Mode | Uses DB Deny-List Guard |
| :--- | :--- | :--- |
| `tests/unit/ai-enhancements.spec.ts` | IN-MEMORY | no |
| `tests/unit/citizen-chatbot.spec.ts` | IN-MEMORY | no |
| `tests/unit/complaint-language.spec.ts` | IN-MEMORY | no |
| `tests/unit/complaint-loop.spec.ts` | IN-MEMORY | no |
| `tests/unit/db-guard.spec.ts` | IN-MEMORY | yes |
| `tests/unit/demo-otp.spec.ts` | IN-MEMORY | no |
| `tests/unit/department-report-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/dev-login.spec.ts` | IN-MEMORY | no |
| `tests/unit/duplicate-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/email-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/gis-heatmap.spec.ts` | IN-MEMORY | no |
| `tests/unit/live-status-map.spec.ts` | IN-MEMORY | no |
| `tests/unit/material-cost-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/offline-submission.spec.ts` | IN-MEMORY | no |
| `tests/unit/operations-and-platform.spec.ts` | IN-MEMORY | no |
| `tests/unit/scheduled-report-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/send-otp-security.spec.ts` | IN-MEMORY | no |
| `tests/unit/sla-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/smart-assignment-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/sms-otp.spec.ts` | IN-MEMORY | no |
| `tests/unit/task7-admin-staff.spec.ts` | IN-MEMORY | no |
| `tests/unit/task8-phase1-browser.spec.ts` | MOCKED | no |
| `tests/unit/task8-phase1-verification.spec.ts` | IN-MEMORY | no |
| `tests/unit/test-routing.spec.ts` | IN-MEMORY | no |
| `tests/unit/totp-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/transparency-service.spec.ts` | IN-MEMORY | no |
| `tests/unit/voice-transcript.spec.ts` | IN-MEMORY | no |
