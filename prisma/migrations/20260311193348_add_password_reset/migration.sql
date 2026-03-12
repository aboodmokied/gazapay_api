-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordResetCode" TEXT NOT NULL,
    "passwordResetExpires" TIMESTAMP(3) NOT NULL,
    "passwordResetVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordReset_phone_idx" ON "PasswordReset"("phone");
