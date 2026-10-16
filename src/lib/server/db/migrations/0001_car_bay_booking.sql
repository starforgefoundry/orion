CREATE TABLE "car_bay_booking" (
	"id" text PRIMARY KEY NOT NULL,
	"tier" text NOT NULL,
	"status" text NOT NULL,
	"start_at" timestamp(3) with time zone NOT NULL,
	"end_at" timestamp(3) with time zone NOT NULL,
	"blocked_until" timestamp(3) with time zone NOT NULL,
	"is_member" boolean NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"amount_paid" integer DEFAULT 0 NOT NULL,
	"square_payment_id" text,
	"square_order_id" text,
	"created_by_email" text,
	"booking_token" text NOT NULL,
	"reminder_sent_date" timestamp(3) with time zone,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "car_bay_booking_id" text;--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD CONSTRAINT "car_bay_booking_created_by_email_user_email_fk" FOREIGN KEY ("created_by_email") REFERENCES "public"."user"("email") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_bay_booking_start_idx" ON "car_bay_booking" USING btree ("start_at");--> statement-breakpoint
CREATE INDEX "car_bay_booking_token_idx" ON "car_bay_booking" USING btree ("booking_token");--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_car_bay_booking_id_car_bay_booking_id_fk" FOREIGN KEY ("car_bay_booking_id") REFERENCES "public"."car_bay_booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_car_bay_booking_idx" ON "payment" USING btree ("car_bay_booking_id");--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD CONSTRAINT "car_bay_booking_no_overlap" EXCLUDE USING gist (tstzrange("start_at", "blocked_until") WITH &&) WHERE ("status" = 'confirmed');
