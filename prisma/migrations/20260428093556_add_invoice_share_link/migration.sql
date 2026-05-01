/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `ClientInvoice` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `ClientInvoice` ADD COLUMN `shareEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `shareExpiresAt` DATETIME(3) NULL,
    ADD COLUMN `shareToken` VARCHAR(191) NULL,
    ADD COLUMN `sharedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `ClientInvoice_shareToken_key` ON `ClientInvoice`(`shareToken`);
