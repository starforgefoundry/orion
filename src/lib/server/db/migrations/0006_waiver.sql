CREATE TABLE `waiver` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`signature_url` text NOT NULL,
	`signed_date` timestamp NOT NULL
);
