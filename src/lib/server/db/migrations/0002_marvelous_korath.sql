ALTER TABLE `print_request_payment` ADD `material_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `print_request_payment` ADD `build_plate_cost` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `print_request_payment` ADD `discount_amount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `print_request_payment` ADD `discount_title` text;