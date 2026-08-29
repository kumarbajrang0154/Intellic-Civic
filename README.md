# IntelliCivic Platform

AI-Driven Civic Complaint Management and Decision Support Platform.

## Environment Variables Setup

> **Note:** All environment variables live in one root-level `.env` file — copy `.env.example` to `.env` at the repo root.

```bash
cp .env.example .env
```

Do not create per-app `.env` files in `apps/api` or `apps/web`. Both NestJS (`apps/api`), Next.js (`apps/web`), and Python AI Service (`apps/ai-service`) automatically read from `/.env` at the monorepo root.

## Development Commands

```bash
# Start Next.js frontend (http://localhost:3000)
npm run dev:web

# Start NestJS backend API (http://localhost:4000)
npm run dev:api
```
