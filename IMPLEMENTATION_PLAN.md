# JsgSmile MSME Procurement Portal — Full Implementation Plan

> **Reference documents:** Procurement Approval Flowchart (6-stage), MSME Procurement Marketplace Architecture Diagram  
> **Codebase baseline:** Next.js 15 frontend + Node/Express/Prisma backend on Neon Postgres  
> **Date:** May 2026

---

## Executive Summary

The portal is a **private-sector GeM equivalent** — both buyers and sellers can be any entity (startup, MSME, enterprise, individual). The key architectural shift requested is:

1. **Multi-tenant organisation roles** — within a single company, different users have different roles (Admin, Finance Officer, Procurement Officer, Technical Officer, etc.) with permission-gated access
2. **Cart-based marketplace purchasing** — buyers add to cart, Finance Officer approves, Technical Officer evaluates
3. **Full 6-stage procurement workflow** as per the flowchart
4. **Read-only mode until admin approval** — new registrants can browse but not transact

---

## Part 1 — What Needs to Change in the Current Architecture


### 1.1 Current Role Model (needs upgrade)

**Current state:**
```
enum Role { seller | buyer | admin }
```
One flat role per user. No concept of organisation membership or intra-org roles.

**Problem:** A company (Organisation A) registers as a seller. The owner is the admin of that company. They want to add a Finance Officer who can only approve payments, and a Technical Officer who can only evaluate product specs. Currently impossible — every user is just "seller".

**Required change:** Add an `OrgMembership` model that links a `User` to an `Organization` with an `OrgRole` (intra-org role). The top-level `Role` (buyer/seller/admin) stays for platform-level routing. The `OrgRole` controls what that person can do *within their organisation*.

---

### 1.2 Current Onboarding Flow (needs extension)

**Current state:** One user registers → completes onboarding → platform admin approves → user can transact.

**Required change:**
- First user to register for an organisation becomes the **Org Admin** (owner)
- Org Admin completes the organisation-level KYC/onboarding
- Platform admin (JsgSmile) approves the organisation
- After approval, Org Admin can **invite team members** and assign them OrgRoles
- Invited members log in and see only what their OrgRole permits

---

### 1.3 Current Permission System (needs wiring to UI)

**Current state:** `RbacRole`, `Permission`, `RolePermission` models exist in the DB but are not connected to any frontend gating. The backend `authorize()` middleware only checks the top-level `Role`.

**Required change:** Extend `authorize()` to also check `OrgRole` permissions. Frontend must read the user's effective permissions and hide/show UI elements accordingly.

---

### 1.4 Cart System (missing entirely)

**Current state:** Buyers browse the marketplace and go directly to Direct Purchase or RFQ. No cart.

**Required change:** Add `Cart` and `CartItem` models. Buyer adds items → Finance Officer reviews cart → Technical Officer evaluates specs → Procurement Officer raises PO or RFQ.

---

## Part 2 — Database Schema Changes


### 2.1 New: OrgMembership (intra-organisation roles)

```prisma
enum OrgRole {
  ORG_ADMIN           // Owner / super-admin of the organisation
  PROCUREMENT_OFFICER // Creates requirements, tenders, RFQs, POs
  FINANCE_OFFICER     // Approves payments, reviews invoices, cart checkout
  TECHNICAL_OFFICER   // Evaluates technical bids, product specs, GRN inspection
  LOGISTICS_OFFICER   // Updates delivery status, uploads POD
  VIEWER              // Read-only access to everything in the org
}

model OrgMembership {
  id             Int          @id @default(autoincrement())
  userId         Int
  organizationId Int
  orgRole        OrgRole      @default(VIEWER)
  isActive       Boolean      @default(true)
  invitedById    Int?
  invitedAt      DateTime     @default(now())
  acceptedAt     DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedBy      User?        @relation("OrgMembershipInviter", fields: [invitedById], references: [id])

  @@unique([userId, organizationId])
  @@index([organizationId, orgRole])
  @@index([userId])
}

model OrgInvitation {
  id             Int          @id @default(autoincrement())
  organizationId Int
  email          String
  orgRole        OrgRole
  token          String       @unique
  expiresAt      DateTime
  acceptedAt     DateTime?
  invitedById    Int
  createdAt      DateTime     @default(now())

  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  invitedBy      User         @relation(fields: [invitedById], references: [id])

  @@index([organizationId])
  @@index([token])
  @@index([email])
}
```

**Add to Organization model:**
```prisma
memberships  OrgMembership[]
invitations  OrgInvitation[]
```

---

### 2.2 New: Cart System

```prisma
enum CartStatus {
  ACTIVE
  SUBMITTED_FOR_APPROVAL
  APPROVED
  REJECTED
  CONVERTED_TO_ORDER
  ABANDONED
}

model Cart {
  id             Int        @id @default(autoincrement())
  organizationId Int
  createdById    Int
  status         CartStatus @default(ACTIVE)
  notes          String?
  approvedById   Int?
  approvedAt     DateTime?
  rejectedById   Int?
  rejectedAt     DateTime?
  rejectionNote  String?
  convertedAt    DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  organization   Organization @relation(fields: [organizationId], references: [id])
  createdBy      User         @relation("CartCreator", fields: [createdById], references: [id])
  approvedBy     User?        @relation("CartApprover", fields: [approvedById], references: [id])
  rejectedBy     User?        @relation("CartRejecter", fields: [rejectedById], references: [id])
  items          CartItem[]

  @@index([organizationId, status])
  @@index([createdById])
}

model CartItem {
  id                    Int      @id @default(autoincrement())
  cartId                Int
  productId             Int?
  serviceId             Int?
  sellerId              Int
  itemName              String
  quantity              Decimal  @db.Decimal(18, 3)
  unitOfMeasure         String
  unitPrice             Decimal  @db.Decimal(18, 2)
  currency              String   @default("INR")
  technicalApproved     Boolean?
  technicalApprovedById Int?
  technicalNote         String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  cart                  Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product               Product? @relation(fields: [productId], references: [id])
  service               Service? @relation(fields: [serviceId], references: [id])
  seller                User     @relation("CartItemSeller", fields: [sellerId], references: [id])
  technicalApprovedBy   User?    @relation("CartItemTechApprover", fields: [technicalApprovedById], references: [id])

  @@index([cartId])
  @@index([productId])
  @@index([sellerId])
}
```


### 2.3 New: Multi-Level Approval Workflow (Stage 4 of flowchart)

```prisma
enum ApprovalStage {
  DEPARTMENT_HEAD
  FINANCE_DEPT
  PROCUREMENT_HEAD
}

enum ApprovalDecision {
  PENDING
  APPROVED
  REJECTED
  SENT_FOR_CLARIFICATION
}

model ProcurementApproval {
  id              Int              @id @default(autoincrement())
  entityType      String           // 'tender' | 'purchase_order' | 'cart' | 'direct_purchase'
  entityId        Int
  organizationId  Int
  stage           ApprovalStage
  decision        ApprovalDecision @default(PENDING)
  approverId      Int?
  remarks         String?
  clarificationNote String?
  decidedAt       DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  organization    Organization     @relation(fields: [organizationId], references: [id])
  approver        User?            @relation(fields: [approverId], references: [id])

  @@index([entityType, entityId])
  @@index([organizationId, stage])
  @@index([approverId])
}
```

### 2.4 New: Goods Receipt Note (GRN)

```prisma
enum GrnStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  PARTIAL
}

model GoodsReceiptNote {
  id              Int       @id @default(autoincrement())
  grnNumber       String    @unique
  purchaseOrderId Int
  receivedById    Int
  organizationId  Int
  status          GrnStatus @default(DRAFT)
  receivedAt      DateTime  @default(now())
  remarks         String?
  inspectionNote  String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  receivedBy      User          @relation(fields: [receivedById], references: [id])
  organization    Organization  @relation(fields: [organizationId], references: [id])
  items           GrnItem[]
  documents       GrnDocument[]

  @@index([purchaseOrderId])
  @@index([organizationId])
  @@index([status])
}

model GrnItem {
  id              Int              @id @default(autoincrement())
  grnId           Int
  purchaseOrderItemId Int?
  itemName        String
  orderedQty      Decimal          @db.Decimal(18, 3)
  receivedQty     Decimal          @db.Decimal(18, 3)
  acceptedQty     Decimal          @db.Decimal(18, 3)
  rejectedQty     Decimal          @db.Decimal(18, 3)
  rejectionReason String?
  unitOfMeasure   String
  createdAt       DateTime         @default(now())

  grn             GoodsReceiptNote @relation(fields: [grnId], references: [id], onDelete: Cascade)

  @@index([grnId])
}

model GrnDocument {
  id          Int              @id @default(autoincrement())
  grnId       Int
  fileAssetId Int
  documentType String
  createdAt   DateTime         @default(now())

  grn         GoodsReceiptNote @relation(fields: [grnId], references: [id], onDelete: Cascade)
  fileAsset   FileAsset        @relation(fields: [fileAssetId], references: [id])

  @@index([grnId])
}
```


---

## Part 3 — Backend API Changes

### 3.1 New: Organisation Team Management Endpoints

```
POST   /api/org/invite                    — Org Admin sends invite email with token
GET    /api/org/invitations               — List pending invitations (Org Admin)
DELETE /api/org/invitations/:id           — Cancel invitation
POST   /api/org/accept-invite             — Invited user accepts (token in body)
GET    /api/org/members                   — List all members with their OrgRole
PUT    /api/org/members/:userId/role      — Change a member's OrgRole (Org Admin only)
DELETE /api/org/members/:userId           — Remove member from org
GET    /api/org/members/:userId/activity  — Audit trail for a member
```

### 3.2 New: Cart Endpoints

```
GET    /api/cart                          — Get active cart for current user's org
POST   /api/cart/items                    — Add item to cart { productId/serviceId, quantity }
PUT    /api/cart/items/:id                — Update quantity
DELETE /api/cart/items/:id                — Remove item
POST   /api/cart/submit                   — Submit cart for Finance Officer approval
POST   /api/cart/:id/approve              — Finance Officer approves cart
POST   /api/cart/:id/reject               — Finance Officer rejects with note
POST   /api/cart/items/:id/tech-approve   — Technical Officer approves a line item
POST   /api/cart/items/:id/tech-reject    — Technical Officer rejects a line item with note
POST   /api/cart/:id/convert              — Procurement Officer converts approved cart to PO/RFQ/Direct Purchase
```

### 3.3 New: GRN Endpoints

```
POST   /api/grn                           — Create GRN for a PO (Logistics/Technical Officer)
GET    /api/grn                           — List GRNs for org
GET    /api/grn/:id                       — GRN detail
PUT    /api/grn/:id                       — Update GRN (before submission)
POST   /api/grn/:id/submit                — Submit GRN for approval
POST   /api/grn/:id/approve               — Finance/Procurement Officer approves GRN → triggers payment
POST   /api/grn/:id/reject                — Reject GRN with reason
POST   /api/grn/:id/documents             — Upload delivery proof, photos
```

### 3.4 New: Multi-Level Approval Endpoints

```
GET    /api/approvals/pending             — List items pending my approval (role-filtered)
POST   /api/approvals/:id/approve         — Approve with remarks
POST   /api/approvals/:id/reject          — Reject with reason
POST   /api/approvals/:id/clarify         — Send back for clarification
GET    /api/approvals/history             — Full approval trail for org
```

### 3.5 Changes to Existing Endpoints

**Tender creation** — add `organizationId` from the user's org membership. Add approval workflow trigger after tender draft is created (goes to Dept Head → Finance → Procurement Head before publishing).

**Purchase Order** — after PO is generated, create `ProcurementApproval` records for each required stage. PO is only sent to seller after all stages pass.

**Payment** — payment initiation requires Finance Officer role. Add check: `requireOrgRole(req, 'FINANCE_OFFICER', 'ORG_ADMIN')`.

**Middleware: `requireOrgRole()`** — new middleware that checks `OrgMembership` for the current user and validates they have the required OrgRole for the action.

### 3.6 Read-Only Mode Enforcement

Add middleware `requireApprovedOrg()` that:
- Checks `Organization.verificationStatus === 'APPROVED'`
- If not approved: allows GET requests, blocks all POST/PUT/DELETE with `403 { code: 'ORG_PENDING_APPROVAL', message: 'Your organisation is pending platform approval. You have read-only access.' }`
- Applied to all transactional routes (cart, tender, PO, payment, etc.)


---

## Part 4 — Frontend Changes

### 4.1 Registration & Onboarding Flow (revised)

**Step 1 — Organisation Registration (new screen)**
```
/register → Choose: "I am a Buyer Organisation" | "I am a Seller Organisation" | "I am an Individual"
```
- Organisation name, type (Startup / MSME / Enterprise / Individual)
- GST/PAN/CIN validation (existing API)
- First user becomes ORG_ADMIN automatically
- After submit → pending platform approval

**Step 2 — KYC Upload (existing, enhanced)**
- Documents upload (existing flow)
- Bank verification (existing)
- For sellers: category selection, catalogue setup

**Step 3 — Platform Admin Approval (existing AdminOnboarding page)**
- No change needed here — admin reviews and approves

**Step 4 — Post-Approval: Team Setup (NEW page)**
```
/org/team
```
- ORG_ADMIN sees a team management page
- Can invite members by email
- Assigns OrgRole to each invite
- Invited user receives email → clicks link → registers/logs in → joins org

### 4.2 New Pages Required

| Page | Path | Who sees it | What it does |
|------|------|-------------|--------------|
| Team Management | `/org/team` | ORG_ADMIN | Invite, list, edit, remove members |
| Accept Invitation | `/invite/accept?token=xxx` | Invitee | Accept org invite, set password |
| Cart | `/cart` | Buyer (any OrgRole) | View cart, add/remove items |
| Cart Approval | `/cart/approvals` | FINANCE_OFFICER | Review and approve/reject submitted carts |
| Technical Review | `/cart/technical-review` | TECHNICAL_OFFICER | Approve/reject individual line items |
| Approval Queue | `/approvals` | FINANCE_OFFICER, PROCUREMENT_OFFICER, ORG_ADMIN | All pending approvals in one place |
| GRN Management | `/grn` | LOGISTICS_OFFICER, TECHNICAL_OFFICER | Create and manage GRNs |
| GRN Detail | `/grn/:id` | All org members | View GRN detail, approve/reject |
| Seller Delivery Mgmt | `/seller/delivery-management` | Seller LOGISTICS_OFFICER | Update delivery status, upload POD |
| Disputes (real) | `/disputes` | All | Full dispute thread UI |
| Messages (real) | `/messages` | All | Conversation threads |
| Tender Evaluation | `/buyer/tenders/:id/evaluate` | TECHNICAL_OFFICER, PROCUREMENT_OFFICER | TEC/FEC scoring |
| Auction Live | `/auctions/:id/live` | Buyer + Sellers | Real-time reverse auction |
| Contract View | `/contracts/:id` | Buyer + Seller | Contract terms, status |
| Org Settings | `/org/settings` | ORG_ADMIN | Org profile, approval workflow config |
| Security Settings | `/settings/security` | All | 2FA, sessions, password |
| Notification Prefs | `/settings/notifications` | All | Channel preferences |

### 4.3 Marketplace — Add to Cart Flow

**Current flow:** Browse → Direct Purchase / RFQ  
**New flow:** Browse → Add to Cart → Cart Review → Submit for Approval → Finance Approves → Tech Approves → Procurement converts to PO/RFQ

**Changes to CataloguePage:**
- Replace "Purchase / Bid" button with "Add to Cart" button
- Cart icon in header with item count badge
- Cart drawer (slide-in) showing current items with quantity controls

**Cart page (`/cart`):**
- Table of items: product name, seller, qty, unit price, total, tech approval status
- "Submit for Finance Approval" button (only if all items have tech approval OR org skips tech review)
- Notes field for the Finance Officer

**Cart Approval page (`/cart/approvals`) — Finance Officer view:**
- List of submitted carts from team members
- Each cart: who submitted, when, total value, items
- Approve / Reject / Request clarification buttons
- On approval → cart moves to Procurement Officer

**Technical Review page (`/cart/technical-review`) — Technical Officer view:**
- List of cart items needing technical evaluation
- Per item: product specs, certifications, seller details
- Approve / Reject each line item with notes
- Can view product documents/images

### 4.4 Role-Aware Navigation (Sidebar)

The sidebar must show only what the user's OrgRole permits:

| Sidebar Item | ORG_ADMIN | PROCUREMENT_OFFICER | FINANCE_OFFICER | TECHNICAL_OFFICER | LOGISTICS_OFFICER | VIEWER |
|---|---|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Marketplace | ✓ | ✓ | ✓ (view) | ✓ (view) | ✗ | ✓ (view) |
| Cart | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ (view) |
| Cart Approvals | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Technical Review | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Requirements | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ (view) |
| Tenders | ✓ | ✓ | ✗ | ✓ (eval) | ✗ | ✓ (view) |
| RFQ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ (view) |
| Purchase Orders | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ (view) |
| GRN | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (view) |
| Invoices | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ (view) |
| Payments | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ (view) |
| Escrow | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ (view) |
| Delivery | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ (view) |
| Disputes | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (view) |
| Approval Queue | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Team Management | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Org Settings | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |


### 4.5 Dashboard — Role-Aware Action Cards

Each OrgRole sees a different dashboard:

**ORG_ADMIN dashboard:**
- Org approval status banner (if pending)
- Team members count + pending invites
- Pending approvals count (all types)
- Total spend this month
- Active tenders, open POs, overdue payments

**PROCUREMENT_OFFICER dashboard:**
- My requirements (draft/submitted)
- Active tenders closing soon
- POs awaiting my action
- Pending RFQ responses

**FINANCE_OFFICER dashboard:**
- Carts pending my approval (count + total value)
- Invoices pending approval
- Payments due in next 7 days
- Overdue payments (>45 days — MSME Act flag)
- Escrow accounts held

**TECHNICAL_OFFICER dashboard:**
- Cart items pending technical review
- Tenders in evaluation stage
- GRNs pending inspection
- Certifications expiring soon (for seller side)

**LOGISTICS_OFFICER dashboard:**
- Active deliveries (in-transit count)
- Deliveries due today
- GRNs to create
- Overdue deliveries

**VIEWER dashboard:**
- Read-only summary of org activity
- Recent transactions
- No action buttons

---

## Part 5 — The 6-Stage Procurement Workflow (Full Implementation)

### Stage 1: Requirement & Publishing

**What exists:** Requirements module (CRUD + submit), Tender creation, RFQ creation, Direct Purchase  
**What's missing:**
- Requirement must go through internal approval before a tender is published
- Tender draft → Dept Head approval → Finance approval → Procurement Head approval → Publish
- Currently tenders can be published directly by any buyer

**Changes needed:**
1. After `POST /api/buyer/requirements/:id/submit`, create `ProcurementApproval` records for the org's configured approval chain
2. Tender `publish` endpoint must check all approval stages are `APPROVED` before allowing publish
3. Frontend: Requirement detail shows approval chain status with each approver's decision

### Stage 2: Vendor Bidding & Submission

**What exists:** Tender publish, bid submission, sealed bids, deadline enforcement  
**What's missing:**
- Seller notification via SMS (currently only in-app + email)
- Pre-bid query window (sellers ask questions, buyer posts clarifications)
- Corrigendum (tender amendment with version number)
- Bid security / EMD collection

**Changes needed:**
1. Add `TenderQuery` model: sellers submit questions during query window, buyer posts public answers
2. Add `TenderCorrigendum` model: amendment with version, auto-extends deadline
3. Add `BidSecurity` model: EMD amount, payment reference, refund status
4. Frontend: Tender detail page shows Q&A section, corrigendum history

### Stage 3: Evaluation (Two-Bid System)

**What exists:** `TechnicalEvaluationCriteria`, `TechnicalEvaluationResult`, `FinancialEvaluation`, `ComparativeStatement` models in DB  
**What's missing:** Entire frontend for evaluation

**Changes needed:**
1. **Tender Evaluation Page** (`/buyer/tenders/:id/evaluate`):
   - Tab 1: Technical Bid Opening — list of bids, Technical Officer scores each against criteria
   - Tab 2: Financial Bid Opening — only shown after tech evaluation complete, shows financial bids of technically qualified vendors
   - Tab 3: L1/L2/L3 Ranking — auto-calculated table sorted by total cost
   - Tab 4: Comparative Statement — printable summary
2. Backend: `POST /api/tenders/:id/tech-evaluate` — submit scores for a bid
3. Backend: `POST /api/tenders/:id/open-financial-bids` — unlock financial bids (admin/procurement head only)
4. Backend: `GET /api/tenders/:id/ranking` — return L1/L2/L3 sorted list

### Stage 4: Multi-Level Approval Workflow

**What exists:** Nothing — approvals are currently single-step (buyer awards directly)  
**What's missing:** Entire approval chain

**Changes needed:**
1. After L1 is selected, create approval chain:
   - Stage 1: Department Head (PROCUREMENT_OFFICER with dept head flag)
   - Stage 2: Finance Department (FINANCE_OFFICER)
   - Stage 3: Procurement Head / ORG_ADMIN
2. Each approver gets a notification and sees the item in their Approval Queue
3. Any approver can reject (goes back to start) or send for clarification
4. Only after all stages pass does the system auto-generate the PO
5. Frontend: Approval Queue page (`/approvals`) — unified inbox for all pending approvals

### Stage 5: PO Generation & Acceptance

**What exists:** PO generation, seller acknowledgement, contract model  
**What's missing:**
- PO is currently generated without multi-level approval
- No contract document generated
- Seller rejection → reassignment flow

**Changes needed:**
1. PO generation is triggered automatically after Stage 4 final approval
2. Auto-generate `Contract` record linked to PO
3. If seller rejects PO: notify buyer, offer to reassign to L2 vendor
4. Frontend: PO detail shows contract link, approval trail

### Stage 6: Fulfillment & Settlement

**What exists:** Delivery tracking (backend complete), invoicing, payments, escrow  
**What's missing:**
- Seller delivery management UI (seller can't update delivery status)
- GRN creation UI
- 3-way match (PO + GRN + Invoice) before payment release
- T+1 settlement split engine (platform commission deduction)

**Changes needed:**
1. **Seller Delivery Management page** (`/seller/delivery-management`):
   - List of active POs with delivery status
   - Update status: Allocated → Dispatched → In Transit → Delivered
   - Upload: e-way bill, delivery challan, POD photos
   - Add tracking number + logistics partner
2. **GRN page** (`/grn`):
   - Buyer/Logistics Officer creates GRN after receiving goods
   - Line-by-line: ordered qty vs received qty vs accepted qty
   - Upload: photos, inspection report
   - Submit → Technical Officer inspects → approves → triggers invoice
3. **3-way match check** in payment approval:
   - Backend: before releasing payment, verify PO exists + GRN approved + Invoice matches PO amount
   - If mismatch: flag for Finance Officer review
4. **Settlement split** (T+1):
   - After payment gateway confirms: split into seller payout (after TDS/GST) + platform commission
   - Platform commission goes to admin corporate account
   - Final tax invoice generated for both parties


---

## Part 6 — Missing UI Pages (Priority Order)

### P1 — Breaks live transactions today

| # | Page | Path | Effort | Notes |
|---|------|------|--------|-------|
| 1 | Seller Delivery Management | `/seller/delivery-management` | 3 days | Backend complete, just needs UI |
| 2 | GRN Creation & Approval | `/grn`, `/grn/:id` | 3 days | New backend + UI |
| 3 | Disputes Real UI | `/disputes`, `/disputes/:id` | 2 days | Backend complete |
| 4 | Messages / Conversations | `/messages` | 2 days | Backend complete |
| 5 | Inspection / GRN link | Integrated into GRN | — | Replaces current stub |

### P2 — Completes the procurement workflow

| # | Page | Path | Effort | Notes |
|---|------|------|--------|-------|
| 6 | Cart | `/cart` | 2 days | New backend + UI |
| 7 | Cart Approval (Finance) | `/cart/approvals` | 1 day | Depends on Cart |
| 8 | Technical Review | `/cart/technical-review` | 1 day | Depends on Cart |
| 9 | Approval Queue | `/approvals` | 2 days | New backend + UI |
| 10 | Tender Evaluation | `/buyer/tenders/:id/evaluate` | 3 days | Models exist, needs UI |
| 11 | Team Management | `/org/team` | 2 days | New backend + UI |
| 12 | Accept Invitation | `/invite/accept` | 1 day | Depends on Team Mgmt |

### P3 — Improves usability significantly

| # | Page | Path | Effort | Notes |
|---|------|------|--------|-------|
| 13 | Role-aware Dashboard | `/dashboard` | 2 days | Upgrade existing |
| 14 | Auction Live Bidding | `/auctions/:id/live` | 3 days | Backend complete |
| 15 | Contract View | `/contracts/:id` | 1 day | Model exists |
| 16 | Admin MIS Reports (real) | `/admin/reports/*` | 2 days | Endpoints exist |
| 17 | Vendor Storefront | `/sellers/:slug` | 2 days | New |
| 18 | Global Search | Header component | 1 day | New |

### P4 — Platform differentiators

| # | Feature | Effort | Notes |
|---|---------|--------|-------|
| 19 | Security Settings (2FA) | `/settings/security` | 1 day | Backend complete |
| 20 | Notification Preferences | `/settings/notifications` | 1 day | Model exists |
| 21 | Price Benchmarking | Marketplace widget | 2 days | New |
| 22 | Repeat Order / Reorder | PO detail button | 1 day | New |
| 23 | Seller Performance Score | Vendor card badge | 1 day | Derived from existing data |
| 24 | SMS Notifications | Backend service | 2 days | DLT template registration needed |

---

## Part 7 — Read-Only Mode Implementation

### How it works

When a user's organisation is `verificationStatus = PENDING` or `UNDER_REVIEW`:

**Backend:**
```typescript
// New middleware: requireApprovedOrg
export const requireApprovedOrg = asyncRoute(async (req, res, next) => {
  const user = req.user;
  if (!user?.organizationId) return next(); // individual users bypass
  
  const org = await db.organization.findUnique({
    where: { id: user.organizationId },
    select: { verificationStatus: true }
  });
  
  if (org?.verificationStatus !== 'APPROVED') {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    throw new ApiError(403, 
      'Your organisation is pending platform approval. You have read-only access until approved.',
      'ORG_PENDING_APPROVAL'
    );
  }
  next();
});
```

**Frontend:**
```typescript
// In useAuth hook — add orgStatus to the user context
// In every action button — check orgStatus before enabling
// Show a persistent banner: "Your organisation is under review. 
//   You have read-only access. [View Status]"
```

**What read-only users CAN do:**
- Browse marketplace (view products, services, seller profiles)
- View public tenders
- View their own profile and onboarding status
- View notifications
- Complete their onboarding documents

**What read-only users CANNOT do:**
- Add to cart
- Create requirements, tenders, RFQs
- Submit bids
- Create POs, invoices, payments
- Send messages

---

## Part 8 — OrgRole Permission Matrix (Detailed)

### Buyer Organisation Roles

| Action | ORG_ADMIN | PROCUREMENT_OFFICER | FINANCE_OFFICER | TECHNICAL_OFFICER | LOGISTICS_OFFICER | VIEWER |
|--------|-----------|---------------------|-----------------|-------------------|-------------------|--------|
| Invite team members | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Change member roles | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Create requirement | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Submit requirement | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Create tender | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Approve tender (Dept Head) | ✓ | ✓* | ✗ | ✗ | ✗ | ✗ |
| Approve tender (Finance) | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Approve tender (Proc Head) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Evaluate technical bids | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Open financial bids | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Award bid | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Add to cart | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Approve cart (Finance) | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Tech-approve cart item | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Convert cart to PO | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Approve invoice | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Initiate payment | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Create GRN | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ |
| Approve GRN | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Raise dispute | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| View all data | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

*PROCUREMENT_OFFICER can be designated as Dept Head by ORG_ADMIN

### Seller Organisation Roles

| Action | ORG_ADMIN | PROCUREMENT_OFFICER | FINANCE_OFFICER | TECHNICAL_OFFICER | LOGISTICS_OFFICER | VIEWER |
|--------|-----------|---------------------|-----------------|-------------------|-------------------|--------|
| Manage catalogue | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| Submit bids | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Accept/reject PO | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Respond to RFQ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Update delivery status | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ |
| Upload delivery docs | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ |
| Raise invoice | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View payments | ✓ | ✗ | ✓ | ✗ | ✗ | ✓ |
| Raise dispute | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |


---

## Part 9 — User Journey Maps (How it feels to use the portal)

### Journey 1: New Startup registers as Seller

```
1. Land on homepage → "Register as Seller"
2. Fill: company name, GST, PAN, business type → Submit
3. Email verification → Login
4. Onboarding checklist appears on dashboard:
   ✗ Business Details
   ✗ KYC Documents (PAN, GST cert, Udyam)
   ✗ Bank Account Verification
   ✗ Category Selection
   ✗ Add at least 1 product/service
   ✗ Submit for Review
5. Complete each step → Submit
6. Platform admin reviews → Approves
7. Email: "Your organisation is approved. You can now receive orders."
8. ORG_ADMIN logs in → Invites Finance Officer and Logistics Officer
9. Finance Officer accepts invite → Sets password → Logs in → Sees Finance dashboard
10. Logistics Officer accepts invite → Logs in → Sees Delivery dashboard
```

### Journey 2: Buyer purchases via Cart

```
1. Buyer (PROCUREMENT_OFFICER) browses marketplace
2. Finds product → "Add to Cart" → Selects quantity → Cart updates
3. Adds 3 more items from different sellers
4. Reviews cart → Adds note: "Urgent requirement for Q2 project"
5. Clicks "Submit for Finance Approval"
6. Finance Officer gets notification: "New cart pending approval - ₹2,45,000"
7. Finance Officer opens Cart Approvals → Reviews items
8. Sees item #2 needs technical review → Flags it
9. Technical Officer gets notification: "Cart item needs technical review"
10. Technical Officer reviews specs → Approves with note: "Specs match requirement"
11. Finance Officer sees all items approved → Approves cart
12. Procurement Officer gets notification: "Cart approved"
13. Procurement Officer converts cart → Chooses "Direct Purchase" for each seller
14. System creates 3 Direct Purchase requests (one per seller)
15. Sellers get notified → Accept → POs generated
16. Approval chain runs (Dept Head → Finance → Proc Head)
17. POs sent to sellers after all approvals
```

### Journey 3: Tender Procurement (High Value)

```
1. PROCUREMENT_OFFICER creates Requirement: "100 Industrial Pumps, ₹50L budget"
2. Submits requirement → Approval chain starts
3. Dept Head approves → Finance approves → Proc Head approves
4. PROCUREMENT_OFFICER creates Tender from approved requirement
5. Sets: deadline, evaluation criteria (Technical 60%, Financial 40%)
6. Tender goes through approval chain again
7. After all approvals → Tender published
8. Sellers notified via dashboard + email + SMS
9. Sellers submit sealed bids (technical + financial separately)
10. Deadline passes → Bids locked
11. TECHNICAL_OFFICER opens technical bids → Scores each bid
12. 2 vendors disqualified (score < threshold)
13. PROCUREMENT_OFFICER opens financial bids for qualified vendors
14. System auto-ranks: L1 (₹42L), L2 (₹45L), L3 (₹48L)
15. Comparative Statement generated
16. PROCUREMENT_OFFICER selects L1 → Approval chain for award
17. All approvals pass → PO auto-generated → Sent to L1 seller
18. Seller acknowledges → Contract formed
19. Seller dispatches → Updates delivery status
20. Buyer creates GRN → Technical Officer inspects → Approves
21. Seller raises invoice → Finance Officer approves
22. Payment released → T+1 settlement → Platform commission deducted
23. Final tax invoices generated for both parties
```

---

## Part 10 — Implementation Phases (Sprint Plan)

### Phase 1 — Foundation (2 weeks)
**Goal:** Multi-tenant org roles working end-to-end

- [ ] DB migration: `OrgMembership`, `OrgInvitation` models
- [ ] Backend: `requireOrgRole()` middleware
- [ ] Backend: `requireApprovedOrg()` middleware
- [ ] Backend: Team management endpoints (invite, accept, list, update role, remove)
- [ ] Frontend: Team Management page (`/org/team`)
- [ ] Frontend: Accept Invitation page (`/invite/accept`)
- [ ] Frontend: Read-only mode banner + button disabling
- [ ] Frontend: Role-aware sidebar (hide items based on OrgRole)
- [ ] Frontend: Role-aware dashboard action cards

### Phase 2 — Cart System (1 week)
**Goal:** Buyers can add to cart, Finance + Tech Officers can approve

- [ ] DB migration: `Cart`, `CartItem` models
- [ ] Backend: Cart CRUD endpoints
- [ ] Backend: Cart approval/rejection endpoints
- [ ] Backend: Technical review endpoints
- [ ] Frontend: Cart page with add/remove/quantity
- [ ] Frontend: Cart icon in header with badge
- [ ] Frontend: Cart Approval page (Finance Officer)
- [ ] Frontend: Technical Review page (Technical Officer)
- [ ] Marketplace: Replace "Purchase/Bid" with "Add to Cart"

### Phase 3 — Approval Workflow (1 week)
**Goal:** Multi-level approval chain for tenders and POs

- [ ] DB migration: `ProcurementApproval` model
- [ ] Backend: Approval chain creation on tender/PO events
- [ ] Backend: Approval queue endpoints
- [ ] Backend: Approve/reject/clarify endpoints
- [ ] Frontend: Approval Queue page (`/approvals`)
- [ ] Frontend: Tender detail shows approval chain status
- [ ] Frontend: PO detail shows approval trail

### Phase 4 — Fulfillment (1 week)
**Goal:** Complete the delivery → GRN → payment loop

- [ ] DB migration: `GoodsReceiptNote`, `GrnItem`, `GrnDocument` models
- [ ] Backend: GRN CRUD + approval endpoints
- [ ] Backend: 3-way match check in payment flow
- [ ] Frontend: Seller Delivery Management page
- [ ] Frontend: GRN creation and approval page
- [ ] Frontend: Disputes real UI (thread + evidence)
- [ ] Frontend: Messages / Conversations UI

### Phase 5 — Tender Evaluation (1 week)
**Goal:** Full two-bid evaluation workflow

- [ ] Backend: Tech evaluation scoring endpoints
- [ ] Backend: Financial bid opening endpoint
- [ ] Backend: L1/L2/L3 ranking endpoint
- [ ] Backend: Comparative statement generation
- [ ] Frontend: Tender Evaluation page (TEC + FEC tabs)
- [ ] Frontend: L1 ranking table
- [ ] Frontend: Printable comparative statement

### Phase 6 — UX Polish (1 week)
**Goal:** Make the portal easy for non-technical users

- [ ] Role-aware dashboard (full implementation)
- [ ] Guided onboarding checklist
- [ ] Global search (Ctrl+K)
- [ ] Vendor storefront pages
- [ ] Admin MIS reports (real data)
- [ ] Security settings (2FA)
- [ ] Notification preferences
- [ ] Auction live bidding UI

---

## Part 11 — Files to Create / Modify

### New Backend Files
```
backend/src/routes/org.routes.ts          — Team management, invitations
backend/src/routes/cart.routes.ts         — Cart CRUD + approvals
backend/src/routes/grn.routes.ts          — GRN management
backend/src/routes/approvals.routes.ts    — Approval queue
backend/src/middleware/requireOrgRole.ts  — OrgRole middleware
backend/src/middleware/requireApprovedOrg.ts — Read-only enforcement
backend/src/services/approvalChain.ts     — Multi-level approval logic
backend/src/services/settlementEngine.ts  — T+1 split logic
backend/src/services/grnService.ts        — GRN + 3-way match
```

### Modified Backend Files
```
backend/src/routes/phase4.routes.ts       — Add requireApprovedOrg to all transactional routes
backend/index.ts                          — Mount new route files
backend/prisma/schema.prisma              — Add new models (Part 2)
```

### New Frontend Files
```
frontend/src/features/orgTeam/pages/TeamManagementPage.tsx
frontend/src/features/orgTeam/pages/AcceptInvitePage.tsx
frontend/src/features/cart/pages/CartPage.tsx
frontend/src/features/cart/pages/CartApprovalPage.tsx
frontend/src/features/cart/pages/TechnicalReviewPage.tsx
frontend/src/features/cart/components/CartDrawer.tsx
frontend/src/features/cart/hooks.ts
frontend/src/features/cart/api.ts
frontend/src/features/approvals/pages/ApprovalQueuePage.tsx
frontend/src/features/approvals/hooks.ts
frontend/src/features/grn/pages/GrnListPage.tsx
frontend/src/features/grn/pages/GrnDetailPage.tsx
frontend/src/features/grn/hooks.ts
frontend/src/features/delivery/pages/SellerDeliveryManagementPage.tsx
frontend/src/features/disputes/pages/DisputesPage.tsx
frontend/src/features/disputes/pages/DisputeDetailPage.tsx
frontend/src/features/messages/pages/MessagesPage.tsx
frontend/src/features/tenderEval/pages/TenderEvaluationPage.tsx
frontend/src/features/settings/pages/SecuritySettingsPage.tsx
frontend/src/features/settings/pages/NotificationPrefsPage.tsx
frontend/src/hooks/useOrgRole.ts          — Hook to get current user's OrgRole
frontend/src/components/layout/CartIcon.tsx — Header cart badge
frontend/src/components/OrgApprovalBanner.tsx — Read-only mode banner
```

### Modified Frontend Files
```
frontend/src/App.tsx                      — Add new routes
frontend/src/components/layout/Navbar.tsx — Role-aware sidebar, cart icon
frontend/src/views/Dashboard.tsx          — Role-aware action cards
frontend/src/features/catalogue/pages/CataloguePage.tsx — Add to Cart button
frontend/src/hooks/useAuth.tsx            — Add orgRole, orgStatus to context
```

---

## Part 12 — Key Design Decisions

### Decision 1: OrgRole vs Platform Role
- Platform `Role` (buyer/seller/admin) controls which side of the marketplace you're on
- `OrgRole` controls what you can do within your organisation
- A user can only belong to one organisation (for now)
- Platform admin is separate — they don't have an OrgRole

### Decision 2: Cart is per-organisation, not per-user
- One active cart per organisation at a time
- Any member can add items
- Finance Officer approves the whole cart
- This mirrors how real procurement works (team builds the cart, finance approves)

### Decision 3: Approval chain is configurable per organisation
- ORG_ADMIN can configure which stages are required for their org
- Small orgs can skip some stages (e.g., startup with 2 people doesn't need 3-level approval)
- Platform admin can set minimum required stages for high-value transactions

### Decision 4: Read-only is enforced at both backend and frontend
- Backend: `requireApprovedOrg()` middleware blocks all mutations
- Frontend: buttons are disabled with tooltip "Pending approval"
- This prevents any bypass via direct API calls

### Decision 5: GRN replaces the current Inspection stub
- The current `/buyer/inspection` GenericFeaturePage is replaced by the GRN flow
- GRN is the formal document that triggers payment — it's the "Goods Receipt Note" standard in Indian procurement
- 3-way match: PO amount = GRN accepted qty × unit price = Invoice amount

---

## Summary: What to Build Next (in order)

1. **OrgMembership + Team Management** — enables the entire role-based access model
2. **Read-only mode enforcement** — critical for compliance
3. **Cart system** — replaces the awkward "Direct Purchase from marketplace" flow
4. **Approval Queue** — makes multi-level approvals visible and actionable
5. **Seller Delivery Management** — unblocks live transactions
6. **GRN + 3-way match** — completes the payment loop
7. **Disputes real UI** — gives users recourse
8. **Tender Evaluation UI** — completes the tender workflow
9. **Role-aware Dashboard** — makes the portal feel intelligent
10. **Everything else** — auction, contracts, reports, settings

The first 4 items are architectural. Everything else is feature work that builds on top of them.
