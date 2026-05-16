/*
  Warnings:

  - A unique constraint covering the columns `[campaignId,normalizedPhoneNumber]` on the table `lead_campaign_recipients` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[templateName,languageCode]` on the table `lead_whatsapp_templates` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `normalizedPhoneNumber` to the `lead_campaign_recipients` table without a default value. This is not possible if the table is not empty.
  - Made the column `phoneNumber` on table `lead_campaign_recipients` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE `lead_campaign_recipients` DROP FOREIGN KEY `lead_campaign_recipients_campaignId_fkey`;

-- DropForeignKey
ALTER TABLE `lead_whatsapp_messages` DROP FOREIGN KEY `lead_whatsapp_messages_leadSchoolId_fkey`;

-- DropIndex
DROP INDEX `lead_campaign_recipients_campaignId_leadSchoolId_key` ON `lead_campaign_recipients`;

-- DropIndex
DROP INDEX `lead_whatsapp_messages_status_idx` ON `lead_whatsapp_messages`;

-- DropIndex
DROP INDEX `lead_whatsapp_templates_templateName_key` ON `lead_whatsapp_templates`;

-- AlterTable
ALTER TABLE `lead_campaign_recipients` ADD COLUMN `contactMethodId` INTEGER NULL,
    ADD COLUMN `failedAt` DATETIME(3) NULL,
    ADD COLUMN `normalizedPhoneNumber` VARCHAR(30) NOT NULL,
    ADD COLUMN `providerMessageId` VARCHAR(255) NULL,
    ADD COLUMN `queuedAt` DATETIME(3) NULL,
    MODIFY `phoneNumber` VARCHAR(30) NOT NULL;

-- AlterTable
ALTER TABLE `lead_whatsapp_messages` ADD COLUMN `buttonPayload` VARCHAR(255) NULL,
    ADD COLUMN `buttonText` VARCHAR(255) NULL,
    ADD COLUMN `contextProviderMessageId` VARCHAR(255) NULL,
    ADD COLUMN `deliveredAt` DATETIME(3) NULL,
    ADD COLUMN `failedAt` DATETIME(3) NULL,
    ADD COLUMN `messageType` ENUM('TEXT', 'TEMPLATE', 'BUTTON', 'INTERACTIVE', 'IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO', 'STICKER', 'CONTACTS', 'LOCATION', 'SYSTEM', 'UNKNOWN') NOT NULL DEFAULT 'TEXT',
    ADD COLUMN `normalizedPhone` VARCHAR(30) NULL,
    ADD COLUMN `pricingCategory` VARCHAR(80) NULL,
    ADD COLUMN `providerConversationId` VARCHAR(255) NULL,
    ADD COLUMN `queuedAt` DATETIME(3) NULL,
    ADD COLUMN `readAt` DATETIME(3) NULL,
    ADD COLUMN `statusUpdatedAt` DATETIME(3) NULL,
    MODIFY `leadSchoolId` INTEGER NULL,
    MODIFY `campaignName` VARCHAR(180) NULL;

-- CreateIndex
CREATE INDEX `lead_campaign_recipients_contactMethodId_idx` ON `lead_campaign_recipients`(`contactMethodId`);

-- CreateIndex
CREATE INDEX `lead_campaign_recipients_providerMessageId_idx` ON `lead_campaign_recipients`(`providerMessageId`);

-- CreateIndex
CREATE UNIQUE INDEX `lead_campaign_recipients_campaignId_normalizedPhoneNumber_key` ON `lead_campaign_recipients`(`campaignId`, `normalizedPhoneNumber`);

-- CreateIndex
CREATE INDEX `lead_whatsapp_messages_normalizedPhone_idx` ON `lead_whatsapp_messages`(`normalizedPhone`);

-- CreateIndex
CREATE INDEX `lead_whatsapp_messages_providerMessageId_idx` ON `lead_whatsapp_messages`(`providerMessageId`);

-- CreateIndex
CREATE INDEX `lead_whatsapp_messages_contextProviderMessageId_idx` ON `lead_whatsapp_messages`(`contextProviderMessageId`);

-- CreateIndex
CREATE INDEX `lead_whatsapp_messages_direction_status_idx` ON `lead_whatsapp_messages`(`direction`, `status`);

-- CreateIndex
CREATE INDEX `lead_whatsapp_messages_messageType_idx` ON `lead_whatsapp_messages`(`messageType`);

-- CreateIndex
CREATE UNIQUE INDEX `lead_whatsapp_templates_templateName_languageCode_key` ON `lead_whatsapp_templates`(`templateName`, `languageCode`);

-- AddForeignKey

-- AddForeignKey
ALTER TABLE `lead_campaign_recipients` ADD CONSTRAINT `lead_campaign_recipients_contactMethodId_fkey` FOREIGN KEY (`contactMethodId`) REFERENCES `lead_contact_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_whatsapp_messages` ADD CONSTRAINT `lead_whatsapp_messages_leadSchoolId_fkey` FOREIGN KEY (`leadSchoolId`) REFERENCES `lead_schools`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
