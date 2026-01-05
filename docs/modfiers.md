# Modifiers on Square Sandbox

For some stupid reason, modifiers made on the Square Sandbox Dashboard do no appear in the API. Thus, we need to manually create them for use.

```bash
curl https://connect.squareupsandbox.com/v2/catalog/batch-upsert \
  -X POST \
  -H 'Square-Version: 2025-10-16' \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
    "idempotency_key": "unique-idempotency-key-12345",
    "batches": [
      {
        "objects": [
          {
            "id": "#print-request-modifiers",
            "type": "MODIFIER_LIST",
            "modifier_list_data": {
              "name": "Print Request Modifiers",
              "allow_quantities": true,
              "min_selected_modifiers": 0,
              "modifiers": [
                {
                  "id": "#additional-build-plate",
                  "type": "MODIFIER",
                  "modifier_data": {
                    "name": "Additional Build Plate",
                    "price_money": {
                      "amount": 500,
                      "currency": "USD"
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    ]
  }'
```
