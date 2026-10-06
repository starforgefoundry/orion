CREATE TABLE "billing_code" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"organization_id" text,
	"discount_id" text,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "billing_code_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "class_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"instance_id" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"square_payment_id" text,
	"status" text NOT NULL,
	"booking_token" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_catalog" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"photo_url" text,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_instance" (
	"id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"teacher_email" text NOT NULL,
	"date" text NOT NULL,
	"start_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"seats" integer NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"recurrence_group_id" text,
	"created_date" timestamp(3) with time zone NOT NULL,
	"google_event_id" text
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"vendor" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_charge" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"creation_date" timestamp(3) with time zone NOT NULL,
	"description" text NOT NULL,
	"payment_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY NOT NULL,
	"issued_date" timestamp(3) with time zone NOT NULL,
	"payment_date" timestamp(3) with time zone,
	"status" text NOT NULL,
	"square_invoice_id" text,
	"square_order_id" text,
	"organization_id" text,
	"type" text NOT NULL,
	"total" integer NOT NULL,
	"order_object" text,
	"payment_url" text
);
--> statement-breakpoint
CREATE TABLE "print_material" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"tag_id" text,
	"filament_id" text,
	"vendor" text,
	"material_type" text,
	"color_name" text,
	"color_hex" text,
	CONSTRAINT "print_material_tag_id_unique" UNIQUE("tag_id")
);
--> statement-breakpoint
CREATE TABLE "print_request" (
	"id" text PRIMARY KEY NOT NULL,
	"submissionDate" timestamp(3) with time zone NOT NULL,
	"completionDate" timestamp(3) with time zone,
	"email" text NOT NULL,
	"customer_name" text NOT NULL,
	"project_name" text NOT NULL,
	"status" text NOT NULL,
	"is_quote" boolean DEFAULT false NOT NULL,
	"material" text NOT NULL,
	"special_requests" text NOT NULL,
	"billing_code" text,
	"payment_id" text,
	"buildplate_count" integer DEFAULT 1,
	"material_cost" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "print_request_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"print_request_id" text NOT NULL,
	"author_email" text NOT NULL,
	"body" text NOT NULL,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_request_comment_file" (
	"id" text PRIMARY KEY NOT NULL,
	"comment_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_request_file" (
	"id" text PRIMARY KEY NOT NULL,
	"print_request_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_list" (
	"id" text PRIMARY KEY NOT NULL,
	"inventory_item_id" text NOT NULL,
	"added_date" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "purchase_list_inventory_item_id_unique" UNIQUE("inventory_item_id")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "square_webhook_log" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"email" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"picture" text NOT NULL,
	"google_calendar_id" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "waiver" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"signature_url" text NOT NULL,
	"signed_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_code" ADD CONSTRAINT "billing_code_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_booking" ADD CONSTRAINT "class_booking_instance_id_class_instance_id_fk" FOREIGN KEY ("instance_id") REFERENCES "public"."class_instance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_instance" ADD CONSTRAINT "class_instance_class_id_class_catalog_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class_catalog"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_instance" ADD CONSTRAINT "class_instance_teacher_email_user_email_fk" FOREIGN KEY ("teacher_email") REFERENCES "public"."user"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_charge" ADD CONSTRAINT "organization_charge_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_charge" ADD CONSTRAINT "organization_charge_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_request" ADD CONSTRAINT "print_request_material_print_material_id_fk" FOREIGN KEY ("material") REFERENCES "public"."print_material"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_request" ADD CONSTRAINT "print_request_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_request_comment" ADD CONSTRAINT "print_request_comment_print_request_id_print_request_id_fk" FOREIGN KEY ("print_request_id") REFERENCES "public"."print_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_request_comment" ADD CONSTRAINT "print_request_comment_author_email_user_email_fk" FOREIGN KEY ("author_email") REFERENCES "public"."user"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_request_comment_file" ADD CONSTRAINT "print_request_comment_file_comment_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."print_request_comment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_request_file" ADD CONSTRAINT "print_request_file_print_request_id_print_request_id_fk" FOREIGN KEY ("print_request_id") REFERENCES "public"."print_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_list" ADD CONSTRAINT "purchase_list_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_booking_instance_idx" ON "class_booking" USING btree ("instance_id");--> statement-breakpoint
CREATE INDEX "class_booking_token_idx" ON "class_booking" USING btree ("booking_token");--> statement-breakpoint
CREATE INDEX "class_instance_class_idx" ON "class_instance" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "class_instance_date_idx" ON "class_instance" USING btree ("date");--> statement-breakpoint
CREATE INDEX "class_instance_recurrence_idx" ON "class_instance" USING btree ("recurrence_group_id");--> statement-breakpoint
CREATE INDEX "org_charge_org_idx" ON "organization_charge" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "square_invoice_idx" ON "payment" USING btree ("square_invoice_id");--> statement-breakpoint
CREATE INDEX "square_order_idx" ON "payment" USING btree ("square_order_id");--> statement-breakpoint
CREATE INDEX "print_request_comment_request_idx" ON "print_request_comment" USING btree ("print_request_id");--> statement-breakpoint
CREATE INDEX "print_request_comment_file_comment_idx" ON "print_request_comment_file" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX "purchase_list_item_idx" ON "purchase_list" USING btree ("inventory_item_id");