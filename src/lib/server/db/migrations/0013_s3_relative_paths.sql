-- Strip the old S3 provider domain + bucket from stored URLs, leaving only the
-- object key. The public URL base is now prepended at runtime from S3_PUBLIC_URL.
UPDATE `print_request_file` SET `file_url` = REPLACE(`file_url`, 'https://s3.us-east-005.backblazeb2.com/starforge-orion/', '');
--> statement-breakpoint
UPDATE `inventory_item` SET `image_url` = REPLACE(`image_url`, 'https://s3.us-east-005.backblazeb2.com/starforge-orion/', '');
--> statement-breakpoint
UPDATE `waiver` SET `signature_url` = REPLACE(`signature_url`, 'https://s3.us-east-005.backblazeb2.com/starforge-orion/', '');
--> statement-breakpoint
UPDATE `class_catalog` SET `photo_url` = REPLACE(`photo_url`, 'https://s3.us-east-005.backblazeb2.com/starforge-orion/', '');
