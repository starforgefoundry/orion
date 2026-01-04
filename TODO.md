# P1

- OTHER
  - Send payment pickup notification
  - Allow editing of quantities in print request
  - CF turnstile on print request form
  - Confirm movement to Done Column and send notification
  - Show payment status in print request list
  - Rename "Done" to "ready for pickup" in UI
    - Add "picked up" button to print request UI
  - Add "external" button to print request payment to link to invoice in Square Dashboard
  - Print Request Table
  - Make selects in settings panel for square IDs

---

# P2

- ** GROUP BILLING **
  - Allow creating groups in admin panel
  - Keep track of balance owed by group
- ** GROUP/DISCOUNT CODES **
  - Allow creating discount codes in admin panel
  - Link discount codes to groups
  - Apply discount codes to print requests

## P2 Info

- Billing Codes Table
  - id: string (primary key)
  - code: string (unique billing code)
  - description: string
  - groupId: string (references Group ID for group billing)
  - discountId: string (references Discount ID for billing code discount)

- Group Table
  - id: string (primary key)
  - name: string
  - memberPricing: boolean (if true, members get discounted pricing)
