CREATE TABLE `user` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`picture` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);