-- Back-office roles and the audit trail.
--
-- A role is only a preset: what a sub-admin may do is the stored `permissions`
-- list, and the owner (SUPER_ADMIN) is the only account that can manage the
-- team. Every admin write that touches money, members or configuration is
-- recorded in `AdminAuditLog`.
--
-- The owner can cap how large a payout a non-owner may approve through
-- `settings`.`withdrawalApprovalLimit` (null = the built-in default).
ALTER TABLE `admin` ADD COLUMN `createdById` VARCHAR(191) NULL,
    ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `name` VARCHAR(191) NULL,
    ADD COLUMN `permissions` JSON NULL,
    MODIFY `role` ENUM('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'SUPPORT', 'ANALYST') NOT NULL DEFAULT 'ADMIN';

ALTER TABLE `settings` ADD COLUMN `withdrawalApprovalLimit` DECIMAL(14, 2) NULL;

CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `adminId` VARCHAR(191) NULL,
    `adminEmail` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entity` VARCHAR(191) NULL,
    `entityId` VARCHAR(191) NULL,
    `summary` VARCHAR(191) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_adminId_idx`(`adminId`),
    INDEX `AdminAuditLog_action_idx`(`action`),
    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `AdminAuditLog` ADD CONSTRAINT `AdminAuditLog_adminId_fkey` FOREIGN KEY (`adminId`) REFERENCES `admin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
