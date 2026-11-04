CREATE TABLE IF NOT EXISTS "OraculoNotification" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "url" TEXT NOT NULL DEFAULT '',
  "mediaUrl" TEXT NOT NULL DEFAULT '',
  "popup" BOOLEAN NOT NULL DEFAULT true,
  "silent" BOOLEAN NOT NULL DEFAULT false,
  "kind" TEXT NOT NULL DEFAULT 'marketing',
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OraculoNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OraculoNotification_slug_key" ON "OraculoNotification"("slug");
CREATE INDEX IF NOT EXISTS "OraculoNotification_enabled_expiresAt_idx" ON "OraculoNotification"("enabled", "expiresAt");

CREATE TABLE IF NOT EXISTS "OraculoAd" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "imageUrl" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OraculoAd_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OraculoAd_slug_key" ON "OraculoAd"("slug");
CREATE INDEX IF NOT EXISTS "OraculoAd_enabled_expiresAt_sortOrder_idx" ON "OraculoAd"("enabled", "expiresAt", "sortOrder");
