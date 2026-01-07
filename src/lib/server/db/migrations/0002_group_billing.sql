ALTER TABLE `print_request_payment` RENAME TO `payment`;--> statement-breakpoint
CREATE TABLE `billing_code` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text NOT NULL,
	`organization_id` text,
	`discount_id` text,
	`archived` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `billing_code_code_unique` ON `billing_code` (`code`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE `payment` ADD `organization_id` text REFERENCES organization(id);--> statement-breakpoint
ALTER TABLE `payment` ADD `type` text NOT NULL DEFAULT 'print_request';--> statement-breakpoint
ALTER TABLE `payment` ALTER `type` DROP DEFAULT;--> statement-breakpoint