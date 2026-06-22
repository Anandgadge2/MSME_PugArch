# GeM-Style Procurement Portal — Implementation Plan

**Version:** 1.0  
**Date:** June 2026  
**Status:** PLANNING — Awaiting business logic confirmation before coding begins

---

## PART 1: CODEBASE AUDIT FINDINGS

> Based on the project structure provided. Source files were not all readable, so this is a structural audit. Gaps will be confirmed during implementation.

### 1.1 Tech Stack (Confirmed)

| Layer | Technology |
|---|---|
| Frontend | React (Vite), TypeScript, Tailwind CSS |
| Routing | Custom next-router-dom shim (React Router DOM underneath) |
| State / Data | TanStack Query (React Query) pattern observed in hooks |
| UI Components | Custom component library (`/components/ui/`) |
| Backend | Node.js + Express, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens), bcrypt |
| File Storage | Cloudinary + GCP Storage |
| Realtime | SSE / EventSource (`realtime.service.ts`) |
| Notifications | In-app + Email (`notification.service.ts`, `email.service.ts`, `sms.service.ts`) |
| Queue / Jobs | Bull queues (`queues.ts`, `workers.ts`) |
| Cache | Redis |
| Payments | Razorpay + Cashfree + Bank Transfer providers |

---

### 1.2 Modules — What Already Exists

| Module | Status | Location | Notes |
|---|---|---|---|
| Auth (login, register, OTP, JWT) | ✅ Exists | `backend/src/modules/auth/` | Appears complete |
| Role system | ✅ Exists | `backend/src/constants/roles.ts`, `permissions.ts` | Needs audit for new roles |
| Marketplace product listing | ✅ Exists (partial) | `frontend/src/features/marketplace/` | Pages + API exist, completeness unknown |
| Cart | ✅ Exists (partial) | `frontend/src/features/cart/` | Cart routes exist in backend |
| Direct Purchase | ✅ Exists (partial) | `frontend/src/features/directPurchase/` | Checkout page exists, 500 error known |
| Bid / Tender | ✅ Exists (partial) | `frontend/src/features/procurementBid/`, `frontend/src/features/tenders/` | Split across two feature folders — possible overlap |
| Reverse Auction | ✅ Exists (partial) | `frontend/src/features/auctions/`, `frontend/src/features/reverseAuctions/` | Two separate folders — possible duplication |
| Purchase Orders | ✅ Exists (partial) | `frontend/src/features/purchaseOrders/` | Exists, completeness unknown |
| Procurement Wizard | ✅ Exists (partial) | `frontend/src/features/procurementWizard/` | Multi-step wizard exists |
| Delivery | ✅ Exists (partial) | `frontend/src/features/delivery/`, `frontend/src/features/sellerDelivery/` | Split buyer/seller — needs consolidation |
| GRN (Goods Receipt Note) | ✅ Exists | `frontend/src/features/grn/` | Likely maps to PRC |
| Invoices | ✅ Exists (partial) | `frontend/src/features/invoices/` | Exists |
| Payments / Escrow | ✅ Exists (partial) | `frontend/src/features/payments/`, `frontend/src/features/escrow/` | Razorpay/Cashfree integrated |
| Disputes | ✅ Exists (partial) | `frontend/src/features/disputes/` | Module folder exists |
| Notifications | ✅ Exists | `frontend/src/features/notifications/`, `backend/src/services/notification.service.ts` | In-app + email present |
| Audit | ✅ Exists (partial) | `frontend/src/features/audit/`, `backend/src/modules/audit/` | Service exists |
| Reports / MIS | ✅ Exists (partial) | `frontend/src/features/reports/`, `frontend/src/views/MISReports.tsx` | Pages exist |
| Dashboard | ✅ Exists (partial) | `frontend/src/features/dashboard/` | Buyer/seller/admin split unclear |
| Approvals | ✅ Exists (partial) | `frontend/src/features/approvals/` | Approval chain service exists in backend |
| Quotations / RFQ | ✅ Exists | `frontend/src/features/rfq/`, `frontend/src/features/quotations/` | Exists |
| Ratings | ✅ Exists | `frontend/src/features/ratings/` | Module present |
| KYC / Aadhaar | ✅ Exists | `frontend/src/features/kyc/` | Aadhaar KYC page present |
| Org Team / RBAC | ✅ Exists | `frontend/src/features/orgTeam/` | Org membership + roles present |
| SearchableSelect component | ✅ Exists (buggy) | `frontend/src/components/ui/SearchableSelect.tsx` | Overflow/z-index bug fixed in prior session |

---

### 1.3 Modules — What Is Missing or Incomplete

| Module | Status | Gap |
|---|---|---|
| L1 Purchase flow | ❌ Missing | No dedicated L1 comparison screen, L1 selection, or L1 marker logic |
| PRC (Provisional Receipt Certificate) | ⚠️ Partial | GRN exists but PRC as a formal numbered certificate is absent |
| CRAC (Consignee Receipt and Acceptance Certificate) | ❌ Missing | No CRAC model, page, or flow found |
| BOQ Bid type | ❌ Missing | BOQ entry mode, line item table, Excel upload not found |
| PAC / Proprietary Bid | ❌ Missing | PAC justification form, document upload flow absent |
| Two Packet Bid | ❌ Missing | Technical + financial packet separation not found |
| Corrigendum / Amendment flow | ❌ Missing | No corrigendum model, version history, or diff tracking |
| EMD / PBG | ⚠️ Partial | Schema migration references exist but frontend flow absent |
| Consignee module (formal) | ⚠️ Partial | Delivery address exists; formal Consignee entity with designation, inspection officer absent |
| Procurement Mode Validation service | ❌ Missing | No demand-splitting checks, value-threshold warnings, or mode recommendation engine |
| Demand splitting alert | ❌ Missing | |
| Compare Sellers / L1 screen | ❌ Missing | |
| Order status full lifecycle | ⚠️ Partial | Some statuses exist; full 19-status lifecycle not confirmed |
| Paying Authority role + payment update flow | ⚠️ Partial | Payment status tracking exists; formal Paying Authority role action missing |
| Evaluation / Technical Committee flow | ⚠️ Partial | Tender evaluation exists; structured evaluator scoring absent |
| Field config / schema-driven forms | ❌ Missing | Forms are hardcoded JSX; no central field config system |
| SearchableMultiSelect component | ❌ Missing | Only single-select exists |
| Global dropdown N/A + Other rule | ⚠️ Partial | `allowOther` exists in SearchableSelect; `allowNA` and global enforcement absent |
| Report exports (CSV/Excel/PDF) | ⚠️ Partial | MIS reports page exists; export functionality unknown |

---

### 1.4 Suspected Duplications / Conflicts

| Issue | Location | Risk |
|---|---|---|
| `procurementBid` vs `tenders` | `features/procurementBid/` and `features/tenders/` | Possible overlap — bids and tenders may be the same entity with different UIs |
| `auctions` vs `reverseAuctions` | `features/auctions/` and `features/reverseAuctions/` | Likely duplicate — needs consolidation |
| `delivery` vs `sellerDelivery` | Both exist | Buyer-side and seller-side delivery split is fine, but shared types/APIs may diverge |
| `grn` vs future PRC/CRAC | GRN = Goods Receipt Note ≈ PRC | Map GRN to PRC to avoid duplicating the receipt concept |
| `escrow` vs `payments` | Both exist | Escrow is a subset of payments; may need architectural review |
| Direct Purchase 500 error | `backend/src/routes/direct-purchase.routes.ts` | Broken checkout API must be fixed in Phase 0 |
| Stream JWT in URL | `realtime.service.ts` + frontend EventSource | Security issue — JWT exposed in query string |

---

### 1.5 What Needs Business Logic Confirmation (Before Coding)

See **Part 3: Open Questions** below.

---

## PART 2: IMPLEMENTATION PLAN

### Overview of Phases

```
Phase 0  →  Fix critical bugs (checkout 500, stream JWT)
Phase 1  →  Foundation (roles, field config system, SearchableSelect upgrade)
Phase 2  →  Marketplace + Cart hardening
Phase 3  →  Procurement Mode Validation service
Phase 4  →  Direct Purchase full flow
Phase 5  →  L1 Purchase flow
Phase 6  →  Bid Creation Wizard (all types)
Phase 7  →  Consignee + Delivery module
Phase 8  →  Approval / Sanction flow
Phase 9  →  Order lifecycle + Seller Acceptance
Phase 10 →  PRC / CRAC module
Phase 11 →  Invoice + Payment tracking
Phase 12 →  EMD / PBG
Phase 13 →  Corrigendum / Amendment
Phase 14 →  Dispute / Grievance module
Phase 15 →  Audit logs hardening
Phase 16 →  Notifications hardening
Phase 17 →  Reports + Dashboards
Phase 18 →  Security hardening
Phase 19 →  Performance optimization
Phase 20 →  Testing + verification
```

---

### PHASE 0 — Critical Bug Fixes (Do First)

**Priority: BLOCKER — Must complete before any new feature work**

#### 0.1 Fix Direct Purchase Checkout 500 Error
- Locate backend route: `POST /api/direct-purchases/checkout`
- Add proper request body validation (Zod or manual)
- Ensure `req.user` is attached by auth middleware before handler runs
- Wrap all DB operations in try/catch with proper status codes:
  - 400 for missing/invalid input
  - 401 for unauthenticated
  - 404 for cart/address/product not found
  - 409 for stock issues
  - 500 only for unexpected errors
- Standardize response shape: `{ success, data }` / `{ success, message, code }`
- Add structured backend logging for all errors

#### 0.2 Fix Stream JWT in URL
- Find EventSource creation in frontend (likely `frontend/src/lib/notifications.ts`)
- Replace query-string JWT with either:
  - Short-lived dedicated stream token issued by a new `POST /api/stream/token` endpoint, OR
  - HttpOnly cookie authentication if architecture allows
- Add reconnect backoff on frontend (exponential, max 30s, stop after 5 failures)
- Fix repeated failed stream requests logged in console

---

### PHASE 1 — Foundation

#### 1.1 Role Audit and Extension
- Audit `backend/src/constants/roles.ts` and `permissions.ts`
- Add or confirm these roles exist:
  - `super_admin`
  - `admin` / `procurement_admin`
  - `buyer`
  - `approving_authority`
  - `consignee`
  - `paying_authority`
  - `seller`
  - `evaluator`
- Add org-level role mapping where needed
- Backend middleware must enforce role on every new route

#### 1.2 Field Config System (Schema-Driven Forms)
- Create `frontend/src/features/shared/fieldConfig.types.ts`:
  ```typescript
  interface FieldConfig {
    fieldKey: string
    label: string
    inputType: 'text' | 'number' | 'email' | 'date' | 'textarea' |
               'searchable-select' | 'searchable-multi-select' |
               'radio' | 'checkbox' | 'file' | 'currency'
    required: boolean
    requiredWhen?: ConditionRule
    options?: DropdownOption[]
    allowNA?: boolean
    allowOther?: boolean
    otherRequiredWhenSelected?: boolean
    validation?: ValidationRule[]
    helperText?: string
    visibleWhen?: ConditionRule
    roleAccess?: string[]
  }
  ```
- Create `frontend/src/components/ui/DynamicField.tsx` — renders any FieldConfig as the correct input
- Create `frontend/src/components/ui/DynamicForm.tsx` — renders a list of FieldConfig entries with validation

#### 1.3 SearchableSelect + SearchableMultiSelect Upgrade
- Fix existing `SearchableSelect.tsx`:
  - Add `allowNA` prop — prepends "N/A" option when true
  - Ensure `allowOther` shows "Please specify" textbox immediately on Other selection
  - Fix z-index / overflow issue globally (use `position: fixed` for dropdown portal or ensure no `overflow-hidden` ancestor clips it)
- Create `SearchableMultiSelect.tsx`:
  - Multi-value selection with tags
  - Search/filter
  - `allowNA` clears all other selections
  - `allowOther` adds "Please specify" textbox
- Create `frontend/src/components/ui/DropdownOptionHelper.ts`:
  - `buildOptions(baseOptions, allowNA, allowOther)` utility

---

### PHASE 2 — Marketplace + Cart Hardening

#### 2.1 Marketplace
- Audit existing marketplace pages and API
- Ensure filters work: category, seller, price range, location/district, delivery period
- Add "Compare Sellers" button on product detail page
- Compare screen: table showing all sellers for that product with L1 marker
- Ensure "Add to Cart" correctly sets sellerId, productId, unitPrice, quantity
- Add availability and delivery period display

#### 2.2 Cart
- Audit existing cart functionality
- Add cart status field: `Draft | Reviewed | Procurement Method Selected | Submitted for Approval | Approved | Converted to Order | Converted to Bid | Cancelled`
- Add Save Cart as Draft
- Add Update Quantity + Remove Item
- Cart review screen must show: product, seller, qty, unit price, GST, total, delivery period, warranty, installation flag

#### 2.3 Procurement Method Selection Screen
- After cart review, show procurement method selector
- Display recommended method based on cart value (configurable thresholds)
- Show warnings:
  - High value + Direct Purchase selected → warning
  - Same items ordered repeatedly → demand splitting warning
  - Brand-specific items without PAC justification → warning
- If non-recommended method selected: require justification text
- Store selected method on cart record

---

### PHASE 3 — Procurement Mode Validation Service

#### 3.1 Backend Service
- Create `backend/src/services/procurement-mode-validation.service.ts`
- Inputs: cart value, product category, quantity, seller count, is_proprietary, consignee count, requirement complexity
- Output: recommended mode, warnings[], is_split_demand_risk
- Rules loaded from admin-configurable settings table (not hardcoded)
- Expose as `POST /api/procurement/validate-mode`

#### 3.2 Admin Settings
- Add settings page for procurement thresholds:
  - Direct Purchase limit (default: configurable)
  - L1 Purchase limit
  - Bid threshold
  - RA threshold
  - Split demand detection window (days)
  - Split demand quantity threshold

---

### PHASE 4 — Direct Purchase Full Flow

**Flow:** Cart → Cart Review → Buyer/Consignee Details → Budget/Sanction → Mode Validation → Internal Approval → PO Generation → Seller Acceptance → Delivery → PRC → CRAC → Invoice → Payment

#### 4.1 Fix checkout API (from Phase 0 + extend)
- Validate and accept all required fields (see field matrix)
- Generate Purchase Order record on approval
- Notify seller on PO creation

#### 4.2 Direct Purchase Status Lifecycle
Implement full status transitions:
`Cart Created → Approval Pending → Approved → Order Placed → Seller Acceptance Pending → Accepted by Seller → Delivered → PRC Generated → CRAC Generated → Invoice Submitted → Payment Released → Closed / Cancelled`

#### 4.3 Frontend Pages
- `DirectPurchaseCheckoutPage` — already exists, fix and extend
- `DirectPurchaseDetailPage` — view status, timeline, documents
- `DirectPurchaseListPage` — buyer's list of all direct purchases

---

### PHASE 5 — L1 Purchase Flow

#### 5.1 L1 Comparison Screen
- New page: `frontend/src/features/directPurchase/pages/L1ComparisonPage.tsx`
- Shows all marketplace sellers for selected product in a sortable table:
  - Seller name, unit price, total price, delivery period, warranty, rating, location, compliance status
  - L1 marker on lowest-price compliant seller
- Buyer selects seller — if not L1: must enter justification
- Justification + non-L1 selection triggers approval requirement

#### 5.2 Backend
- `GET /api/marketplace/l1-comparison?productId=&quantity=` — returns ranked seller list with L1 flag

---

### PHASE 6 — Bid Creation Wizard

Multi-step wizard supporting all bid types.

#### 6.1 Wizard Steps (all types)
1. Bid Type Selection
2. Buyer / Department Details
3. Bid Basic Details
4. Dynamic type-specific section:
   - Product Bid fields
   - Service Bid fields
   - Custom Bid fields
   - BOQ Bid fields (with line item table + Excel upload)
5. Delivery / Consignee Details
6. Eligibility & Evaluation
7. Terms, Documents & Compliance
8. RA Settings (conditional: only if bid type includes RA)
9. PAC Details (conditional: only if PAC bid type or PAC flag set)
10. Preview & Submit / Publish

#### 6.2 BOQ Bid
- Line item entry table with add/remove rows
- Excel upload with column mapping and validation
- Validation: missing quantity, missing unit, duplicate item number, invalid rate
- BOQ Validation Status shown in real time

#### 6.3 PAC Bid
- Proprietary justification form
- Technical reason dropdown
- Document uploads: PAC certificate, competent authority approval, price reasonability doc

#### 6.4 Two Packet Bid
- Technical packet fields separate from financial packet fields
- Financial packet locked until technical evaluation complete

#### 6.5 Backend
- Extend existing bid/tender API or create dedicated bid API
- Store bid type, packet type, all dynamic fields as structured JSON + typed columns
- Status: `Draft → Approval Pending → Approved → Published → Seller Participation → Evaluation → Awarded → Order Generated → Closed`

---

### PHASE 7 — Consignee + Delivery Module

#### 7.1 Formal Consignee Entity
- Add/extend Prisma model: `Consignee`
  - Fields: name, designation, email, mobile, deliveryAddress, deliveryDistrict, pinCode, deliveryPeriod, acceptanceCriteria, inspectionOfficerName, quantityAllotted
  - Linked to: PurchaseOrder or Bid
- Single + Multiple consignee support
- Bulk Excel upload for multiple consignees with validation

#### 7.2 Delivery Tracking
- Extend existing delivery module:
  - Seller marks dispatch → buyer/consignee confirms receipt → triggers PRC
  - Support: full delivery, partial delivery, damaged, wrong item, late delivery
  - Evidence upload (photos, documents)

---

### PHASE 8 — Approval / Sanction Flow

- Extend existing approval chain service
- Approval entity fields: approving authority, file number, sanction document, sanction amount, status, timestamp, approvedBy
- Actions: Submit for Approval, Approve, Reject, Send Back
- Approval history view on every procurement entity
- Role check: only `approving_authority` role can approve

---

### PHASE 9 — Order Lifecycle + Seller Acceptance

- Full 19-status order lifecycle (see field matrix)
- Seller acceptance page:
  - Accept → enter expected dispatch + delivery dates
  - Reject → enter rejection reason → notify buyer
- Auto-cancel after configurable days if seller does not respond
- Order generates unique Order ID, links to: cart, buyer, seller, consignee, address, sanction

---

### PHASE 10 — PRC / CRAC Module

#### 10.1 PRC
- Triggered after delivery confirmed
- Auto-generate PRC number
- Fields: PRC date, generated by, received quantity, remarks
- Maps existing GRN to PRC (rename/extend GRN model)

#### 10.2 CRAC
- Triggered after PRC + inspection
- Auto-generate CRAC number
- Inspection result: Accepted / Partially Accepted / Rejected / Reinspection Required
- Fields: accepted qty, rejected qty, remarks, installation confirmation, warranty document
- **Gate:** Invoice cannot be submitted until CRAC status = Accepted or Partially Accepted (with exception approval)

---

### PHASE 11 — Invoice + Payment Tracking

- Seller submits invoice: number, date, amount, GST, document upload, links to Order + CRAC
- Paying Authority role reviews invoice
- Payment status lifecycle (8 statuses)
- Payment mode dropdown (PFMS, Treasury, GeM Pool, Bank, Gateway, Other)
- Payment Reference / UTR stored securely, not exposed publicly
- No payment release without invoice approval

---

### PHASE 12 — EMD / PBG

- Add to bid creation wizard (Step 7 — Terms & Compliance)
- EMD: required flag, amount, exemption category, payment status, refund status
- PBG: required flag, percentage/amount, validity, document upload, verification status, release status
- Backend model: extend Bid schema or create separate EMD/PBG table

---

### PHASE 13 — Corrigendum / Amendment

- Only for published bids
- Track every changed field: old value, new value, changed by, timestamp, reason
- Store as version history on Bid entity
- Publish corrigendum → notify all participating sellers
- Status: Draft → Approval Pending → Published → Cancelled

---

### PHASE 14 — Dispute / Grievance Module

- Extend existing disputes module
- Dispute types: 10 types (see field matrix)
- Status lifecycle: 7 statuses
- Evidence upload
- Seller reply + buyer reply threading
- Escalation to admin
- Resolution + closure with remarks

---

### PHASE 15 — Audit Logs Hardening

- Extend existing audit service
- Ensure every action in the procurement lifecycle creates an audit record
- Fields: userId, role, action, entityType, entityId, oldValue, newValue, timestamp, ip, remarks
- Admin audit log viewer with filters + export

---

### PHASE 16 — Notifications Hardening

- Map all 17 notification events (see specification) to triggers in services
- Ensure in-app notification created for every event
- Trigger email if email service available
- SMS/WhatsApp if SMS service available (already present in backend)

---

### PHASE 17 — Reports + Dashboards

- Buyer dashboard: 12 KPI widgets
- Admin dashboard: 14 KPI widgets
- Seller dashboard: 6 KPI widgets
- 10 report types with filters, pagination, CSV/Excel export
- Role-based access on all reports
- Server-side pagination and filtering on all report APIs

---

### PHASE 18 — Security Hardening

- Backend role checks on every new API route (middleware pattern)
- IDOR prevention: every query filters by authenticated user's org/buyer/seller ID
- Signed/private URLs for sensitive document downloads
- Rate limiting on: checkout, bid publish, invoice submit, payment update
- Input sanitization on all text fields
- File upload restrictions: allowed types, max size
- Admin + export routes protected
- Audit log all report exports

---

### PHASE 19 — Performance Optimization

- Server-side pagination on all list APIs (page, limit, cursor)
- Server-side filtering and search
- Add DB indexes for: buyerId, sellerId, orderStatus, bidStatus, procurementMethod, createdAt, categoryId, paymentStatus, deliveryStatus
- Cache static master data: districts, categories, financial years, statuses (Redis, 1hr TTL)
- Debounce all frontend search inputs (300ms)
- Lazy load dashboard charts
- Compress file uploads on backend

---

### PHASE 20 — Testing + Verification

- Run: `tsc --noEmit` on frontend and backend
- Run: `npm run build` on frontend
- Run: existing backend tests
- Manual test all 22 flows listed in specification
- Verify: no 500 errors on checkout
- Verify: stream does not spam console
- Verify: role restrictions block unauthorized access
- Verify: public routes cannot access private procurement data

---

## PART 3: OPEN QUESTIONS (Must Confirm Before Coding)

These are blockers for specific phases. Please answer each one.

---

### Q1 — Value Thresholds for Procurement Modes
**Blocking:** Phase 3, Phase 4, Phase 5

What are the exact ₹ value limits for each procurement mode?

| Mode | Current Limit |
|---|---|
| Direct Purchase | ₹ ? (e.g. up to ₹2,50,000?) |
| L1 Purchase | ₹ ? (e.g. ₹2,50,001 to ₹10,00,000?) |
| Product / Service Bid | ₹ ? (above ?) |
| Reverse Auction | ₹ ? (above ?) |

Should these be hardcoded or configurable by admin in settings?
**Recommended:** Admin-configurable.

---

### Q2 — Approval Workflow: Mandatory or Optional?
**Blocking:** Phase 4, Phase 8

Should internal approval be:
- (A) Mandatory for all purchases regardless of value
- (B) Mandatory only above a value threshold
- (C) Configurable per organization

If (B), what is the threshold?

---

### Q3 — Payment Mode: Real Gateway or Status Tracking Only?
**Blocking:** Phase 11

Is the portal responsible for:
- (A) Actual payment processing via Razorpay/Cashfree
- (B) Status tracking only — paying authority updates status manually after PFMS/treasury payment
- (C) Both — gateway for some modes, manual tracking for PFMS/treasury

Current codebase has Razorpay and Cashfree integrated. Should the checkout keep these, or should payment in the procurement flow be status-tracking only?

---

### Q4 — Multi-Seller Orders
**Blocking:** Phase 9

Can a single Purchase Order go to multiple sellers (e.g. different items in cart from different sellers)?
- (A) One PO per seller (cart split by seller automatically)
- (B) One combined PO with multiple sellers
- (C) Buyer must choose one seller for the whole cart

---

### Q5 — Partial Delivery and Partial Payment
**Blocking:** Phase 10, Phase 11

Should the system support:
- Partial delivery (some items delivered, rest pending)?
- Partial payment (pay for delivered portion before full delivery)?

If yes, how should CRAC and invoice work for partial delivery?

---

### Q6 — PAC Approval: Who Approves?
**Blocking:** Phase 6, Phase 12

For PAC (Proprietary Article Certificate) procurement:
- Only internal approving authority, OR
- Must also go to admin/super admin for a second approval level?

---

### Q7 — EMD / PBG: Live Payment or Document Upload Only?
**Blocking:** Phase 12

For EMD (Earnest Money Deposit) and PBG (Performance Bank Guarantee):
- (A) Sellers pay EMD through portal payment gateway
- (B) Sellers upload EMD payment proof (NEFT/RTGS reference) and portal tracks status only
- (C) Both options depending on org settings

---

### Q8 — GRN vs PRC: Rename or Duplicate?
**Blocking:** Phase 10

The existing codebase has a GRN (Goods Receipt Note) module. In your specification, PRC (Provisional Receipt Certificate) serves the same purpose.
- (A) Rename GRN to PRC across the codebase
- (B) Keep GRN as is, create PRC as a separate formal document generated from GRN
- (C) GRN = internal receiving, PRC = formal issued certificate (different things)

---

### Q9 — Existing Bid/Tender Modules: Keep, Merge, or Replace?
**Blocking:** Phase 6

The codebase has both `features/procurementBid` and `features/tenders` as separate modules, and both `features/auctions` and `features/reverseAuctions`. These appear to overlap.
- (A) Merge all bids and tenders into a unified bid creation wizard
- (B) Keep them separate — tenders are different from bids in this portal's context
- (C) Keep the backend, rebuild only the frontend wizard

**What is the functional difference between a "Tender" and a "Bid" in this portal?**

---

### Q10 — Evaluator / Technical Committee: How Does Evaluation Work?
**Blocking:** Phase 6

For Two Packet Bids and Technical + Financial evaluation:
- Does the evaluator score each seller's technical bid on defined parameters?
- Is there a scoring matrix / weighted scoring system?
- Can multiple evaluators score independently, then aggregate?
- Or is evaluation a simple pass/fail per criterion?

---

### Q11 — District Scope: Maharashtra Only or All India?
**Blocking:** Phase 1, Phase 6

The specification says "Use Maharashtra district master data." Is this portal:
- (A) Maharashtra state government portal only — use Maharashtra districts throughout
- (B) Will expand to all India later — use Maharashtra now but design for extensibility

---

### Q12 — Public Marketplace: Login Required or Open Browsing?
**Blocking:** Phase 2

Can unauthenticated users:
- (A) Browse the marketplace and view products without logging in
- (B) Must log in to see any marketplace content
- (C) Can browse but not add to cart or see prices without login

---

### Q13 — Seller Onboarding for Marketplace Listings
**Blocking:** Phase 2

For a product to appear in the marketplace:
- Does a seller need to create a listing explicitly?
- Are listings tied to approved/verified sellers only?
- Is catalogue management (adding products with price, qty, delivery period) a seller function that already exists or needs to be built?

---

## PART 4: RECOMMENDED EXECUTION ORDER

Once business questions are answered, execute in this order:

```
Week 1:   Phase 0  (Bug fixes — checkout 500, stream JWT)
Week 1:   Phase 1  (Foundation — roles, field config, SearchableSelect upgrade)
Week 2:   Phase 2  (Marketplace + cart hardening)
Week 2:   Phase 3  (Procurement mode validation)
Week 3:   Phase 4  (Direct purchase full flow)
Week 3:   Phase 5  (L1 purchase flow)
Week 4-5: Phase 6  (Bid creation wizard — all types)
Week 5:   Phase 7  (Consignee + delivery)
Week 5:   Phase 8  (Approval / sanction)
Week 6:   Phase 9  (Order lifecycle + seller acceptance)
Week 6:   Phase 10 (PRC / CRAC)
Week 7:   Phase 11 (Invoice + payment tracking)
Week 7:   Phase 12 (EMD / PBG)
Week 8:   Phase 13 (Corrigendum)
Week 8:   Phase 14 (Dispute module)
Week 9:   Phase 15 (Audit hardening)
Week 9:   Phase 16 (Notifications hardening)
Week 10:  Phase 17 (Reports + dashboards)
Week 10:  Phase 18 (Security hardening)
Week 11:  Phase 19 (Performance)
Week 11:  Phase 20 (Testing + verification)
```

---

## PART 5: SCHEMA ADDITIONS NEEDED (Preliminary)

> These are additions to the existing Prisma schema. Final version after Q8 and Q9 are answered.

```
New or extended models:
- Consignee          (formal, with designation + inspection officer)
- PRC                (or extend GRN — pending Q8)
- CRAC               (new)
- BOQItem            (new — line items for BOQ bids)
- BidDocument        (extend if not present)
- Corrigendum        (new)
- CorrigendumChange  (new — field diff tracking)
- EMD                (new or extend)
- PBG                (new or extend)
- ProcurementSettings (new — admin-configurable thresholds)
- L1Comparison       (may not need DB — can be derived query)

Indexes to add:
- PurchaseOrder: buyerId, sellerId, status, procurementMethod, createdAt
- Bid: buyerId, bidType, status, createdAt
- Delivery: orderId, deliveryStatus
- Invoice: orderId, cracId, status
- Payment: invoiceId, status
- AuditLog: entityType, entityId, userId, createdAt
```

---

## PART 6: FRONTEND ROUTE MAP (New Pages)

```
/marketplace                          (exists — harden)
/marketplace/product/:id              (exists — add compare)
/marketplace/compare/:productId       (NEW — L1 comparison)
/cart                                 (exists — harden)
/cart/checkout                        (exists — fix + extend)
/buyer/direct-purchase                (exists)
/buyer/direct-purchase/:id            (NEW — detail + status)
/buyer/l1-purchase/:cartId            (NEW)
/buyer/bids/create                    (exists via wizard — extend all types)
/buyer/bids/:id                       (NEW — bid detail)
/buyer/bids                           (exists — harden)
/buyer/orders                         (exists — harden)
/buyer/orders/:id                     (NEW — full order lifecycle view)
/buyer/prc/:orderId                   (NEW)
/buyer/crac/:orderId                  (NEW)
/buyer/invoices                       (exists — harden)
/buyer/payments                       (exists — harden)
/buyer/disputes                       (exists — harden)
/buyer/reports                        (exists — harden)
/seller/orders/:id/acceptance         (NEW)
/seller/delivery/:orderId             (exists — harden)
/seller/invoices/submit/:orderId      (NEW)
/admin/procurement/approvals          (exists — harden)
/admin/procurement/bid-monitoring     (NEW)
/admin/procurement/settings           (NEW — thresholds)
/admin/audit-logs                     (exists — harden)
```

---

*End of Implementation Plan v1.0*

*Status: AWAITING ANSWERS TO PART 3 OPEN QUESTIONS before Phase 0 and Phase 1 coding begins.*