CREATE TABLE `print_material` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`cost` integer NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`archived` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `print_request` (
	`id` text PRIMARY KEY NOT NULL,
	`submissionDate` timestamp NOT NULL,
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
	`material_usage_grams` integer DEFAULT 0,
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
	`issued_date` integer NOT NULL,
	`status` text,
	`total` integer NOT NULL,
	`square_id` text NOT NULL
);
