CREATE TABLE `print_request_comment_file` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_url` text NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `print_request_comment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `print_request_comment_file_comment_idx` ON `print_request_comment_file` (`comment_id`);--> statement-breakpoint
ALTER TABLE `print_request_comment` DROP COLUMN `attachment_name`;--> statement-breakpoint
ALTER TABLE `print_request_comment` DROP COLUMN `attachment_url`;