-- Un-applied migration for Feature 2.5: Admin TOTP 2FA & Recovery Codes

CREATE TABLE "admin_two_factor" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "secretEncrypted" TEXT,
    "pendingSecretEncrypted" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "recoveryHashes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_two_factor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admin_two_factor_userId_key" ON "admin_two_factor"("userId");

ALTER TABLE "admin_two_factor"
    ADD CONSTRAINT "admin_two_factor_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

