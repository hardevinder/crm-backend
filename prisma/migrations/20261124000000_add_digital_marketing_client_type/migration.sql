-- AlterTable
ALTER TABLE `Client` MODIFY `clientType` ENUM('school', 'college', 'transport', 'website', 'software', 'result_analyzer', 'other', 'digital_marketing') NOT NULL DEFAULT 'other';
