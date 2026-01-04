# P1

- OTHER
  - DONE Send payment pickup notification
    - DONE Confirm movement to Done Column and send notification
  - DONE Show payment status in print request list
  - DONE Allow editing of quantities in print request
  - DONE Rename "Done" to "ready for pickup" in UI
    - DONE Add "picked up" button to print request UI
  - DONE Add "external" button to print request payment to link to invoice in Square

  Dashboard
  - DONE Print Request Table
  - DONE Make selects in settings panel for square IDs

---

# P2

- Github actions
- CF turnstile on print request form

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
