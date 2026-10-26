CREATE TABLE "car_bay_overrun" (
	"id" text PRIMARY KEY NOT NULL,
	"booking_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"created_date" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD COLUMN "payment_id" text;--> statement-breakpoint
ALTER TABLE "class_booking" ADD COLUMN "payment_id" text;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "refunded_date" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "customer_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "customer_email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "line_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "discounts" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "square_payment_id" text;--> statement-breakpoint
ALTER TABLE "car_bay_overrun" ADD CONSTRAINT "car_bay_overrun_booking_id_car_bay_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."car_bay_booking"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_bay_overrun" ADD CONSTRAINT "car_bay_overrun_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "car_bay_overrun_booking_idx" ON "car_bay_overrun" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD CONSTRAINT "car_bay_booking_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_booking" ADD CONSTRAINT "class_booking_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "payment" SET
	"line_items" = COALESCE((
		SELECT jsonb_agg(jsonb_build_object(
			'name', COALESCE(item->>'name', '3D Print Request'),
			'quantity', COALESCE((item->>'quantity')::numeric, 1)::integer,
			'unitAmount', COALESCE((item->'basePriceMoney'->>'amount')::numeric, 0)::integer
		) ORDER BY ordinality)
		FROM jsonb_array_elements("order_object"::jsonb->'lineItems') WITH ORDINALITY AS t(item, ordinality)
	), '[]'::jsonb),
	"discounts" = COALESCE((
		SELECT jsonb_agg(jsonb_build_object(
			'name', COALESCE(discount->>'name', 'Discount'),
			'amount', COALESCE((discount->'appliedMoney'->>'amount')::numeric, 0)::integer
		) ORDER BY ordinality)
		FROM jsonb_array_elements("order_object"::jsonb->'discounts') WITH ORDINALITY AS t(discount, ordinality)
	), '[]'::jsonb)
WHERE "order_object" IS NOT NULL;
--> statement-breakpoint
UPDATE "payment" SET "line_items" = jsonb_build_array(jsonb_build_object(
	'name', 'Organization Balance Payment', 'quantity', 1, 'unitAmount', "total"
))
WHERE "type" = 'balance' AND "line_items" = '[]'::jsonb;
--> statement-breakpoint
UPDATE "payment" SET "line_items" = jsonb_build_array(jsonb_build_object(
	'name', "organization_charge"."description", 'quantity', 1, 'unitAmount', "payment"."total"
))
FROM "organization_charge"
WHERE "organization_charge"."payment_id" = "payment"."id" AND "payment"."line_items" = '[]'::jsonb;
--> statement-breakpoint
UPDATE "payment" SET "line_items" = jsonb_build_array(jsonb_build_object(
	'name', '3D Print Request', 'quantity', 1, 'unitAmount', "total"
))
WHERE "type" = 'print_request' AND "line_items" = '[]'::jsonb;
--> statement-breakpoint
UPDATE "payment" SET "customer_name" = "print_request"."customer_name", "customer_email" = "print_request"."email"
FROM "print_request"
WHERE "print_request"."payment_id" = "payment"."id";
--> statement-breakpoint
UPDATE "payment" SET "customer_name" = "organization"."name", "customer_email" = "organization"."email"
FROM "organization"
WHERE "organization"."id" = "payment"."organization_id" AND "payment"."type" IN ('balance', 'org_charge');
--> statement-breakpoint
UPDATE "payment" SET "customer_name" = "car_bay_booking"."customer_name", "customer_email" = "car_bay_booking"."customer_email"
FROM "car_bay_booking"
WHERE "car_bay_booking"."id" = "payment"."car_bay_booking_id";
--> statement-breakpoint
INSERT INTO "car_bay_overrun" ("id", "booking_id", "payment_id", "created_date")
SELECT gen_random_uuid()::text, "car_bay_booking_id", "id", "issued_date"
FROM "payment"
WHERE "car_bay_booking_id" IS NOT NULL;
--> statement-breakpoint
-- A booking's payment reuses the booking's id so the two can be linked without a lookup table.
INSERT INTO "payment" (
	"id", "type", "status", "issued_date", "payment_date", "customer_name", "customer_email",
	"line_items", "total", "square_payment_id"
)
SELECT
	"class_booking"."id",
	'class_booking',
	CASE WHEN "class_booking"."status" = 'canceled' THEN 'refunded' ELSE 'paid' END,
	"class_booking"."created_date",
	"class_booking"."created_date",
	"class_booking"."customer_name",
	"class_booking"."customer_email",
	-- A total that doesn't split evenly per seat stays one line so the items still add up to it.
	CASE WHEN "class_booking"."quantity" > 0 AND "class_booking"."amount_paid" % "class_booking"."quantity" = 0
		THEN jsonb_build_array(jsonb_build_object(
			'name', COALESCE("class_catalog"."name", 'Class Booking'),
			'quantity', "class_booking"."quantity",
			'unitAmount', "class_booking"."amount_paid" / "class_booking"."quantity"
		))
		ELSE jsonb_build_array(jsonb_build_object(
			'name', COALESCE("class_catalog"."name", 'Class Booking') || ' (' || "class_booking"."quantity" || ' seats)',
			'quantity', 1,
			'unitAmount', "class_booking"."amount_paid"
		))
	END,
	"class_booking"."amount_paid",
	"class_booking"."square_payment_id"
FROM "class_booking"
LEFT JOIN "class_instance" ON "class_instance"."id" = "class_booking"."instance_id"
LEFT JOIN "class_catalog" ON "class_catalog"."id" = "class_instance"."class_id"
WHERE "class_booking"."square_payment_id" IS NOT NULL OR "class_booking"."amount_paid" > 0;
--> statement-breakpoint
UPDATE "class_booking" SET "payment_id" = "id"
WHERE "square_payment_id" IS NOT NULL OR "amount_paid" > 0;
--> statement-breakpoint
-- Whether a canceled car bay booking was refunded depended on how late it was canceled, which
-- is not recorded, so those payments stay paid.
INSERT INTO "payment" (
	"id", "type", "status", "issued_date", "payment_date", "customer_name", "customer_email",
	"line_items", "total", "square_payment_id", "square_order_id"
)
SELECT
	"id",
	'car_bay_booking',
	'paid',
	"created_date",
	"created_date",
	"customer_name",
	"customer_email",
	jsonb_build_array(jsonb_build_object(
		'name', CASE "tier"
			WHEN 'quick_job' THEN 'Car Bay - Quick Job'
			WHEN 'hourly' THEN 'Car Bay - Hourly'
			ELSE 'Car Bay - Full Day'
		END,
		'quantity', 1,
		'unitAmount', "amount_paid"
	)),
	"amount_paid",
	"square_payment_id",
	"square_order_id"
FROM "car_bay_booking"
WHERE "square_payment_id" IS NOT NULL OR "amount_paid" > 0;
--> statement-breakpoint
UPDATE "car_bay_booking" SET "payment_id" = "id"
WHERE "square_payment_id" IS NOT NULL OR "amount_paid" > 0;

--> statement-breakpoint
ALTER TABLE "payment" DROP CONSTRAINT "payment_car_bay_booking_id_car_bay_booking_id_fk";
--> statement-breakpoint
DROP INDEX "payment_car_bay_booking_idx";--> statement-breakpoint
-- Group codes now only bill an organization, so discount-only codes stop working.
UPDATE "billing_code" SET "archived" = true WHERE "organization_id" IS NULL;--> statement-breakpoint
ALTER TABLE "billing_code" DROP COLUMN "discount_id";--> statement-breakpoint
ALTER TABLE "car_bay_booking" DROP COLUMN "amount_paid";--> statement-breakpoint
ALTER TABLE "car_bay_booking" DROP COLUMN "square_payment_id";--> statement-breakpoint
ALTER TABLE "car_bay_booking" DROP COLUMN "square_order_id";--> statement-breakpoint
ALTER TABLE "class_booking" DROP COLUMN "square_payment_id";--> statement-breakpoint
ALTER TABLE "class_booking" DROP COLUMN "amount_paid";--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN "order_object";--> statement-breakpoint
ALTER TABLE "payment" DROP COLUMN "car_bay_booking_id";