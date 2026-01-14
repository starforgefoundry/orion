CREATE TABLE `inventory_item` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`vendor` text NOT NULL,
	`url` text NOT NULL,
	`image_url` text,
	`description` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `purchase_list` (
	`id` text PRIMARY KEY NOT NULL,
	`inventory_item_id` text NOT NULL,
	`added_date` timestamp NOT NULL,
	FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_item`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_list_inventory_item_id_unique` ON `purchase_list` (`inventory_item_id`);--> statement-breakpoint
CREATE INDEX `purchase_list_item_idx` ON `purchase_list` (`inventory_item_id`);