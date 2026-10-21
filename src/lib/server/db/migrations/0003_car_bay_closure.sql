CREATE TABLE "car_bay_closure" (
	"id" text PRIMARY KEY NOT NULL,
	"start_at" timestamp(3) with time zone NOT NULL,
	"end_at" timestamp(3) with time zone NOT NULL,
	"reason" text,
	"created_by_email" text,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_bay_closure" ADD CONSTRAINT "car_bay_closure_created_by_email_user_email_fk" FOREIGN KEY ("created_by_email") REFERENCES "public"."user"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_bay_closure_start_idx" ON "car_bay_closure" USING btree ("start_at");--> statement-breakpoint
ALTER TABLE "car_bay_closure" ADD CONSTRAINT "car_bay_closure_no_overlap" EXCLUDE USING gist (tstzrange("start_at", "end_at") WITH &&);
