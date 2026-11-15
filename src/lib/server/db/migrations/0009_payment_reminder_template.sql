INSERT INTO "email_template" ("key", "subject", "body") VALUES ('payment_reminder', 'Payment Reminder: {{itemName}}', $tpl$<h3>Howdy, {{customerName}}!</h3>

<p>This is a reminder that you have a payment due to Starforge for {{itemName}}.</p>

<p><strong>Total due: ${{total}}</strong></p>

<p>
  You can see what the charge covers and pay with a card here:
  <a href="{{paymentUrl}}">Pay Now</a>
</p>

<p>If you have any questions, feel free to reply to this email.</p>

<p>Thanks!</p>

<p>Starforge Foundry</p>
$tpl$);
