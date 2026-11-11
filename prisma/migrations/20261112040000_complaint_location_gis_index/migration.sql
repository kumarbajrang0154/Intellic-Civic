-- GIS Heatmap spatial coordinate index (un-applied until operator confirms DB gate)
CREATE INDEX IF NOT EXISTS "complaint_locations_latitude_longitude_idx" ON "complaint_locations"("latitude", "longitude");

