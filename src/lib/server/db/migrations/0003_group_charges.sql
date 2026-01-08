CREATE TABLE `organization_charge` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`creation_date` timestamp NOT NULL,
	`description` text NOT NULL,
	`payment_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payment_id`) REFERENCES `payment`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `org_charge_org_idx` ON `organization_charge` (`organization_id`);