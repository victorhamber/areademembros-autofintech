CREATE TABLE IF NOT EXISTS "OraculoSupportVisit" (
  "ip" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OraculoSupportVisit_pkey" PRIMARY KEY ("ip")
);

CREATE TABLE IF NOT EXISTS "OraculoSupportCursor" (
  "id" INTEGER NOT NULL,
  "nextSide" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OraculoSupportCursor_pkey" PRIMARY KEY ("id")
);

INSERT INTO "OraculoSupportCursor" ("id", "nextSide") VALUES (1, 0)
ON CONFLICT ("id") DO NOTHING;
