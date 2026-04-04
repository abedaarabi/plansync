-- CreateEnum
CREATE TYPE "CloudStorageProvider" AS ENUM ('GOOGLE_DRIVE', 'ONEDRIVE', 'DROPBOX');

-- CreateTable
CREATE TABLE "CloudStorageConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CloudStorageProvider" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "accountLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CloudStorageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CloudStorageConnection_userId_provider_key" ON "CloudStorageConnection"("userId", "provider");

-- CreateIndex
CREATE INDEX "CloudStorageConnection_userId_idx" ON "CloudStorageConnection"("userId");

-- AddForeignKey
ALTER TABLE "CloudStorageConnection" ADD CONSTRAINT "CloudStorageConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
