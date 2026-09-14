-- AlterTable
ALTER TABLE `ClientSubscription` MODIFY `billingCycle` ENUM('monthly', 'quarterly', 'yearly', 'one_time', 'half_yearly') NOT NULL DEFAULT 'monthly';
