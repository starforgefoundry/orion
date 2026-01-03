CREATE TABLE `print_material` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `print_request` (
	`id` text PRIMARY KEY NOT NULL,
	`submissionDate` timestamp NOT NULL,
	`completionDate` timestamp,
	`email` text NOT NULL,
	`customer_name` text NOT NULL,
	`project_name` text NOT NULL,
	`status` text NOT NULL,
	`is_quote` integer DEFAULT false NOT NULL,
	`material` text NOT NULL,
	`special_requests` text NOT NULL,
	`billing_code` text,
	`payment_id` text,
	`buildplate_count` integer DEFAULT 1,
	`material_cost` integer DEFAULT 0,
	FOREIGN KEY (`material`) REFERENCES `print_material`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `print_request_payment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `print_request_file` (
	`id` text PRIMARY KEY NOT NULL,
	`print_request_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`print_request_id`) REFERENCES `print_request`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `print_request_payment` (
	`id` text PRIMARY KEY NOT NULL,
	`issued_date` timestamp NOT NULL,
	`payment_date` timestamp,
	`status` text NOT NULL,
	`total` integer NOT NULL,
	`square_invoice_id` text,
	`square_order_id` text
);
--> statement-breakpoint
CREATE INDEX `square_invoice_idx` ON `print_request_payment` (`square_invoice_id`);--> statement-breakpoint
CREATE INDEX `square_order_idx` ON `print_request_payment` (`square_order_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `square_webhook_log` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL
);
