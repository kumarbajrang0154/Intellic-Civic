-- CreateTable: push_subscriptions
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");
CREATE INDEX IF NOT EXISTS "push_subscriptions_userId_isActive_idx" ON "push_subscriptions"("userId", "isActive");

-- CreateTable: notification_delivery_logs
CREATE TABLE IF NOT EXISTS "notification_delivery_logs" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT,
    "recipientHash" TEXT NOT NULL,
    "channel" VARCHAR(30) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "providerRef" VARCHAR(120),
    "lastError" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "notification_delivery_logs_complaintId_idx" ON "notification_delivery_logs"("complaintId");
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_channel_status_idx" ON "notification_delivery_logs"("channel", "status");
CREATE INDEX IF NOT EXISTS "notification_delivery_logs_createdAt_idx" ON "notification_delivery_logs"("createdAt");

-- CreateTable: contractors
CREATE TABLE IF NOT EXISTS "contractors" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "companyName" VARCHAR(160) NOT NULL,
    "registrationCode" VARCHAR(60) NOT NULL,
    "specialty" VARCHAR(120) NOT NULL,
    "contactEmail" VARCHAR(160),
    "municipalityId" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "contractors_registrationCode_key" ON "contractors"("registrationCode");
CREATE INDEX IF NOT EXISTS "contractors_municipalityId_isActive_idx" ON "contractors"("municipalityId", "isActive");
CREATE INDEX IF NOT EXISTS "contractors_departmentId_idx" ON "contractors"("departmentId");

-- CreateTable: contractor_work_orders
CREATE TABLE IF NOT EXISTS "contractor_work_orders" (
    "id" TEXT NOT NULL,
    "contractorId" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "assignedByUserId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_work_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "contractor_work_orders_contractorId_status_idx" ON "contractor_work_orders"("contractorId", "status");
CREATE INDEX IF NOT EXISTS "contractor_work_orders_complaintId_idx" ON "contractor_work_orders"("complaintId");

-- CreateTable: ai_processing_jobs
CREATE TABLE IF NOT EXISTS "ai_processing_jobs" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "jobType" VARCHAR(40) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "lastError" VARCHAR(255),
    "payload" JSONB,
    "result" JSONB,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_processing_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_processing_jobs_status_scheduledAt_idx" ON "ai_processing_jobs"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "ai_processing_jobs_complaintId_idx" ON "ai_processing_jobs"("complaintId");

-- ForeignKeys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'push_subscriptions_userId_fkey') THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractors_municipalityId_fkey') THEN
    ALTER TABLE "contractors" ADD CONSTRAINT "contractors_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "municipalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractors_departmentId_fkey') THEN
    ALTER TABLE "contractors" ADD CONSTRAINT "contractors_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractor_work_orders_contractorId_fkey') THEN
    ALTER TABLE "contractor_work_orders" ADD CONSTRAINT "contractor_work_orders_contractorId_fkey" FOREIGN KEY ("contractorId") REFERENCES "contractors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractor_work_orders_complaintId_fkey') THEN
    ALTER TABLE "contractor_work_orders" ADD CONSTRAINT "contractor_work_orders_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractor_work_orders_assignedByUserId_fkey') THEN
    ALTER TABLE "contractor_work_orders" ADD CONSTRAINT "contractor_work_orders_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_processing_jobs_complaintId_fkey') THEN
    ALTER TABLE "ai_processing_jobs" ADD CONSTRAINT "ai_processing_jobs_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

