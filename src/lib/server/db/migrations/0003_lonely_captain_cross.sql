PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_print_request_payment` (
	`id` text PRIMARY KEY NOT NULL,
	`issued_date` timestamp NOT NULL,
	`status` text NOT NULL,
	`total` integer NOT NULL,
	`square_invoice_id` text NOT NULL,
	`square_order_id` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_print_request_payment`("id", "issued_date", "status", "total", "square_invoice_id", "square_order_id") SELECT "id", "issued_date", "status", "total", "square_invoice_id", "square_order_id" FROM `print_request_payment`;--> statement-breakpoint
DROP TABLE `print_request_payment`;--> statement-breakpoint
ALTER TABLE `__new_print_request_payment` RENAME TO `print_request_payment`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `print_material` DROP COLUMN `cost`;