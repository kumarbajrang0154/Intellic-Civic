-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SLA_ESCALATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMPLAINT_REOPENED';

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN "escalatedAt" TIMESTAMP(3),
ADD COLUMN "voteCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "complaint_votes" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "citizenId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "recipientHash" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastError" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "complaints_escalatedAt_idx" ON "complaints"("escalatedAt");

-- CreateIndex
CREATE INDEX "complaint_votes_citizenId_idx" ON "complaint_votes"("citizenId");

-- CreateIndex
CREATE UNIQUE INDEX "complaint_votes_complaintId_citizenId_key" ON "complaint_votes"("complaintId", "citizenId");

-- CreateIndex
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries"("status");

-- CreateIndex
CREATE INDEX "email_deliveries_createdAt_idx" ON "email_deliveries"("createdAt");

-- AddForeignKey
ALTER TABLE "complaint_votes" ADD CONSTRAINT "complaint_votes_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "complaint_votes" ADD CONSTRAINT "complaint_votes_citizenId_fkey" FOREIGN KEY ("citizenId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

