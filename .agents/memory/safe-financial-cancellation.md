---
name: Safe financial cancellation
description: The accounting rule for cancelling purchases and shipments without corrupting shared financial history.
---

Purchases and shipments with financial effects must be cancelled by changing their status and writing a compensating wallet entry. Never delete the business record or its original ledger entry.

**Why:** The mobile and web apps share one database and audit history. Destructive cancellation would make historical balances impossible to explain and could create different totals between clients.

**How to apply:** Use explicit cancellation actions with a reason, prevent repeated cancellation, preserve audit records, and block purchase cancellation while it is linked to a shipment.

Ledger responses must expose their purchase and shipment linkage to clients, and clients must use those identifiers when deciding whether a transaction is manually editable.

**Why:** Adjustment entries can have categories different from the original purchase or shipment category. Category-only detection can misclassify a linked adjustment as a manual expense and expose unsafe edit/delete controls.

**How to apply:** Include all financial source identifiers in wallet DTOs and API contracts, and treat any transaction with a payment, purchase, shipment, order, or customer link as source-managed rather than manual.