/*
  Warnings:

  - You are about to drop the `PrivateKey` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `aesKey` to the `Device` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "PrivateKey" DROP CONSTRAINT "PrivateKey_userId_fkey";

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "aesKey" TEXT NOT NULL;

-- DropTable
DROP TABLE "PrivateKey";
