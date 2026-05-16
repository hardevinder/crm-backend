-- CreateTable
CREATE TABLE `lead_import_batches` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `filename` VARCHAR(255) NOT NULL,
    `sheetName` VARCHAR(120) NULL,
    `totalRows` INTEGER NOT NULL DEFAULT 0,
    `successRows` INTEGER NOT NULL DEFAULT 0,
    `failedRows` INTEGER NOT NULL DEFAULT 0,
    `skippedRows` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'PROCESSING',
    `errorsJson` JSON NULL,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_import_batches_createdByUserId_idx`(`createdByUserId`),
    INDEX `lead_import_batches_status_idx`(`status`),
    INDEX `lead_import_batches_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_schools` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `uuid` VARCHAR(191) NOT NULL,
    `schoolName` VARCHAR(255) NOT NULL,
    `normalizedName` VARCHAR(255) NOT NULL,
    `schoolType` VARCHAR(100) NULL,
    `schoolCategory` VARCHAR(60) NULL DEFAULT 'PRIVATE',
    `board` VARCHAR(80) NULL,
    `state` VARCHAR(100) NULL,
    `normalizedState` VARCHAR(100) NOT NULL DEFAULT 'UNKNOWN',
    `city` VARCHAR(100) NULL,
    `district` VARCHAR(100) NULL,
    `address` TEXT NULL,
    `website` TEXT NULL,
    `streamsFound` VARCHAR(255) NULL,
    `latestDateTime` DATETIME(3) NULL,
    `latestFile` TEXT NULL,
    `totalFilesVersions` INTEGER NULL,
    `sizeKb` DECIMAL(10, 2) NULL,
    `primaryMobile` VARCHAR(30) NULL,
    `primaryWhatsapp` VARCHAR(30) NULL,
    `primaryLandline` VARCHAR(30) NULL,
    `primaryEmail` VARCHAR(255) NULL,
    `status` ENUM('NEW_LEAD', 'WHATSAPP_SENT', 'REPLY_RECEIVED', 'DEMO_INTERESTED', 'DEMO_SCHEDULED', 'DEMO_DONE', 'QUOTATION_SENT', 'CONVERTED', 'FOLLOW_UP_REQUIRED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'DUPLICATE') NOT NULL DEFAULT 'NEW_LEAD',
    `priority` ENUM('HOT', 'WARM', 'COLD') NOT NULL DEFAULT 'WARM',
    `source` ENUM('MANUAL', 'EXCEL_IMPORT', 'GOOGLE', 'REFERRAL', 'WEBSITE', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'OTHER') NOT NULL DEFAULT 'MANUAL',
    `sourceLabel` VARCHAR(120) NULL,
    `verificationStatus` VARCHAR(120) NULL,
    `contactNotes` TEXT NULL,
    `manualSearchLink` TEXT NULL,
    `assignedToUserId` INTEGER NULL,
    `importedBatchId` INTEGER NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_schools_uuid_key`(`uuid`),
    INDEX `lead_schools_state_city_idx`(`state`, `city`),
    INDEX `lead_schools_board_idx`(`board`),
    INDEX `lead_schools_status_priority_idx`(`status`, `priority`),
    INDEX `lead_schools_source_idx`(`source`),
    INDEX `lead_schools_primaryMobile_idx`(`primaryMobile`),
    INDEX `lead_schools_primaryWhatsapp_idx`(`primaryWhatsapp`),
    INDEX `lead_schools_primaryEmail_idx`(`primaryEmail`),
    INDEX `lead_schools_assignedToUserId_idx`(`assignedToUserId`),
    INDEX `lead_schools_importedBatchId_idx`(`importedBatchId`),
    INDEX `lead_schools_deletedAt_idx`(`deletedAt`),
    UNIQUE INDEX `lead_schools_normalizedName_normalizedState_key`(`normalizedName`, `normalizedState`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_contact_methods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadSchoolId` INTEGER NOT NULL,
    `methodType` ENUM('MOBILE', 'WHATSAPP', 'LANDLINE', 'EMAIL', 'WEBSITE', 'OTHER') NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `normalizedValue` VARCHAR(255) NOT NULL,
    `label` VARCHAR(80) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `sourceUrl` TEXT NULL,
    `verificationStatus` VARCHAR(120) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_contact_methods_methodType_normalizedValue_idx`(`methodType`, `normalizedValue`),
    INDEX `lead_contact_methods_leadSchoolId_isPrimary_idx`(`leadSchoolId`, `isPrimary`),
    UNIQUE INDEX `lead_contact_methods_leadSchoolId_methodType_normalizedValue_key`(`leadSchoolId`, `methodType`, `normalizedValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_followups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadSchoolId` INTEGER NOT NULL,
    `followUpType` ENUM('CALL', 'WHATSAPP', 'EMAIL', 'MEETING', 'DEMO', 'NOTE') NOT NULL DEFAULT 'NOTE',
    `followUpAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` TEXT NOT NULL,
    `previousStatus` ENUM('NEW_LEAD', 'WHATSAPP_SENT', 'REPLY_RECEIVED', 'DEMO_INTERESTED', 'DEMO_SCHEDULED', 'DEMO_DONE', 'QUOTATION_SENT', 'CONVERTED', 'FOLLOW_UP_REQUIRED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'DUPLICATE') NULL,
    `nextStatus` ENUM('NEW_LEAD', 'WHATSAPP_SENT', 'REPLY_RECEIVED', 'DEMO_INTERESTED', 'DEMO_SCHEDULED', 'DEMO_DONE', 'QUOTATION_SENT', 'CONVERTED', 'FOLLOW_UP_REQUIRED', 'NOT_INTERESTED', 'WRONG_NUMBER', 'DUPLICATE') NULL,
    `nextFollowUpAt` DATETIME(3) NULL,
    `handledByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_followups_leadSchoolId_followUpAt_idx`(`leadSchoolId`, `followUpAt`),
    INDEX `lead_followups_nextFollowUpAt_idx`(`nextFollowUpAt`),
    INDEX `lead_followups_handledByUserId_idx`(`handledByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_whatsapp_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `templateName` VARCHAR(150) NOT NULL,
    `displayName` VARCHAR(150) NULL,
    `languageCode` VARCHAR(20) NOT NULL DEFAULT 'en',
    `category` VARCHAR(80) NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAUSED') NOT NULL DEFAULT 'DRAFT',
    `headerText` TEXT NULL,
    `bodyText` TEXT NOT NULL,
    `footerText` TEXT NULL,
    `buttonsJson` JSON NULL,
    `variablesJson` JSON NULL,
    `providerTemplateId` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_whatsapp_templates_templateName_key`(`templateName`),
    INDEX `lead_whatsapp_templates_status_idx`(`status`),
    INDEX `lead_whatsapp_templates_languageCode_idx`(`languageCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_campaigns` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(180) NOT NULL,
    `description` TEXT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'DRAFT',
    `templateId` INTEGER NULL,
    `templateName` VARCHAR(150) NULL,
    `targetFiltersJson` JSON NULL,
    `scheduledAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `totalRecipients` INTEGER NOT NULL DEFAULT 0,
    `sentCount` INTEGER NOT NULL DEFAULT 0,
    `deliveredCount` INTEGER NOT NULL DEFAULT 0,
    `readCount` INTEGER NOT NULL DEFAULT 0,
    `replyCount` INTEGER NOT NULL DEFAULT 0,
    `failedCount` INTEGER NOT NULL DEFAULT 0,
    `createdByUserId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_campaigns_status_idx`(`status`),
    INDEX `lead_campaigns_templateId_idx`(`templateId`),
    INDEX `lead_campaigns_createdByUserId_idx`(`createdByUserId`),
    INDEX `lead_campaigns_scheduledAt_idx`(`scheduledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_campaign_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `campaignId` INTEGER NOT NULL,
    `leadSchoolId` INTEGER NOT NULL,
    `phoneNumber` VARCHAR(30) NULL,
    `status` ENUM('PENDING', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `readAt` DATETIME(3) NULL,
    `repliedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_campaign_recipients_leadSchoolId_idx`(`leadSchoolId`),
    INDEX `lead_campaign_recipients_status_idx`(`status`),
    UNIQUE INDEX `lead_campaign_recipients_campaignId_leadSchoolId_key`(`campaignId`, `leadSchoolId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_whatsapp_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadSchoolId` INTEGER NOT NULL,
    `contactMethodId` INTEGER NULL,
    `campaignId` INTEGER NULL,
    `campaignRecipientId` INTEGER NULL,
    `direction` ENUM('OUTBOUND', 'INBOUND') NOT NULL,
    `phoneNumber` VARCHAR(30) NOT NULL,
    `templateName` VARCHAR(150) NULL,
    `campaignName` VARCHAR(150) NULL,
    `messageText` TEXT NULL,
    `providerMessageId` VARCHAR(255) NULL,
    `status` ENUM('QUEUED', 'SENT', 'DELIVERED', 'READ', 'REPLIED', 'FAILED', 'RECEIVED') NOT NULL DEFAULT 'QUEUED',
    `errorMessage` TEXT NULL,
    `rawPayload` JSON NULL,
    `sentAt` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_whatsapp_messages_providerMessageId_key`(`providerMessageId`),
    INDEX `lead_whatsapp_messages_leadSchoolId_createdAt_idx`(`leadSchoolId`, `createdAt`),
    INDEX `lead_whatsapp_messages_contactMethodId_idx`(`contactMethodId`),
    INDEX `lead_whatsapp_messages_campaignId_idx`(`campaignId`),
    INDEX `lead_whatsapp_messages_campaignRecipientId_idx`(`campaignRecipientId`),
    INDEX `lead_whatsapp_messages_phoneNumber_idx`(`phoneNumber`),
    INDEX `lead_whatsapp_messages_campaignName_idx`(`campaignName`),
    INDEX `lead_whatsapp_messages_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lead_import_batches` ADD CONSTRAINT `lead_import_batches_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_schools` ADD CONSTRAINT `lead_schools_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_schools` ADD CONSTRAINT `lead_schools_importedBatchId_fkey` FOREIGN KEY (`importedBatchId`) REFERENCES `lead_import_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_contact_methods` ADD CONSTRAINT `lead_contact_methods_leadSchoolId_fkey` FOREIGN KEY (`leadSchoolId`) REFERENCES `lead_schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_followups` ADD CONSTRAINT `lead_followups_leadSchoolId_fkey` FOREIGN KEY (`leadSchoolId`) REFERENCES `lead_schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_followups` ADD CONSTRAINT `lead_followups_handledByUserId_fkey` FOREIGN KEY (`handledByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_campaigns` ADD CONSTRAINT `lead_campaigns_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `lead_whatsapp_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_campaigns` ADD CONSTRAINT `lead_campaigns_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_campaign_recipients` ADD CONSTRAINT `lead_campaign_recipients_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `lead_campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_campaign_recipients` ADD CONSTRAINT `lead_campaign_recipients_leadSchoolId_fkey` FOREIGN KEY (`leadSchoolId`) REFERENCES `lead_schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_whatsapp_messages` ADD CONSTRAINT `lead_whatsapp_messages_leadSchoolId_fkey` FOREIGN KEY (`leadSchoolId`) REFERENCES `lead_schools`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_whatsapp_messages` ADD CONSTRAINT `lead_whatsapp_messages_contactMethodId_fkey` FOREIGN KEY (`contactMethodId`) REFERENCES `lead_contact_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_whatsapp_messages` ADD CONSTRAINT `lead_whatsapp_messages_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `lead_campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_whatsapp_messages` ADD CONSTRAINT `lead_whatsapp_messages_campaignRecipientId_fkey` FOREIGN KEY (`campaignRecipientId`) REFERENCES `lead_campaign_recipients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
