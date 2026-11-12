-- Un-applied migration for Material & Cost Tracking per Complaint
-- Do NOT apply directly without reviewing against target database environment.

CREATE TABLE "complaint_material_entries" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "unitCostPaise" INTEGER NOT NULL,
    "recordedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "complaint_material_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "complaint_material_entries_complaintId_idx" ON "complaint_material_entries"("complaintId");
CREATE INDEX "complaint_material_entries_createdAt_idx" ON "complaint_material_entries"("createdAt");

ALTER TABLE "complaint_material_entries"
    ADD CONSTRAINT "complaint_material_entries_complaintId_fkey"
    FOREIGN KEY ("complaintId") REFERENCES "complaints"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "complaint_material_entries"
    ADD CONSTRAINT "complaint_material_entries_recordedByUserId_fkey"
    FOREIGN KEY ("recordedByUserId") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

