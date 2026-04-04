CREATE TABLE `local_bambu_connect_printer` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`local_ip` text NOT NULL,
	`serial` text NOT NULL,
	`access_code` text NOT NULL
);
