/*
  Warnings:

  - A unique constraint covering the columns `[nonce,deviceId]` on the table `UsedNonce` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "UsedNonce_nonce_key";

-- CreateIndex
CREATE UNIQUE INDEX "UsedNonce_nonce_deviceId_key" ON "UsedNonce"("nonce", "deviceId");
