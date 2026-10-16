CREATE TABLE "day_pass" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"square_order_id" text NOT NULL,
	"purchased_date" timestamp(3) with time zone NOT NULL,
	"used_date" text
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"square_customer_id" text,
	"pass_token" text NOT NULL,
	"onboarding_token" text NOT NULL,
	"created_date" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "member_email_unique" UNIQUE("email"),
	CONSTRAINT "member_pass_token_unique" UNIQUE("pass_token"),
	CONSTRAINT "member_onboarding_token_unique" UNIQUE("onboarding_token")
);
--> statement-breakpoint
CREATE TABLE "member_email" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"type" text NOT NULL,
	"trigger" text NOT NULL,
	"sent_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"plan_variation_id" text NOT NULL,
	"plan_name" text NOT NULL,
	"status" text NOT NULL,
	"start_date" text NOT NULL,
	"charged_through_date" text,
	"canceled_date" text,
	"access_ended_date" timestamp(3) with time zone,
	"refunded_payment_id" text,
	"updated_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"added_date" timestamp(3) with time zone NOT NULL,
	"removed_date" timestamp(3) with time zone
);
--> statement-breakpoint
CREATE TABLE "visit" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"scanned_date" timestamp(3) with time zone NOT NULL,
	"source" text NOT NULL,
	"access_basis" text NOT NULL,
	"outcome" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "grants_access" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "access_end_date" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "waiver" ADD COLUMN "member_id" text;--> statement-breakpoint
INSERT INTO "member" ("id", "email", "name", "pass_token", "onboarding_token", "created_date")
SELECT DISTINCT ON (lower(trim("email")))
	gen_random_uuid()::text, lower(trim("email")), "name", gen_random_uuid()::text, gen_random_uuid()::text, "signed_date"
FROM "waiver"
ORDER BY lower(trim("email")), "signed_date" DESC;--> statement-breakpoint
UPDATE "waiver" SET "member_id" = "member"."id"
FROM "member"
WHERE "member"."email" = lower(trim("waiver"."email"));--> statement-breakpoint
ALTER TABLE "waiver" ALTER COLUMN "member_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "waiver" ADD COLUMN "source" text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "waiver" ADD COLUMN "is_adult" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "day_pass" ADD CONSTRAINT "day_pass_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_email" ADD CONSTRAINT "member_email_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_subscription" ADD CONSTRAINT "member_subscription_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit" ADD CONSTRAINT "visit_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "day_pass_member_idx" ON "day_pass" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "day_pass_order_idx" ON "day_pass" USING btree ("square_order_id");--> statement-breakpoint
CREATE INDEX "member_email_member_idx" ON "member_email" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "member_subscription_member_idx" ON "member_subscription" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "organization_member_org_idx" ON "organization_member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_member_member_idx" ON "organization_member" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "visit_member_idx" ON "visit" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "visit_scanned_date_idx" ON "visit" USING btree ("scanned_date");--> statement-breakpoint
ALTER TABLE "waiver" ADD CONSTRAINT "waiver_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "waiver_member_idx" ON "waiver" USING btree ("member_id");