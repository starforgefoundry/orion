ALTER TABLE `user` ADD COLUMN `ical_token` text;
--> statement-breakpoint
CREATE TABLE `class_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` integer NOT NULL,
	`photo_url` text,
	`created_date` timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE `class_instance` (
	`id` text PRIMARY KEY NOT NULL,
	`class_id` text NOT NULL,
	`teacher_email` text NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`seats` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`recurrence_group_id` text,
	`created_date` timestamp NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `class_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacher_email`) REFERENCES `user`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `class_instance_class_idx` ON `class_instance` (`class_id`);
--> statement-breakpoint
CREATE INDEX `class_instance_date_idx` ON `class_instance` (`date`);
--> statement-breakpoint
CREATE INDEX `class_instance_recurrence_idx` ON `class_instance` (`recurrence_group_id`);
--> statement-breakpoint
CREATE TABLE `class_booking` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`customer_phone` text NOT NULL,
	`square_payment_id` text,
	`status` text NOT NULL,
	`booking_token` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`amount_paid` integer DEFAULT 0 NOT NULL,
	`created_date` timestamp NOT NULL,
	FOREIGN KEY (`instance_id`) REFERENCES `class_instance`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `class_booking_instance_idx` ON `class_booking` (`instance_id`);
--> statement-breakpoint
CREATE INDEX `class_booking_token_idx` ON `class_booking` (`booking_token`);
