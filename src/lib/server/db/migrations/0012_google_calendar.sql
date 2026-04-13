ALTER TABLE `user` ADD COLUMN `google_calendar_id` text;--> statement-breakpoint
ALTER TABLE `class_instance` ADD COLUMN `google_event_id` text;--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `ical_token`;
