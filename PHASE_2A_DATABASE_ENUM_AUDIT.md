# Phase 2A Database and Enum Audit

Audit date: 2026-05-15  
Branch: `phase-2-database-enums-foundation`  
Mode: audit only. No schema or migration changes were made in this phase.

## 1. Executive Summary

Phase 1 security hardening is present in the current schema: raw Aadhaar and bank account fields are marked deprecated, masked/hash fields exist, Redis OTP is supported through an `OtpVerification` audit model, and the schema validates after prior work.

The database is still not ready for Phase 3 modular refactoring or new procurement modules. The current Prisma schema contains a useful prototype core, but most foundation models and enums required by the master documentation are still absent. Existing workflows also rely heavily on lower-case enums and plain string status fields, which creates audit and state-transition risk.

Phase 2B should add core enums and foundation models only. It should avoid replacing existing lower-case/string status fields immediately because current backend/frontend code depends on them.

Important source note: the prompt references `docs/MSME_PugArch_Master_Technical_Documentation.md`, but this workspace currently contains `doc/MSME_PugArch_Master_Technical_Documentation.pdf` and `.docx`; no markdown copy was found in `docs/` or `doc/` during this audit.

## 2. Existing Schema Status

| Model | Existing Fields Summary | Existing Relations | Indexes/Constraints | Status Field | Sensitive Fields | Safe To Extend? | Key Gaps |
|---|---|---|---|---|---|---|---|
| User | id, name, email, userId, password, role, registration/onboarding status, verification/2FA/login lock/session fields, timestamps | Profiles, tenders, bids, payments, escrow, messages, disputes, grievances, files, audit, idempotency | email unique, userId unique, role/onboarding index, mobile index | `registrationStatus` enum lower-case, `onboardingStatus` enum lower-case | password | YES | Missing `UserStatus`, `UserSession`, Organization relation, DB Role relation. |
| BuyerProfile | organization fields, PAN/GST masked/fingerprint, Aadhaar deprecated/masked/hash, address/procurement JSON-ish fields | User | unique userId, unique fingerprints, hash indexes | none dedicated | PAN/GST raw, deprecated Aadhaar | YES | Missing optional `organizationId`, VerificationStatus, OrganizationType enum, normalized documents. |
| SellerProfile | organization type, PAN, business details, MSME/product fields, deprecated Aadhaar/masked/hash, documents JSON | User, offices, bank accounts | unique userId/PAN/fingerprints, hash indexes | string fields for organization/MSME/catalog | PAN raw, deprecated Aadhaar | YES | Missing optional `organizationId`, `SellerDocument`, OrganizationType/MSMECategory/VerificationStatus enum fields. |
| SellerOffice | GST office data and address | SellerProfile | sellerProfileId, gstFingerprint | `type` string | GST raw | YES | Missing VerificationStatus, Organization relation optional. |
| SellerBankAccount | IFSC, bank details, masked/hash/fingerprint, deprecated nullable accountNumber | SellerProfile | sellerProfileId, bankFingerprint, accountNumberHash unique | verification boolean | deprecated accountNumber | YES | Should eventually remove raw accountNumber and use verification status enum. |
| FileAsset | owner, ownerRole, entityType/entityId, storage provider, key/url, mime, checksum, status | User owner | ownerId, entityType/entityId, checksum, status | `status` string | URL/key can be sensitive | YES | Missing FileStatus/StorageProvider enums, document/evidence typed relations, expiry/access policy. |
| Tender | buyer, tenderId, title/category/budget/description/documentUrl, status, closesAt | Buyer User, bids, auction, conversations, POs | tenderId unique, buyer/status, createdAt | `TenderStatus` lower-case/incomplete | documentUrl may expose files | YES | Missing items, documents, participants, categoryId, requirementId, organizationId, published/closed/awarded metadata. |
| Bid | tender, seller, unit price/quantity/delivery/warranty/validity/document, status string | Tender, Seller User, PO | tenderId/sellerId unique, seller/status, tender/status | `status String` unsafe | documentUrl/file IDs | YES | Missing BidStatus enum, bidNumber, BidItem, file relation, modifiedAt. |
| Auction | tender, start/current bid, min decrement, times, status string, winner | Tender, winner User, auction bids | tenderId unique, status/endTime, winner | `status String` unsafe | none direct | YES | Missing AuctionStatus enum field, currentLowestBid/currentWinnerId alias, finalization job metadata. |
| AuctionBid | auction, seller, bid amount, IP/device/user-agent hash | Auction, Seller User | auction/createdAt, auction/bidAmount, seller/createdAt | none | IP/device metadata | YES | Consider race uniqueness and participant relation later. |
| QuoteRequest | buyer, seller, subject/message/documentUrl/status | Buyer User, Seller User | buyer/status, seller/status | `status String` unsafe | documentUrl | YES | Missing QuoteResponse, requirement relation, status enum, expiry fields. |
| PurchaseOrder | PO number, tender, bid, buyer, seller, amount/total/status, delivery metadata, version | Tender, Bid, Buyer/Seller User, delivery, inspection, invoices, payments, escrow | poNumber unique, bidId unique, buyer/status, seller/status, tender | `status String` unsafe | delivery address | YES | Missing POStatus enum field, PO items, source fields, pdf file, contract relation. |
| Invoice | invoice number, PO, buyer/seller, amount/status/version/fileAssetId | PO, buyer/seller users, payments | invoiceNumber unique, PO/status, seller/status, buyer/status | `status String` unsafe | fileAssetId | YES | Missing InvoiceStatus enum, InvoiceItem, tax/TDS fields, file relation. |
| PaymentTransaction | references/gateway/method/order/payment IDs/signature status/idempotency, invoice/PO/payer/payee/amount/status | Invoice, PO, payer/payee users, escrow, ledger | multiple gateway/payment unique indexes and role/status indexes | `status String`, gateway/method strings unsafe | provider references | YES | Missing PaymentStatus, PaymentGateway, PaymentMethod enum fields; buyer/seller naming aliases optional. |
| EscrowAccount | payment/PO/buyer/seller/amount/status/version/fund/freeze/release dates | Payment, PO, buyer/seller users, milestones, transactions | buyer/status, seller/status, PO | `status String` unsafe | none direct | YES | Missing EscrowStatus enum, MilestonePayment. |
| AuditLog | userId, action, entityType/entityId, details, createdAt | User | none beyond PK | none | details may contain masked metadata | YES | Missing first-class actorRole/ip/userAgent/requestId indexes. |
| Notification | userId/title/message/type/isRead/createdAt | no User relation declared | userId/isRead, createdAt | type string | message content | YES | Missing User relation and NotificationLog. |
| LoginEvent | user/ip/userAgent/device/city/state/success/reason | User | userId, deviceHash, createdAt | success boolean/reason string | IP/userAgent | YES | Good baseline; may add requestId and country later. |
| IdempotencyKey | key/user/route/requestHash/responseHash/body/status/expires/timestamps | User | compound unique key/user/route, expiresAt | `status String` unsafe | response body must remain masked | YES | Good baseline; add enum status later if needed. |

Other existing models not in the Phase 2A short list: `Otp`, `OtpVerification`, `Approval`, `ComplianceViolation`, `PaymentWebhookEvent`, `FinancialLedgerEntry`, `DeliveryWorkflow`, `InspectionRecord`, `EscrowTransaction`, `Milestone`, `MilestoneApproval`, `Conversation`, `Message`, `MessageAttachment`, `Dispute`, `DisputeMessage`, `DisputeEvidence`, `GrievanceTicket`, `GrievanceComment`, `GrievanceAttachment`, `GstCache`.

## 3. Missing Foundation Models

| Model | Current Status | Risk | Why It Matters | Phase Recommendation |
|---|---|---|---|---|
| Organization | MISSING | BLOCKER | Needed for buyer/seller ownership boundary and enterprise onboarding. | Add in 2B with optional `organizationId` on profiles. |
| UserSession | MISSING | HIGH | Needed for refresh token/session audit beyond sessionVersion. | Add in 2B with hashed refresh token only. |
| Role | MISSING as DB model | MEDIUM | Current role enum works, but docs require DB RBAC. | Add in 2B without replacing enum immediately. |
| Permission | MISSING as DB model | MEDIUM | Required for auditable permission matrix. | Add in 2B. |
| RolePermission | MISSING | MEDIUM | Required DB RBAC join. | Add in 2B. |
| SellerDocument | MISSING | HIGH | Current seller documents are JSON/FileAsset mixed. | Add in 2B, keep JSON temporarily. |
| Category | MISSING | BLOCKER | Required by catalogue, requirements, tenders. | Add in 2C. |
| Product | MISSING | HIGH | Seller catalogue foundation. | Add in 2C. |
| ProductImage | MISSING | MEDIUM | Product file relation. | Add in 2C. |
| ProductSpecification | MISSING | MEDIUM | Structured product specs. | Add in 2C. |
| Service | MISSING | HIGH | Service catalogue foundation. | Add in 2C. |
| Certification | MISSING | MEDIUM | Seller compliance/certificates. | Add in 2C. |
| Requirement | MISSING | BLOCKER | Requirement/direct purchase/RFQ/tender source. | Add in 2C. |
| RequirementItem | MISSING | HIGH | Itemized procurement. | Add in 2C. |
| DirectPurchase | MISSING | HIGH | Required procurement method. | Add in 2C. |
| QuoteResponse | MISSING | HIGH | RFQ response is currently represented as Bid-like flow. | Add in 2C. |
| TenderItem | MISSING | HIGH | Tender itemization. | Add in 2C. |
| TenderDocument | MISSING | HIGH | Secure tender file relation. | Add in 2C. |
| TenderParticipant | MISSING | HIGH | Participation visibility, anti-collusion, “participated” UI state. | Add in 2C. |
| BidItem | MISSING | HIGH | Itemized bid pricing. | Add in 2C. |
| TechnicalEvaluationCriteria | MISSING | HIGH | Technical evaluation workflow. | Add in 2D. |
| TechnicalEvaluationResult | MISSING | HIGH | Technical bid scoring. | Add in 2D. |
| FinancialEvaluation | MISSING | HIGH | Financial scoring and ranking. | Add in 2D. |
| ComparativeStatement | MISSING | HIGH | Government procurement comparison artifact. | Add in 2D. |
| Contract | MISSING | HIGH | Contract management after award. | Add in 2D. |
| PurchaseOrderItem | MISSING | HIGH | PO reconciliation and invoice matching. | Add in 2D. |
| DeliveryTracking | MISSING | MEDIUM | Current `DeliveryWorkflow` is minimal. | Add in 2D; keep old model. |
| DeliveryTrackingEvent | MISSING | MEDIUM | Shipment event history. | Add in 2D. |
| InspectionReport | MISSING | MEDIUM | Current `InspectionRecord` is minimal. | Add in 2D; keep old model. |
| InvoiceItem | MISSING | HIGH | Tax/GST/TDS and payment reconciliation. | Add in 2D. |
| PaymentWebhookEvent | PRESENT/PARTIAL | MEDIUM | Good replay base; no payment relation. | Extend later only if needed. |
| FinancialLedgerEntry | PRESENT/PARTIAL | HIGH | Ledger exists but entry type is string and immutability is app-only. | Add enum in 2D; no destructive change. |
| MilestonePayment | MISSING | HIGH | Escrow release/payment bridge. | Add in 2D. |
| NotificationLog | MISSING | MEDIUM | Delivery audit for email/SMS/in-app notifications. | Add in 2B. |
| ApiLog | MISSING | MEDIUM | API audit/monitoring. | Add in 2B. |
| ComplianceRule | MISSING | HIGH | Rule catalog for compliance flags. | Add in 2B. |
| ComplianceViolation | PRESENT/PARTIAL | HIGH | Exists, but severity/status are strings and no rule/entity relation. | Extend after ComplianceRule. |
| FraudAlert | MISSING | HIGH | Fraud/collusion alert workflow. | Add in 2B. |
| ApiVerificationLog | MISSING | MEDIUM | PAN/GST/Udyam/bank provider audit. | Add in 2B. |
| SupplierRating | MISSING | MEDIUM | Post-delivery seller rating. | Add in 2D. |
| BuyerRating | MISSING | MEDIUM | Buyer behavior rating. | Add in 2D. |

## 4. Missing Enums

| Enum | Current Representation | Status | Risk | Recommendation |
|---|---|---|---|---|
| UserStatus | absent | MISSING | HIGH | Add in 2B; add optional User.status later or in 2B. |
| OrganizationType | profile string fields | MISSING | HIGH | Add in 2B; use on Organization first. |
| VerificationStatus | booleans/strings | MISSING | HIGH | Add in 2B; use on Organization/SellerDocument/Api logs. |
| OnboardingStatus | lower-case Prisma enum | PARTIAL | HIGH | Add canonical enum is name-conflicting; either rename old enum or add `OnboardingStatusV2`. Phase 2B must choose carefully. |
| MSMECategory | SellerProfile.msmeCategory string | MISSING | MEDIUM | Add in 2B, use as parallel optional field later. |
| ProcurementMethod | strings/arrays | MISSING | HIGH | Add in 2B for Organization/Requirement foundation. |
| TenderStatus | lower-case incomplete enum | PARTIAL | HIGH | Existing code uses lower-case values; add parallel `statusEnum` in 2C or map carefully. |
| BidStatus | string | MISSING | HIGH | Add in 2C as parallel field. |
| AuctionStatus | string | MISSING | MEDIUM | Add in 2C as parallel field. |
| POStatus | string | MISSING | HIGH | Add in 2D as `poStatus` parallel field. |
| InvoiceStatus | string | MISSING | HIGH | Add in 2D as `invoiceStatus` parallel field. |
| PaymentStatus | string | MISSING | HIGH | Add in 2D as `paymentStatus` parallel field. |
| EscrowStatus | string | MISSING | HIGH | Add in 2D as `escrowStatus` parallel field. |
| DeliveryStatus | string | MISSING | MEDIUM | Add in 2D. |
| InspectionStatus | string | MISSING | MEDIUM | Add in 2D. |
| DisputeStatus | string | MISSING | MEDIUM | Add in 2D as parallel field if safe. |
| GrievanceStatus | string | MISSING | MEDIUM | Add in 2D as parallel field if safe. |
| ApprovalStatus | strings | MISSING | MEDIUM | Add in 2B. |
| ProductStatus | absent | MISSING | HIGH | Add in 2B/2C; use in catalogue. |
| CategoryType | absent | MISSING | HIGH | Add in 2B/2C; use in Category. |
| PricingModel | absent | MISSING | MEDIUM | Add in 2B/2C; use in Service. |
| PaymentMethod | PaymentTransaction.method string | MISSING | MEDIUM | Add in 2B; use parallel later. |
| PaymentGateway | PaymentTransaction.gateway string | MISSING | MEDIUM | Add in 2B; use parallel later. |
| FileStatus | FileAsset.status string | MISSING | MEDIUM | Add in 2B; use parallel or migrate later. |
| StorageProvider | FileAsset.storageProvider string | MISSING | MEDIUM | Add in 2B; use parallel or migrate later. |
| Severity | ComplianceViolation.severity string | MISSING | MEDIUM | Add in 2B; use in ComplianceRule/FraudAlert first. |

## 5. Risk Table

| Item | Risk | Breakage Risk If Added Now | Notes |
|---|---|---|---|
| Canonical uppercase enums with same names as existing lower-case enums | BLOCKER | HIGH | Prisma enum names conflict. Existing `OnboardingStatus` and `TenderStatus` cannot be redefined without migration/code changes. |
| Organization + optional profile organizationId | BLOCKER | LOW | Safe if optional and no backfill requirement yet. |
| Category/Requirement/TenderItem/TenderParticipant | BLOCKER | LOW-MEDIUM | Safe as new models; relations must be optional when extending existing models. |
| UserSession | HIGH | LOW | Safe new model; do not switch token logic yet. |
| SellerDocument | HIGH | LOW | Safe new model; keep `documents Json?`. |
| Financial itemization models | HIGH | LOW-MEDIUM | Safe if new models and optional relations. |
| Replacing existing status strings immediately | HIGH | HIGH | Do not do in 2B/2C/2D. Add parallel enum fields first. |
| Removing raw/deprecated sensitive columns | HIGH | HIGH | Do not remove until data cleanup/backfill is complete. |
| DB RBAC models | MEDIUM | LOW | Safe as additive models; keep current enum role code. |
| ApiLog/NotificationLog/ApiVerificationLog | MEDIUM | LOW | Safe additive models. |

## 6. Safe Migration Order

### Step 1: Phase 2B Core Foundation

Add non-conflicting enums first:

- `UserStatus`
- `OrganizationType`
- `VerificationStatus`
- `MSMECategory`
- `ProcurementMethod`
- `ApprovalStatus`
- `ProductStatus`
- `CategoryType`
- `PricingModel`
- `StorageProvider`
- `FileStatus`
- `Severity`
- `PaymentGateway`
- `PaymentMethod`

For conflicting canonical enums:

- Existing `OnboardingStatus` is lower-case and used by code. Recommended safe path: keep it for now and add a parallel canonical enum under a distinct temporary name such as `OnboardingStatusV2` only if Phase 2B needs it immediately. Alternatively defer canonical replacement to a dedicated status migration.
- Existing `TenderStatus` is lower-case and used by code. Defer canonical replacement to Phase 2C with a parallel field like `statusEnum`.

Add models:

- `Organization`
- `UserSession`
- `Role`
- `Permission`
- `RolePermission`
- `SellerDocument`
- `ApiVerificationLog`
- `NotificationLog`
- `ApiLog`
- `ComplianceRule`
- `FraudAlert`

Extend existing models safely:

- `BuyerProfile.organizationId Int?`
- `SellerProfile.organizationId Int?`
- `User.organizationId Int?` only if useful for initial organization membership; otherwise use profile relations first.
- Add relation arrays to `User`, `FileAsset`, and related models only where Prisma requires opposite relations.

### Step 2: Phase 2C Procurement/Catalogue Foundation

Add procurement/catalogue enums and models:

- `BidStatus`, `AuctionStatus`, `ParticipantStatus`, `RequirementStatus`, `DirectPurchaseStatus`, `QuoteRequestStatus`, `QuoteResponseStatus`
- `Category`, `Product`, `ProductImage`, `ProductSpecification`, `Service`, `Certification`
- `Requirement`, `RequirementItem`, `DirectPurchase`, `QuoteResponse`
- `TenderItem`, `TenderDocument`, `TenderParticipant`, `BidItem`

Extend existing models with optional fields only:

- `Tender.categoryId?`, `Tender.requirementId?`, `Tender.organizationId?`, `Tender.statusEnum?`, `publishedAt?`, `closedAt?`, `awardedBidId?`
- `Bid.bidNumber?`, `Bid.statusEnum?`, `modifiedAt?`
- `Auction.statusEnum?`, `currentLowestBid?`, `currentWinnerId?`
- `QuoteRequest.requirementId?`, `statusEnum?`, expiry fields.

### Step 3: Phase 2D Finance/Fulfillment/Evaluation Foundation

Add:

- evaluation, comparative statement, contract, PO item, delivery tracking, inspection report, invoice item, milestone payment, ratings models
- finance/fulfillment enums such as `POStatus`, `DeliveryStatus`, `InspectionStatus`, `InvoiceStatus`, `PaymentStatus`, `EscrowStatus`, `EvaluationStatus`, `ContractStatus`, `ContractType`, `SLAStatus`, `LedgerEntryType`, `MilestoneStatus`, `MilestonePaymentStatus`, `DisputeStatus`, `GrievanceStatus`

Extend existing models with parallel enum fields only:

- `PurchaseOrder.poStatus?`
- `Invoice.invoiceStatus?`
- `PaymentTransaction.paymentStatus?`
- `EscrowAccount.escrowStatus?`
- `Dispute.statusEnum?`
- `GrievanceTicket.statusEnum?`

## 7. Backward Compatibility Strategy

1. Keep existing lower-case `Role`, `RegistrationStatus`, `OnboardingStatus`, and `TenderStatus` until code is migrated.
2. Do not replace existing `status String` fields in `Bid`, `Auction`, `QuoteRequest`, `PurchaseOrder`, `Invoice`, `PaymentTransaction`, `EscrowAccount`, `Dispute`, and `GrievanceTicket`.
3. Add parallel enum fields such as `statusEnum`, `poStatus`, `invoiceStatus`, `paymentStatus`, and `escrowStatus`.
4. New models should use canonical enums where there is no existing production code dependency.
5. Keep deprecated raw sensitive columns but do not read/write/return them. They remain for controlled cleanup migration only.
6. Make all new foreign keys optional when pointing from existing tables to new foundation tables.
7. Seed only system roles, permissions, compliance rules, and category reference data. Do not seed fake users or passwords.
8. Run `npx prisma generate` after every schema change before typecheck.

## 8. Recommended Phase 2B Implementation Scope

Phase 2B should implement only:

1. Non-conflicting core enums:
   - `UserStatus`
   - `OrganizationType`
   - `VerificationStatus`
   - `MSMECategory`
   - `ProcurementMethod`
   - `ApprovalStatus`
   - `ProductStatus`
   - `CategoryType`
   - `PricingModel`
   - `StorageProvider`
   - `FileStatus`
   - `Severity`
   - `PaymentGateway`
   - `PaymentMethod`
2. Core foundation models:
   - `Organization`
   - `UserSession`
   - `Role`
   - `Permission`
   - `RolePermission`
   - `SellerDocument`
   - `ApiVerificationLog`
   - `NotificationLog`
   - `ApiLog`
   - `ComplianceRule`
   - `FraudAlert`
3. Optional relationship fields:
   - `BuyerProfile.organizationId?`
   - `SellerProfile.organizationId?`
4. Seed/reference setup for:
   - system roles
   - permissions
   - role permissions
   - basic compliance rules

Phase 2B should not:

- Replace existing `OnboardingStatus` or `TenderStatus` in-place.
- Convert existing string statuses in working routes.
- Add catalogue, requirement, tender itemization, evaluation, contract, PO item, invoice item, delivery, ratings, analytics, AI, or frontend pages.

## 9. Commands Run

```powershell
git checkout -b phase-2-database-enums-foundation
Get-Content backend\prisma\schema.prisma
Get-Content backend\src\constants\statuses.ts
Get-Content backend\src\constants\roles.ts
Get-Content backend\src\constants\permissions.ts
Get-ChildItem backend\src\types -Recurse -File
Get-ChildItem frontend\src\types -Recurse -File
Get-ChildItem frontend\src\constants -Recurse -File
Get-ChildItem backend\src\modules -Directory
rg -n "status\s+String|status\s+TenderStatus|role\s+Role|registrationStatus|onboardingStatus|gateway\s+String|method\s+String|storageProvider\s+String|severity\s+String|type\s+String" backend\prisma\schema.prisma
```

## 10. Final Phase 2A Verdict

The database foundation is ready for additive Phase 2B work, but not ready for destructive enum/status migration. The safe route is additive: add core foundation tables and non-conflicting enums, then introduce parallel enum fields in later phases while keeping current string/lower-case fields for existing route compatibility.
