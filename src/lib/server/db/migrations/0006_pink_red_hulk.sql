CREATE TABLE `square_webhook_log` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `print_request_payment` ADD `payment_date` timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX `square_invoice_idx` ON `print_request_payment` (`square_invoice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `square_order_idx` ON `print_request_payment` (`square_order_id`);