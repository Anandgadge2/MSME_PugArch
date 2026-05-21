# Route Ownership Matrix

Date: 2026-05-15  
Scope: Phase 1 security foundation hardening. This matrix documents the current baseline for high-risk routes and the next enforcement work. It is intentionally limited to existing modules; no new business modules are introduced in this phase.

| Route | Allowed roles | Ownership rule | Audit event | Current status |
|---|---|---|---|---|
| `GET /api/tenders` | buyer, admin | Buyer sees only `buyerId = user.id`; admin sees all. | `api.write.completed` for writes only | enforced |
| `GET /api/tenders/public` | seller, buyer, admin | Published tenders only; seller receives only own bid participation metadata. | none for read | enforced |
| `GET /api/tenders/:id` | buyer, seller, admin | Buyer must own tender; seller can read published tender; admin can read all. | `security.unauthorized_access` via auth failures | enforced |
| `PUT /api/tenders/:id` | buyer | Buyer can update only own non-final tender. | `tender.modified` | enforced |
| `PUT /api/tenders/:id/status` | buyer, admin | Buyer must own tender; admin override allowed with reason for sensitive transitions. | `tender.status_updated` | enforced |
| `POST /api/tenders/:id/bids` | seller | Seller can bid only on published/open tender; one active bid per tender enforced by DB and route. | `bid.submitted` | enforced |
| `GET /api/bids/:id` | buyer, seller, admin | Seller must own bid; buyer must own bid tender; admin can read all. | none for read | enforced |
| `POST /api/bids/:id/status` | buyer, admin | Buyer must own bid tender; admin can update. | `bid.status_updated`, financial audit for accepted bid | enforced |
| `POST /api/bids/:id/withdraw` | seller | Seller must own bid and tender deadline/stage must allow withdrawal. | `bid.withdrawn` | enforced |
| `GET /api/purchase-orders` | buyer, seller, admin | Buyer sees own POs; seller sees own POs; admin sees all. | none for read | enforced |
| `POST /api/purchase-orders/:id/accept` | seller, admin | Financial service checks seller owns PO; admin can act. | `financial.po_accepted_delivery_created` | enforced |
| `POST /api/purchase-orders/:id/inspection/accept` | buyer, admin | Financial service checks buyer owns PO; admin can act. | `financial.inspection_accepted_invoice_enabled` | enforced |
| `POST /api/purchase-orders/:id/invoices` | seller, admin | Financial service checks seller owns PO; admin can act. | `financial.invoice_submitted` | enforced |
| `GET /api/invoices` | buyer, seller, admin | Buyer sees own invoices; seller sees own invoices; admin sees all. | none for read | enforced |
| `POST /api/invoices/:id/approve` | buyer, admin | Financial service checks buyer owns invoice; admin can act. | `financial.invoice_approved_payment_created` | enforced |
| `GET /api/files/:id/signed-url` | authenticated users, admin | File owner, related entity participant, or admin only. Denied access returns 404. | `file.viewed`, `file.access_denied` | enforced |
| `DELETE /api/files/:id` | owner, admin | File owner or admin only. | `file.deleted`, `file.delete_denied` | enforced |
| `GET /api/payments` | buyer, seller, admin | Payer/payee scoped; admin sees all. | none for read | enforced |
| `POST /api/payments/initiate` | buyer, admin | Payment service checks invoice buyer; idempotency required. | `payment.initiated` | enforced |
| `GET /api/payments/:id/status` | buyer, seller, admin | Payer/payee/admin only. | none for read | enforced |
| `POST /api/payments/webhooks/:gateway` | provider webhook | Signature verification and replay protection; no frontend trust. | `payment.webhook.failed_verification`, `payment.webhook.duplicate_ignored` | enforced |
| `GET /api/utils/gst-verify/:gstin` | authenticated users | GSTIN format validation; strict verification rate limit; provider errors masked. | auth failures audited by middleware | enforced |
| `GET /api/notifications/stream` | authenticated users | Access token and session version checked before SSE registration. | `security.unauthorized_access` on auth failure | enforced |
| `GET /api/vendors/:id` | buyer, admin | Buyer/admin can view approved seller; response masking applies. | none for read | partial |
| `GET /api/quotes/:id` | buyer, seller, admin | Buyer/seller must be quote participants; admin can read. | none for read | enforced |
| `GET /api/conversations/:id` | buyer, seller, admin | Buyer/seller must be participants; admin can read. | none for read | enforced |
| `GET /api/disputes/:id` | buyer, seller, admin | Buyer/seller/raiser/resolver/admin can read. | none for read | enforced |
| `GET /api/grievances/:id` | owner, admin | User sees own grievance; assigned/admin users can act. | none for read | enforced |

## Follow-Up Requirements

1. Add route-level integration tests backed by PostgreSQL fixtures for each high-risk row.
2. Add explicit read audit events for sensitive file, payment, invoice, and admin review reads where audit policy requires it.
3. Convert legacy inline ownership logic into reusable module middleware as routes are moved out of `backend/index.ts`.
4. Add DB-backed permission checks after Role/Permission models are introduced in a later phase.
