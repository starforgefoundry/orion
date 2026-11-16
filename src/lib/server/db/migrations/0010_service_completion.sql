ALTER TABLE "service_request" ADD COLUMN "completion_date" timestamp(3) with time zone;--> statement-breakpoint
INSERT INTO "email_template" ("key", "subject", "body") VALUES ('service_ready', 'Your {{serviceName}} Request is Ready!', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>Your {{serviceName}} request is done and ready for pickup at Starforge!</p>

<p>{{paymentNote}} <a href="{{paymentUrl}}">View Request</a></p>

<p>We are currently open 4-9pm weekdays, noon-9pm weekends.</p>

<p>
  As always, keep an eye on our Discord in the #announcements channel for changes to our hours. If
  you have any issues with pickup or any questions, just reply to this email!
</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
