-- Staff Portal Preferred Language Column (un-applied until operator confirms DB gate)
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'en';

