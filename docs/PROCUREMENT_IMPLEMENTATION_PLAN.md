# GeM-Style Procurement Portal — Full Implementation Plan

**Date:** June 2026  
**Status:** Pre-implementation Audit & Planning  
**Codebase:** MSME_PugArch (Next.js frontend + Express/Prisma backend)

---

## SECTION 1: CODEBASE AUDIT FINDINGS

### 1.1 Tech Stack Confirmed

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + React + Tailwind CSS |
| Backend | Express.js + TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT (access + refresh tokens) |
| File Storage | Cloudinary / GCP Storage |
| Real-time | SSE (Server-Sent Events) via `realtime.service.ts` |
| Email | Custom mail service |
| SMS | Custom SMS service |
| Queue | Redis-based job queue |
| Caching | Redis |
| Payments | Razorpay + Cashfree + Bank Transfer providers |

---

### 1.2 What Already EXISTS (Do Not Rebuild)

#### Backend Modules — Present
- ✅ Auth system (JWT, OTP, refresh tokens, login events)
- ✅ User roles (`admin`, `master_admin`, `buyer`, `seller` confirmed in code)
- ✅ Organization onboarding (buyer + seller org models)
- ✅ Marketplace product/service listings (`marketplace.routes.ts`)
- ✅ Cart system (`cart.routes.ts`, migration `20260526180000_phase2_cart_system`)
- ✅ Direct Purchase routes (`direct-purchase.routes.ts`)
- ✅ Purchase Orders (`purchaseOrders` feature)
- ✅ Procurement Bid module (`procurementBid/`)
- ✅ Reverse Auction (`reverse-auction.routes.ts`)
- ✅ Tender Evaluation (`tender-evaluation.routes.ts`)
- ✅ Delivery tracking (`delivery/`)
- ✅ GRN (Goods Receipt Note) (`grn.routes.ts`)
- ✅ Approvals workflow (`approvals.routes.ts`)
- ✅ Disputes (`dispute.routes.ts`)
- ✅ Payments + Escrow (`payments/`, `escrow/`)
- ✅ Notifications (`notification.service.ts`)
- ✅ Audit middleware (`audit/`)
- ✅ File upload (Cloudinary/GCP storage services)
- ✅ GST verification (`gst.service.ts`)
- ✅ Email + SMS services
- ✅ Rate limiting, security headers, sanitization middleware
- ✅ Factoring (`factoring.routes.ts`)
- ✅ Compare (`compare.routes.ts`)
- ✅ Banner system (`banner.routes.ts`)
- ✅ Address management (`address.routes.ts`)
- ✅ KYC / Aadhaar (`kyc/`)
- ✅ SHG module (`shg.routes.ts`)
- ✅ Master admin (`master-admin.routes.ts`)

#### Frontend Modules — Present
- ✅ Auth (login, register, forgot password)
- ✅ Marketplace product list + filters
- ✅ Cart pages
- ✅ Direct Purchase checkout page (exists but has bugs — see below)
- ✅ Procurement bid pages (`procurementBid/pages/`)
- ✅ Procurement wizard (`procurementWizard/`)
- ✅ Purchase Orders pages
- ✅ Delivery pages (buyer + seller)
- ✅ GRN pages
- ✅ Approvals pages
- ✅ Disputes pages
- ✅ Payments/Escrow pages
- ✅ Invoices pages
- ✅ Notifications center
- ✅ Reverse Auctions pages
- ✅ Tender Evaluation pages
- ✅ Ratings
- ✅ Reports (MIS)
- ✅ Admin / Master Admin pages
- ✅ Org Team management
- ✅ Settings
- ✅ Vendor management
- ✅ Dashboard
- ✅ SearchableSelect UI component (exists but has overflow bug — fixed separately)
- ✅ ViewModeToggle
- ✅ Navbar

---

### 1.3 What is INCOMPLETE or WRONGLY IMPLEMENTED

#### Critical Bugs (Must Fix First)
1. **Direct Purchase Checkout 500 error** — POST `/api/direct-purchases/checkout` returns 500. Root cause unknown without backend logs. Likely: missing field validation, auth middleware issue, or Prisma schema mismatch.
2. **SearchableSelect dropdown clipped** — `Card` component hardcodes `overflow-hidden`; dropdowns are clipped. Fixed in page via `style={{ overflow: 'visible' }}` but needs global resolution.
3. **SSE stream token in URL** — `stream?token=<JWT>` is exposed in browser console/network tab. Should use HttpOnly cookie or short-lived stream token.
4. **ViewModeToggle misplaced** — appears in wrong location on marketplace page (should be beside cart icon).

#### Incomplete Modules
5. **PRC (Provisional Receipt Certificate)** — GRN exists but formal PRC entity/flow may be missing or incomplete. Needs audit of `grn.routes.ts` vs PRC requirements.
6. **CRAC (Consignee Receipt and Acceptance Certificate)** — May be partially implemented under GRN. Needs dedicated entity with inspection result, accepted/rejected quantity, warranty document.
7. **L1 Purchase flow** — Compare sellers exists (`compare.routes.ts`) but L1 selection with compliance confirmation, justification for non-L1, and L1-specific order flow is likely not implemented end-to-end.
8. **Corrigendum / Amendment flow** — Not visible in routes or frontend. Missing.
9. **EMD / PBG module** — Not confirmed present. Migration `20260527170000_add_bid_pricing_breakdown` exists but EMD/PBG as separate trackable entities likely missing.
10. **BOQ-based bid** — Procurement wizard exists but BOQ-specific line items, Excel upload, and BOQ validation status likely incomplete.
11. **PAC / Proprietary procurement** — Procurement wizard may have partial support but PAC certificate upload, competent authority approval, price reasonability document flow likely incomplete.
12. **Two-packet bid** — Technical + financial packet separation likely not implemented.
13. **Multiple consignee support** — Address module exists but per-consignee quantity distribution and bulk consignee upload likely missing.
14. **Procurement mode validation service** — No dedicated service visible for checking cart value thresholds, demand splitting warnings, or procurement method recommendations.
15. **L1 comparison screen** — Compare feature exists but formal L1 marker, compliance status column, and non-L1 justification gate likely missing.
16. **Demand splitting detection** — Not visible in current codebase.
17. **Payment Mode PFMS/State Treasury tracking** — Payment module exists but government-specific payment modes (PFMS, State Treasury) and bill processing status may be missing or incomplete.
18. **Configurable procurement thresholds** — Value thresholds for Direct Purchase / L1 / Bid are likely hardcoded or absent. Should be admin-configurable.
19. **Global dropdown rule (N/A + Other)** — SearchableSelect already has `allowOther` prop but `allowNA` is missing. Not consistently applied across all forms.
20. **Field config schema approach** — Forms appear to be built with hardcoded JSX fields rather than a config-driven field matrix.
21. **Audit log completeness** — Audit middleware exists but coverage of all required actions (PRC generated, CRAC generated, payment released, etc.) likely incomplete.
22. **Report exports** — MIS Reports page exists but CSV/Excel/PDF export per report type likely incomplete or absent.

#### Potentially Unnecessary / Duplicate Code
23. **Multiple check scripts in backend root** — `check_db.ts`, `check_gst_cache.ts`, `check_ironman_purchases.ts`, `check_prices.ts`, `check_product_visibility.ts`, `check_purchases.ts`, `check_quotes.ts`, `check_sellers.ts`, `check_users.ts`, `db_check.cjs`, `db_check.js` — these are developer debug scripts, not production code. Safe to move to a `/scripts/dev-debug/` folder or add to `.gitignore`.
24. **`test_payment_initiate.ts`, `test-email.ts`, `test-redis.ts`** in `backend/src/` — test scripts in source folder. Should be moved to `scripts/` or `tests/`.
25. **Duplicate route patterns** — `phase4.routes.ts` exists alongside dedicated feature routes. Likely a legacy consolidation artifact. Needs audit.
26. **`DevelopmentAgentation.tsx`** — Unclear purpose from name alone. Needs inspection before removal.

---

### 1.4 Business Logic Decisions Needed (Must Confirm Before Implementation)

The following require your confirmation. **Implementation will not start on these areas until you answer.**

---

#### BL-01: Procurement Value Thresholds
> What are the exact value limits for each procurement method?

Default GeM-style thresholds (confirm or change):
- Direct Purchase: up to ₹25,000?
- L1 Purchase: ₹25,001 to ₹2,00,000?
- Bid (e-Bid): above ₹2,00,000?
- RA: above ₹5,00,000?
- PAC: any value with justification?

**Should these be configurable per organization from admin settings, or fixed system-wide?**

---

#### BL-02: Approval Workflow
> Is internal approval mandatory for ALL purchases, or only above a certain threshold?

Options:
- A) Always mandatory regardless of value
- B) Mandatory only above a configurable threshold
- C) Mandatory only for bids, not direct purchase below threshold
- D) Configurable per organization/department

---

#### BL-03: Payment Architecture
> How does payment actually happen in this portal?

Options:
- A) Portal only tracks payment status (no actual money movement through platform)
- B) Portal has escrow — buyer pays into portal, seller gets paid from portal
- C) PFMS/State Treasury integration (government portal style)
- D) Razorpay/Cashfree gateway for actual collection
- E) Mixed: escrow for some, tracking-only for government buyers

**Escrow module already exists in codebase — should it be used for direct purchases?**

---

#### BL-04: Multiple Sellers Per Order
> Can a single order/cart checkout go to multiple sellers simultaneously?

Current cart appears to group by seller. Confirm:
- A) One order per seller (current apparent behavior)
- B) Single order document with multiple seller sub-orders
- C) Buyer must create separate carts per seller

---

#### BL-05: Partial Delivery and Partial Payment
> Should partial delivery and partial payment be supported?

- Can a seller deliver 60 out of 100 items?
- Can payment be released for 60 items while waiting for remaining 40?
- Should a partial CRAC be possible?

---

#### BL-06: PAC Approval Authority
> Who must approve PAC (Proprietary Article Certificate) procurement?

- A) Same approving authority as regular orders
- B) Higher authority (department head)
- C) Admin/Master Admin must co-approve
- D) Configurable

---

#### BL-07: EMD and PBG — Implement Now or Placeholder?
> Should EMD (Earnest Money Deposit) and PBG (Performance Bank Guarantee) be:

- A) Fully implemented with tracking, document upload, refund status
- B) Placeholder fields only (store data, no processing logic)
- C) Skip for now — add in next phase

---

#### BL-08: Seller Rejection Handling
> If a seller rejects an order, what should happen?

- A) Buyer must manually select a new seller
- B) System automatically moves to next L1/available seller
- C) Order is cancelled and buyer must restart from cart
- D) Buyer can reassign within a time window

---

#### BL-09: Demand Splitting Detection
> Should the portal block or only warn when demand splitting is detected?

- A) Hard block — cannot submit if splitting is detected
- B) Soft warning — show warning but allow with justification text
- C) Alert admin only — buyer proceeds but admin is notified
- D) Skip detection for now

---

#### BL-10: Two-Packet Bid
> For two-packet bids (technical + financial), should:

- A) Technical packet be opened first, only qualified sellers' financial packets opened
- B) Both packets uploaded at submission, opened in sequence by buyer/admin
- C) Sellers upload separately for each packet
- D) Skip for Phase 1

---

#### BL-11: Public vs Private Data
> Which data should be publicly accessible (without login)?

- A) Only published bid notices (title, closing date, category) — no prices/seller names
- B) Nothing — entire portal requires login
- C) Marketplace product listings are public, but prices require login
- D) Awards/results are public after bid closure

---

#### BL-12: SHG / Special Category
> The codebase has an SHG (Self-Help Group) module. Should SHG sellers:

- A) Get procurement preference (e.g., price preference up to X% over L1)
- B) Be shown with special badge only
- C) Have separate procurement path
- D) Be treated same as regular sellers for now

---

## SECTION 2: IMPLEMENTATION PLAN

*This section will be executed **only after** business logic confirmations above are received.*

---

### PHASE 0: Immediate Bug Fixes (Start Now — No Business Logic Needed)

| # | Task | Files | Priority |
|---|---|---|---|
| 0.1 | Fix Direct Purchase checkout 500 error | `backend/src/routes/direct-purchase.routes.ts` + service | 🔴 CRITICAL |
| 0.2 | Fix SearchableSelect global overflow (add `allowNA` prop, apply globally) | `SearchableSelect.tsx` | 🔴 CRITICAL |
| 0.3 | Fix SSE stream token exposure | `realtime.service.ts` + frontend EventSource | 🔴 CRITICAL |
| 0.4 | Fix ViewModeToggle placement | Marketplace page + Navbar | 🟡 HIGH |
| 0.5 | Move dev debug scripts to safe folder | Backend root `check_*.ts` files | 🟢 LOW |

---

### PHASE 1: Foundation — After BL Confirmations

#### 1A: Global Dropdown System
- Extend `SearchableSelect` with `allowNA` prop
- Create `SearchableMultiSelect` component  
- Create `FieldConfig` TypeScript type/interface
- Create `dropdownHelpers.ts` — auto-adds N/A and Other per field config
- Create `OtherTextInput` sub-component
- Update all existing forms to use config-driven approach

**Files to create:**
```
frontend/src/components/ui/SearchableMultiSelect.tsx
frontend/src/components/ui/OtherTextInput.tsx
frontend/src/lib/fieldConfig.ts
frontend/src/lib/dropdownHelpers.ts
frontend/src/constants/procurementOptions.ts
```

#### 1B: Role Model Expansion
- Audit current roles vs required roles
- Add missing roles: `approving_authority`, `consignee`, `paying_authority`, `evaluator`
- Update RBAC middleware to enforce new roles
- Update frontend role checks
- Migration for new role values

**Files to update:**
```
backend/src/constants/roles.ts
backend/src/middleware/authorize.ts
backend/prisma/schema.prisma (if role is enum)
frontend/src/constants/roles.ts
frontend/src/lib/permissions.ts
```

#### 1C: Procurement Configuration Service
- Admin-configurable procurement thresholds
- Demand splitting detection logic
- Procurement method recommendation engine

**Files to create:**
```
backend/src/services/procurement-config.service.ts
backend/src/routes/procurement-config.routes.ts
frontend/src/features/admin/pages/ProcurementSettings.tsx
```

---

### PHASE 2: Cart and Checkout Enhancement

#### 2A: Cart Enhancements
- Add `procurementMethod` to cart
- Add `methodJustification` field
- Add `demandSplittingConfirmed` flag
- Add `brandRestrictionConfirmed` flag
- Add cart status enum (Draft → Reviewed → Method Selected → Submitted → Approved → Converted)
- Save cart as draft
- Cart review step with full details

#### 2B: Procurement Method Selection Screen
- Method recommendation based on cart value + category
- Warnings for high-value direct purchase
- Non-recommended method justification gate
- L1 flag if multiple sellers available

#### 2C: Consignee Module
- Single/multiple consignee support
- Per-consignee quantity split
- Bulk consignee Excel upload
- Validate address/district/PIN/quantity

**New DB tables needed:**
```
CartConsignee
```

---

### PHASE 3: Direct Purchase Flow Fix and Completion

- Fix checkout 500 (Phase 0 prerequisite)
- Add all required field validation per DIRECT PURCHASE REQUIRED FIELDS matrix
- Budget confirmation field
- Sanction amount field
- Payment authority field
- Acceptance criteria field
- Proper status transitions per Direct Purchase status list
- Frontend checkout form completion

---

### PHASE 4: L1 Purchase Flow

- L1 comparison screen with all required columns
- L1 marker logic (lowest price = L1)
- Non-L1 selection gate (require justification + approval)
- L1 compliance confirmation checkbox
- Audit trail for L1 selection

**New DB fields needed on PurchaseOrder or DirectPurchase:**
```
isL1Purchase
l1ComplianceConfirmed
nonL1Justification
comparedSellers (JSON or relation)
```

---

### PHASE 5: Bid Creation Wizard Enhancement

Current `procurementWizard/` exists but needs:

- Step 1: Bid Type + Packet Type + Creation Mode (config-driven)
- Step 2: Buyer Details (auto-fill from auth)
- Step 3: Bid Basic Details (full field matrix)
- Step 4: Dynamic fields per bid type:
  - Product Bid fields
  - Service Bid fields
  - Custom Bid fields
  - BOQ Bid (with Excel upload + manual entry)
- Step 5: Consignee/Delivery (with multiple consignee support)
- Step 6: Eligibility and Evaluation
- Step 7: Terms, Documents, Compliance
- Step 8: RA settings (conditional)
- Step 9: PAC settings (conditional)
- Step 10: Preview + Publish

All fields must use `FieldConfig` schema approach.

---

### PHASE 6: PRC and CRAC Module

- Audit GRN module — determine overlap
- Create formal `PRC` entity if not already present
- Create formal `CRAC` entity
- PRC flow: delivery confirmed → PRC generated → inspection → CRAC
- Block invoice if CRAC incomplete
- Support: full accept, partial accept, reject, reinspection
- Warranty document upload on CRAC
- Installation confirmation on CRAC

**New DB tables:**
```
PRC (if not already PurchaseReceipt or GRN)
CRAC
InspectionRecord
```

---

### PHASE 7: Invoice and Payment Enhancement

- Block invoice submission before CRAC
- Add government payment modes (PFMS, State Treasury, GeM Pool)
- Bill processing status tracking
- Paying authority role enforcement
- Payment UTR/reference tracking
- Payment release confirmation

---

### PHASE 8: EMD and PBG Module

*(Depends on BL-07 confirmation)*

- EMD tracking per bid
- EMD exemption categories (MSME, Startup, etc.)
- PBG document upload + verification
- PBG refund status tracking

**New DB tables:**
```
EMD
PBG
```

---

### PHASE 9: Corrigendum / Amendment Flow

- Corrigendum draft → approval → publish
- Field-level change tracking (old value / new value / changed by)
- Version history for bids
- Seller notification on corrigendum publish
- Extend bid closing date
- Modify documents/terms

**New DB tables:**
```
Corrigendum
CorrigendumChange
```

---

### PHASE 10: Seller Acceptance Enhancement

- Seller acceptance/rejection flow (likely partially exists)
- Rejection reason required
- Expected dispatch + delivery date on acceptance
- Auto-cancel if no response within configurable window
- Buyer notification on rejection
- Re-order flow after rejection *(depends on BL-08)*

---

### PHASE 11: Audit Log Completion

- Audit all missing events per requirements
- Add IP capture to audit middleware
- Audit log viewer in admin panel
- Report export for audit logs

---

### PHASE 12: Reports Enhancement

- Procurement method-wise report
- Buyer-wise spend
- Seller-wise orders
- Category-wise spend
- Delivery SLA report
- PRC/CRAC pending report
- Payment pending report
- Cancelled orders report
- Dispute report
- CSV/Excel export for each report
- Role-based access on reports

---

### PHASE 13: Notification Coverage

- Audit existing notification events
- Add missing events per notification list in requirements
- Connect to email service for critical events
- SMS for high-priority events (if SMS service available)

---

### PHASE 14: Security Hardening

- IDOR checks on all buyer/seller/order routes
- Signed/private URLs for sensitive documents
- Rate limiting on checkout and bid publish
- Validate file types + sizes on all uploads
- Remove JWT from SSE URL query string (Phase 0 item)
- Admin route protection audit

---

## SECTION 3: FILE CHANGE SUMMARY (Planned)

### New Frontend Files
```
src/components/ui/SearchableMultiSelect.tsx
src/components/ui/OtherTextInput.tsx
src/lib/fieldConfig.ts
src/lib/dropdownHelpers.ts
src/constants/procurementOptions.ts
src/constants/fieldMatrix.ts
src/features/procurementWizard/fieldConfigs/productBidFields.ts
src/features/procurementWizard/fieldConfigs/serviceBidFields.ts
src/features/procurementWizard/fieldConfigs/customBidFields.ts
src/features/procurementWizard/fieldConfigs/boqBidFields.ts
src/features/procurementWizard/fieldConfigs/raBidFields.ts
src/features/procurementWizard/fieldConfigs/pacFields.ts
src/features/directPurchase/pages/L1PurchasePage.tsx
src/features/directPurchase/pages/L1ComparisonScreen.tsx
src/features/grn/pages/PRCPage.tsx
src/features/grn/pages/CRACPage.tsx
src/features/corrigendum/ (new feature folder)
src/features/emd/ (new feature folder)
src/features/admin/pages/ProcurementSettings.tsx
```

### New Backend Files
```
src/services/procurement-config.service.ts
src/services/l1-comparison.service.ts
src/services/demand-splitting.service.ts
src/services/prc.service.ts
src/services/crac.service.ts
src/services/corrigendum.service.ts
src/services/emd-pbg.service.ts
src/routes/procurement-config.routes.ts
src/routes/prc.routes.ts
src/routes/crac.routes.ts
src/routes/corrigendum.routes.ts
src/routes/emd.routes.ts
```

### New Prisma Migrations Planned
```
add_prc_crac_entities
add_l1_purchase_fields
add_consignee_quantity_split
add_corrigendum_module
add_emd_pbg_module
add_procurement_config
add_cart_procurement_method_fields
add_audit_log_coverage
```

---

## SECTION 4: EXECUTION ORDER

```
Week 1:  Phase 0 (bug fixes) + BL confirmations collected
Week 2:  Phase 1 (foundation: global dropdowns, roles, config)
Week 3:  Phase 2-3 (cart + direct purchase completion)
Week 4:  Phase 4-5 (L1 purchase + bid wizard enhancement)
Week 5:  Phase 6-7 (PRC/CRAC + invoice/payment)
Week 6:  Phase 8-10 (EMD/PBG + corrigendum + seller acceptance)
Week 7:  Phase 11-14 (audit, reports, notifications, security)
Week 8:  Testing, QA, build verification, documentation
```

---

## SECTION 5: QUESTIONS REQUIRING YOUR ANSWER

Please answer the following before implementation begins on Phases 1–14.

| ID | Question | Options |
|---|---|---|
| BL-01 | Procurement value thresholds | See Section 1.4 |
| BL-02 | Is approval mandatory for all purchases? | A/B/C/D |
| BL-03 | Payment architecture — tracking or actual movement? | A/B/C/D/E |
| BL-04 | Multiple sellers per order? | A/B/C |
| BL-05 | Partial delivery and partial payment? | Yes/No + details |
| BL-06 | PAC approval authority | A/B/C/D |
| BL-07 | EMD/PBG — full, placeholder, or skip? | A/B/C |
| BL-08 | Seller rejection handling | A/B/C/D |
| BL-09 | Demand splitting — block or warn? | A/B/C/D |
| BL-10 | Two-packet bid — implement or skip? | A/B/C/D |
| BL-11 | What data is publicly visible? | A/B/C/D |
| BL-12 | SHG preference logic | A/B/C/D |

---

## SECTION 6: THINGS THAT WILL NOT BE CHANGED

- Existing working auth flow
- Existing working marketplace listing
- Existing working cart add/remove
- Existing notification service internals
- Existing payment gateway integrations (Razorpay/Cashfree)
- Existing file storage services
- Existing email/SMS service internals
- Existing database migrations (append-only)

---

## SECTION 7: RISK FLAGS

| Risk | Mitigation |
|---|---|
| Direct Purchase 500 error — unknown root cause without backend logs | Need terminal stack trace before fixing |
| Schema drift — multiple migrations suggest manual schema repairs | Run `prisma db pull` to verify actual DB state before new migrations |
| Procurement wizard may have non-obvious existing state | Audit before rewriting — may need refactor not rebuild |
| GRN vs PRC naming confusion | Map GRN fields to PRC/CRAC requirements before creating new tables |
| SSE reconnect loop may be caused by auth expiry | Fix token handling before adding backoff |
| Role model expansion may break existing role checks | Add roles incrementally, keep backward compat |

---

*Last updated: June 2026*  
*Plan version: 1.0 — Awaiting business logic confirmations to finalize Phases 1–14*