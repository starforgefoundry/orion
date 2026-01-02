- Billing
  - Payments table
    - id: string (primary key)
    - issuedDate: timestamp
    - status: enum('quote', 'pending', 'paid', 'canceled')
    - total: number (in cents)
    - groupId: string (references Group ID for group billing), null if individual
    - squareId: string (references Square invoice ID), null if charged to group account

  - NOTE: when print request gets canceled, change invoice status to 'canceled'
  - groupId and squareId will be not null for collecting CC payments from groups

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

<!-- - Print Request Settings DONE
  - New table containing settings for print request system
  - Columns:
    - settingKey: string (primary key)
    - settingValue: string
  - Settings:
    - maxFileSizeMB: number
    - allowedFileTypes: string[]
    - Billing:
      - sqLocationId: string (references Square location ID for payments)
      - sqMemberDiscountId: string (references Square discount ID for members)
      - sqPrintRequestItemId: string (references Square item ID for print requests)
      - sqAdditionalBuildPlateModifierId: string (references Square item ID for additional build plates) -->

## Billing Flow

1. User submits print request form
2. Resolve billing config
   a. If billing code provided, check if belongs to group with member pricing
   b. If user belongs to group with member pricing, apply member discount
