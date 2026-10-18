# Security Risk Register & Vulnerability Acceptance

This document records formally accepted security risks, compensating controls, risk owners, and scheduled review milestones for dependencies and platform components.

---

## Accepted Risks Summary

| Risk ID | Package / Component | Severity | CVE / GHSA | Owner | Acceptance Rationale & Compensating Controls | Review Date |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | `next@14.2.35` / `postcss` | **Critical** / High | GHSA-f524-7w9q-w238, GHSA-c59h-r6p8-q9wc, GHSA-4342-x655-wp24, etc. | Principal Security Engineer | Next.js 14 App Router vulnerabilities (cache poisoning, image optimizer DoS, RSC deserialization) require major framework migration to Next.js 15/16 + React 19. **Compensating Controls**: Hosted on Vercel with edge-level WAF, cloud CDN header scrubbing, and serverless Lambda process isolation. Static assets are served via immutable Vercel edge cache. | 2026-11-15 |
| **SEC-02** | `tailwindcss@3.4.19` (`braces`, `micromatch`, `chokidar`) | **High** | GHSA-grv7-fg5c-xvhg | Frontend Lead | Stack-exhaustion denial of service in deeply nested glob patterns. **Compensating Controls**: Build-time development tooling only; `tailwindcss` compiler and `chokidar` file watcher are executed strictly at build time (`npm run build`) and are never present in production runtime bundles or exposed to untrusted input. Upgrading requires breaking migration to Tailwind v4. | 2026-11-15 |
| **SEC-03** | `firebase@12.18.0` (`@grpc/grpc-js`, `@firebase/firestore`) | **High** | GHSA-56pm-75q3-pxhx, GHSA-m425-mq94-257g | Auth & Integrations Lead | `@grpc/grpc-js` unauthorized certificate context handling and server method error leakage. **Compensating Controls**: Citizen authentication uses Firebase Web SDK for Phone SMS verification and Firebase Admin `verifyIdToken()`. Firestore is not exposed directly to untrusted client queries. Standing Rule 6 prohibits touching Firebase code in Phase 0. Upgrade to v9/v13 planned for Phase 1. | 2026-11-15 |
| **SEC-04** | `eslint-config-next@14.2.5` (`glob`, `@next/eslint-plugin-next`) | **High** | GHSA-52f2-56v5-cx7g | Staff Engineer | Command injection via `-c/--cmd` CLI argument in `glob`. **Compensating Controls**: DevDependency only; executed solely in non-interactive CI linting (`npm run lint`). No user-facing shell execution exists. | 2026-11-15 |

---

## Remediation Roadmap
- **Phase 1 (Framework Modernization)**: Upgrading Next.js to 15.x/16.x alongside React 19 will resolve SEC-01 and SEC-04.
- **Phase 1 (Styling Pipeline Upgrade)**: Migration to Tailwind CSS v4 will resolve SEC-02.
- **Phase 2 (Auth Overhaul)**: Evaluating updated Firebase / custom phone OTP gateway to eliminate `@grpc/grpc-js` dependency.
