ALTER TABLE `print_material` ADD `tag_id` text;--> statement-breakpoint
ALTER TABLE `print_material` ADD `filament_id` text;--> statement-breakpoint
ALTER TABLE `print_material` ADD `vendor` text;--> statement-breakpoint
ALTER TABLE `print_material` ADD `material_type` text;--> statement-breakpoint
ALTER TABLE `print_material` ADD `color_name` text;--> statement-breakpoint
ALTER TABLE `print_material` ADD `color_hex` text;--> statement-breakpoint
CREATE UNIQUE INDEX `print_material_tag_id_unique` ON `print_material` (`tag_id`);