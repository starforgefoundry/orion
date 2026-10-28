ALTER TABLE "car_bay_booking" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD COLUMN "pass_token" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "class_booking" ADD COLUMN "member_id" text;--> statement-breakpoint
ALTER TABLE "class_booking" ADD COLUMN "pass_token" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "class_booking" ADD COLUMN "reminder_sent_date" timestamp(3) with time zone;--> statement-breakpoint
ALTER TABLE "day_pass" ADD COLUMN "pass_token" text DEFAULT gen_random_uuid()::text NOT NULL;--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD CONSTRAINT "car_bay_booking_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_booking" ADD CONSTRAINT "class_booking_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "car_bay_booking" ADD CONSTRAINT "car_bay_booking_pass_token_unique" UNIQUE("pass_token");--> statement-breakpoint
ALTER TABLE "class_booking" ADD CONSTRAINT "class_booking_pass_token_unique" UNIQUE("pass_token");--> statement-breakpoint
ALTER TABLE "day_pass" ADD CONSTRAINT "day_pass_pass_token_unique" UNIQUE("pass_token");
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('class_reminder', 'Class Reminder - {{className}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>This is a reminder that <strong>{{className}}</strong> is tomorrow.</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Class:</strong> {{className}}</li>
  <li><strong>Date:</strong> {{classDate}}</li>
  <li><strong>Time:</strong> {{classTime}}</li>
  <li><strong>Spots:</strong> {{quantity}}</li>
</ul>

<h4>Your Class Pass</h4>
<p>
  Scan this QR code at the front desk kiosk when you arrive. If you haven't signed our liability
  waiver yet, the kiosk will walk you through it. One scan checks in your whole booking.
</p>
<p><img src="{{passQrImageUrl}}" alt="Class pass QR code" width="200" height="200" /></p>
<p><a href="{{passUrl}}">Add your pass to Apple or Google Wallet</a></p>

<p>
  You can view or cancel your booking here:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>See you soon!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('day_pass', 'Your Starforge Foundry Day Pass', $tpl$<h3>Howdy, {{memberName}}!</h3>

<p>Thanks for picking up a day pass at Starforge Foundry!</p>

<h4>Your Day Pass</h4>
<p>
  Scan this QR code at the front desk kiosk on the day you visit. The pass is good for one day. If
  you haven't signed our liability waiver yet, the kiosk will walk you through it.
</p>
<p><img src="{{passQrImageUrl}}" alt="Day pass QR code" width="200" height="200" /></p>
<p><a href="{{passUrl}}">Add your pass to Apple or Google Wallet</a></p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
UPDATE "email_template" SET "body" = $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>Your booking for <strong>{{className}}</strong> has been confirmed!</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Class:</strong> {{className}}</li>
  <li><strong>Date:</strong> {{classDate}}</li>
  <li><strong>Time:</strong> {{classTime}}</li>
  <li><strong>Duration:</strong> {{classDuration}} minutes</li>
  <li><strong>Spots:</strong> {{quantity}}</li>
  <li><strong>Amount Paid:</strong> ${{amountPaid}}</li>
</ul>

<h4>Your Class Pass</h4>
<p>
  Scan this QR code at the front desk kiosk when you arrive. If you haven't signed our liability
  waiver yet, the kiosk will walk you through it. One scan checks in your whole booking.
</p>
<p><img src="{{passQrImageUrl}}" alt="Class pass QR code" width="200" height="200" /></p>
<p><a href="{{passUrl}}">Add your pass to Apple or Google Wallet</a></p>

<p>
  You can view your booking details, add the event to your calendar, or cancel your booking by
  visiting this link:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$
WHERE "key" = 'class_booking' AND "body" = $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>Your booking for <strong>{{className}}</strong> has been confirmed!</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Class:</strong> {{className}}</li>
  <li><strong>Date:</strong> {{classDate}}</li>
  <li><strong>Time:</strong> {{classTime}}</li>
  <li><strong>Duration:</strong> {{classDuration}} minutes</li>
  <li><strong>Spots:</strong> {{quantity}}</li>
  <li><strong>Amount Paid:</strong> ${{amountPaid}}</li>
</ul>

<p>
  You can view your booking details, add the event to your calendar, or cancel your booking by
  visiting this link:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$;
--> statement-breakpoint
UPDATE "email_template" SET "body" = $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>Your car bay booking is confirmed!</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Booking:</strong> {{tierName}}</li>
  <li><strong>When:</strong> {{bookingWhen}}</li>
  <li><strong>Amount Paid:</strong> ${{amountPaid}}</li>
</ul>

<h4>Your Car Bay Pass</h4>
<p>
  Scan this QR code at the front desk kiosk when you arrive. If you haven't signed our liability
  waiver yet, the kiosk will walk you through it.
</p>
<p><img src="{{passQrImageUrl}}" alt="Car bay pass QR code" width="200" height="200" /></p>
<p><a href="{{passUrl}}">Add your pass to Apple or Google Wallet</a></p>

<p>
  Cancel at least {{refundCutoffHours}} hours before your start time for a full refund. Later
  cancellations and no-shows are not refunded.
</p>

<p>
  You can move your own car outside when your booking ends, free of charge. It can stay on the
  property for up to {{storageDays}} days from your booking's start date.
</p>

<p>
  You can view or cancel your booking here:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$
WHERE "key" = 'car_bay_booking' AND "body" = $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>Your car bay booking is confirmed!</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Booking:</strong> {{tierName}}</li>
  <li><strong>When:</strong> {{bookingWhen}}</li>
  <li><strong>Amount Paid:</strong> ${{amountPaid}}</li>
</ul>

<p>
  Cancel at least {{refundCutoffHours}} hours before your start time for a full refund. Later
  cancellations and no-shows are not refunded.
</p>

<p>
  You can move your own car outside when your booking ends, free of charge. It can stay on the
  property for up to {{storageDays}} days from your booking's start date.
</p>

<p>
  You can view or cancel your booking here:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$;
--> statement-breakpoint
UPDATE "email_template" SET "body" = $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>This is a reminder that your car bay booking starts in about 24 hours.</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Booking:</strong> {{tierName}}</li>
  <li><strong>When:</strong> {{bookingWhen}}</li>
</ul>

<h4>Your Car Bay Pass</h4>
<p>
  Scan this QR code at the front desk kiosk when you arrive. If you haven't signed our liability
  waiver yet, the kiosk will walk you through it.
</p>
<p><img src="{{passQrImageUrl}}" alt="Car bay pass QR code" width="200" height="200" /></p>
<p><a href="{{passUrl}}">Add your pass to Apple or Google Wallet</a></p>

<p>
  You can view or cancel your booking here:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>See you soon!</p>

<p>Starforge Foundry</p>
$tpl$
WHERE "key" = 'car_bay_reminder' AND "body" = $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>This is a reminder that your car bay booking starts in about 24 hours.</p>

<h4>Booking Details</h4>
<ul>
  <li><strong>Booking:</strong> {{tierName}}</li>
  <li><strong>When:</strong> {{bookingWhen}}</li>
</ul>

<p>
  You can view or cancel your booking here:
  <a href="{{bookingUrl}}">View Booking</a>
</p>

<p>See you soon!</p>

<p>Starforge Foundry</p>
$tpl$;
