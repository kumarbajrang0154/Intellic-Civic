-- Department Performance Report date-range composite index (un-applied until operator confirms DB gate)
CREATE INDEX IF NOT EXISTS "complaints_createdAt_departmentId_idx" ON "complaints"("createdAt", "departmentId");

