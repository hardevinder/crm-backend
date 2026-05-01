-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('superadmin', 'admin', 'accounts', 'developer', 'support', 'client_admin', 'client_user') NOT NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `clientId` INTEGER NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_clientId_idx`(`clientId`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientName` VARCHAR(191) NOT NULL,
    `clientCode` VARCHAR(191) NOT NULL,
    `clientType` ENUM('school', 'college', 'transport', 'website', 'software', 'result_analyzer', 'other') NOT NULL DEFAULT 'other',
    `contactPerson` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `businessName` VARCHAR(191) NULL,
    `gstin` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL DEFAULT 'India',
    `websiteUrl` VARCHAR(191) NULL,
    `projectUrl` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Client_clientCode_key`(`clientCode`),
    INDEX `Client_clientType_idx`(`clientType`),
    INDEX `Client_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientSubscription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `serviceName` VARCHAR(191) NOT NULL,
    `billingCycle` ENUM('monthly', 'quarterly', 'yearly', 'one_time') NOT NULL DEFAULT 'monthly',
    `amount` DECIMAL(12, 2) NOT NULL,
    `gstPercent` DECIMAL(5, 2) NOT NULL DEFAULT 18.00,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `nextInvoiceDate` DATETIME(3) NULL,
    `status` ENUM('active', 'inactive', 'suspended', 'expired') NOT NULL DEFAULT 'active',
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientSubscription_clientId_idx`(`clientId`),
    INDEX `ClientSubscription_status_idx`(`status`),
    INDEX `ClientSubscription_nextInvoiceDate_idx`(`nextInvoiceDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientInvoice` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `subscriptionId` INTEGER NULL,
    `invoiceNo` VARCHAR(191) NOT NULL,
    `invoiceDate` DATETIME(3) NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `billingPeriodFrom` DATETIME(3) NULL,
    `billingPeriodTo` DATETIME(3) NULL,
    `subtotal` DECIMAL(12, 2) NOT NULL,
    `gstPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `gstAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `paidAmount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `balanceAmount` DECIMAL(12, 2) NOT NULL,
    `status` ENUM('unpaid', 'paid', 'partial', 'overdue', 'cancelled') NOT NULL DEFAULT 'unpaid',
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClientInvoice_invoiceNo_key`(`invoiceNo`),
    INDEX `ClientInvoice_clientId_idx`(`clientId`),
    INDEX `ClientInvoice_subscriptionId_idx`(`subscriptionId`),
    INDEX `ClientInvoice_status_idx`(`status`),
    INDEX `ClientInvoice_invoiceDate_idx`(`invoiceDate`),
    INDEX `ClientInvoice_dueDate_idx`(`dueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientPayment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `invoiceId` INTEGER NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `paymentMode` VARCHAR(191) NOT NULL,
    `gateway` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `referenceNo` VARCHAR(191) NULL,
    `paymentStatus` ENUM('pending', 'success', 'failed', 'cancelled') NOT NULL DEFAULT 'success',
    `paymentDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `remarks` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ClientPayment_clientId_idx`(`clientId`),
    INDEX `ClientPayment_invoiceId_idx`(`invoiceId`),
    INDEX `ClientPayment_paymentStatus_idx`(`paymentStatus`),
    INDEX `ClientPayment_paymentDate_idx`(`paymentDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupportTicket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `ticketNo` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `description` TEXT NOT NULL,
    `status` ENUM('open', 'in_progress', 'waiting_for_client', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `createdByUserId` INTEGER NULL,
    `assignedToUserId` INTEGER NULL,
    `dueDate` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SupportTicket_ticketNo_key`(`ticketNo`),
    INDEX `SupportTicket_clientId_idx`(`clientId`),
    INDEX `SupportTicket_status_idx`(`status`),
    INDEX `SupportTicket_priority_idx`(`priority`),
    INDEX `SupportTicket_assignedToUserId_idx`(`assignedToUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TicketReply` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticketId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `message` TEXT NOT NULL,
    `isInternal` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TicketReply_ticketId_idx`(`ticketId`),
    INDEX `TicketReply_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Task` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `clientId` INTEGER NOT NULL,
    `ticketId` INTEGER NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `assignedToUserId` INTEGER NULL,
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `status` ENUM('pending', 'in_progress', 'testing', 'completed', 'on_hold') NOT NULL DEFAULT 'pending',
    `deadline` DATETIME(3) NULL,
    `progressPercent` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Task_clientId_idx`(`clientId`),
    INDEX `Task_ticketId_idx`(`ticketId`),
    INDEX `Task_assignedToUserId_idx`(`assignedToUserId`),
    INDEX `Task_status_idx`(`status`),
    INDEX `Task_deadline_idx`(`deadline`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaskUpdate` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `taskId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `note` TEXT NOT NULL,
    `statusFrom` VARCHAR(191) NULL,
    `statusTo` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `TaskUpdate_taskId_idx`(`taskId`),
    INDEX `TaskUpdate_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientSubscription` ADD CONSTRAINT `ClientSubscription_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientInvoice` ADD CONSTRAINT `ClientInvoice_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientInvoice` ADD CONSTRAINT `ClientInvoice_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `ClientSubscription`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPayment` ADD CONSTRAINT `ClientPayment_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPayment` ADD CONSTRAINT `ClientPayment_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `ClientInvoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SupportTicket` ADD CONSTRAINT `SupportTicket_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TicketReply` ADD CONSTRAINT `TicketReply_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `SupportTicket`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Task` ADD CONSTRAINT `Task_assignedToUserId_fkey` FOREIGN KEY (`assignedToUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskUpdate` ADD CONSTRAINT `TaskUpdate_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `Task`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TaskUpdate` ADD CONSTRAINT `TaskUpdate_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
