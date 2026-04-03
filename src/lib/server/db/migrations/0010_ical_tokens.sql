
UPDATE `user`
SET `ical_token` = lower(
	hex(randomblob(4)) || '-' ||
	hex(randomblob(2)) || '-' ||
	'4' || substr(hex(randomblob(2)), 2) || '-' ||
	substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)), 2) || '-' ||
	hex(randomblob(6))
)
WHERE `ical_token` IS NULL;--> statement-breakpoint
