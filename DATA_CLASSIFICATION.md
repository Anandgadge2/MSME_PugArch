# Data Classification

## Restricted

Data that must never be exposed in full through API responses or logs:

- passwords and password hashes,
- JWTs, refresh tokens, OTPs,
- Aadhaar numbers,
- full PAN where not strictly required,
- full bank account numbers,
- payment card data, CVV, UPI PIN, net-banking credentials,
- API keys, database URLs, Redis passwords, payment webhook secrets.

## Confidential

Data available only to authorized owners, counterparties, or admins:

- KYC/KYB documents,
- GST/PAN/Udyam verification results,
- tender documents before allowed visibility,
- bid amounts before bid opening,
- invoices, payment references, escrow/milestone records,
- dispute evidence,
- grievance content,
- audit logs and compliance flags.

## Internal

Operational metadata:

- request IDs,
- non-sensitive status values,
- masked identifiers,
- timestamps,
- module health data.

## Public

Only intentionally published tender summaries and public catalogue/search data. Public data must still be rate limited and must not include hidden bid, identity, payment, or document details.

## Handling Rules

- Return masked PAN/GST/Aadhaar/bank values unless raw value is legally required and explicitly authorized.
- Store fingerprints for duplicate detection.
- Store payment gateway references only, not card/bank credentials.
- Log hashes or masked values, not secrets or raw PII.

