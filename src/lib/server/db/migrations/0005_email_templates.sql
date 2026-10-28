CREATE TABLE "email_template" (
	"key" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL
);

--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('print_submitted', 'We Received Your Print Request - {{projectName}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>We received your 3D print request "{{projectName}}".</p>

<p>
  You can check its status at any time here. Once we price your print, the cost breakdown and
  payment will show up on the same page:
  <a href="{{statusURL}}">View Print Request</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('print_quote', 'Print Request Quote - {{projectName}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>
  Your quote for the 3D print request "{{projectName}}" is ready.
  <strong>The total is ${{quotePrice}}.</strong>
</p>

<p>
  You can see the full price breakdown, approve the quote and pay, or cancel the request here:
  <a href="{{quoteURL}}">Review Quote</a>
</p>

<p>We won't start printing until you approve the quote.</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('print_payment', 'Print Request Payment - {{projectName}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>
  Your 3D print request "{{projectName}}" is ready for payment.
  <strong>The total is ${{total}}.</strong>
</p>

<p>
  You can see the full price breakdown and pay with a card here:
  <a href="{{paymentURL}}">Pay Now</a>
</p>

<p>Please pay before you pick up your print.</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('print_pickup', 'Your Print Request is Ready! - {{projectName}}', $tpl$<h3>Howdy!</h3>

<p>Your 3D Print titled "{{projectName}}" is ready for pickup at Starforge!</p>

<p>{{paymentNote}} <a href="{{statusURL}}">View Print Request</a></p>

<p>We are currently open 4-9pm weekdays, noon-9pm weekends.</p>

<p>
  As always, keep an eye on our Discord in the #announcements channel for changes to our hours. If
  you have any issues with pickup or any questions, just reply to this email!
</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('class_booking', 'Class Booking Confirmation - {{className}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

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
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('car_bay_booking', 'Car Bay Booking Confirmation - {{tierName}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

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
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('car_bay_reminder', 'Car Bay Booking Reminder', $tpl$<h3>Howdy, {{customerName}}!</h3>

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
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('member_onboarding', '{{subject}}', $tpl$<h3>Howdy, {{memberName}}!</h3>

<p>{{introMessage}}</p>

<p>{{setupMessage}}</p>

<p>
  <a href="{{onboardingUrl}}">Set Up My Pass</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('payment_request', '{{subject}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>You have a payment due to Starforge for {{description}}.</p>

<p><strong>Total due: ${{total}}</strong></p>

<p>
  You can see what the charge covers and pay with a card here:
  <a href="{{paymentUrl}}">Pay Now</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
