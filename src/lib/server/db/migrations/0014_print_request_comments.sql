CREATE TABLE `print_request_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`print_request_id` text NOT NULL,
	`author_email` text NOT NULL,
	`body` text NOT NULL,
	`attachment_name` text,
	`attachment_url` text,
	`created_date` timestamp NOT NULL,
	FOREIGN KEY (`print_request_id`) REFERENCES `print_request`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_email`) REFERENCES `user`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `print_request_comment_request_idx` ON `print_request_comment` (`print_request_id`);