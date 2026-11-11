-- Public Transparency Dashboard composite indexes (un-applied until operator confirms DB gate)
CREATE INDEX IF NOT EXISTS "complaints_departmentId_status_idx" ON "complaints"("departmentId", "status");
CREATE INDEX IF NOT EXISTS "complaints_municipalityId_status_idx" ON "complaints"("municipalityId", "status");

