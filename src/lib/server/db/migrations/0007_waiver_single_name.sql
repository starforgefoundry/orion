ALTER TABLE `waiver` ADD COLUMN `name` text NOT NULL DEFAULT '';
UPDATE `waiver` SET `name` = `first_name` || ' ' || `last_name`;
ALTER TABLE `waiver` DROP COLUMN `first_name`;
ALTER TABLE `waiver` DROP COLUMN `last_name`;
