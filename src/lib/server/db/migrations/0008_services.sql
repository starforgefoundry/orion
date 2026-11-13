CREATE TABLE "service" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"pricing_mode" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_request" (
	"id" text PRIMARY KEY NOT NULL,
	"service_id" text NOT NULL,
	"submission_date" timestamp(3) with time zone NOT NULL,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price" integer,
	"status" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_request" ADD CONSTRAINT "service_request_service_id_service_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."service"("id") ON DELETE no action ON UPDATE no action;