-- Many-to-many RFI responders; mirrors legacy assignedToUserId as first link.

CREATE TABLE "RfiAssigneeLink" (
    "id" TEXT NOT NULL,
    "rfiId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfiAssigneeLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RfiAssigneeLink_rfiId_userId_key" ON "RfiAssigneeLink"("rfiId", "userId");
CREATE INDEX "RfiAssigneeLink_rfiId_idx" ON "RfiAssigneeLink"("rfiId");
CREATE INDEX "RfiAssigneeLink_userId_idx" ON "RfiAssigneeLink"("userId");

ALTER TABLE "RfiAssigneeLink" ADD CONSTRAINT "RfiAssigneeLink_rfiId_fkey" FOREIGN KEY ("rfiId") REFERENCES "Rfi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RfiAssigneeLink" ADD CONSTRAINT "RfiAssigneeLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "RfiAssigneeLink" ("id", "rfiId", "userId", "createdAt")
SELECT gen_random_uuid()::text, r."id", r."assignedToUserId", CURRENT_TIMESTAMP
FROM "Rfi" r
WHERE r."assignedToUserId" IS NOT NULL;
