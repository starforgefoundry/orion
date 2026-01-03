ALTER TABLE `print_request_payment` ADD `order_object` text;--> statement-breakpoint
ALTER TABLE `print_request_payment` DROP COLUMN `material_cost`;--> statement-breakpoint
ALTER TABLE `print_request_payment` DROP COLUMN `build_plate_cost`;--> statement-breakpoint
ALTER TABLE `print_request_payment` DROP COLUMN `discount_amount`;--> statement-breakpoint
ALTER TABLE `print_request_payment` DROP COLUMN `discount_title`;