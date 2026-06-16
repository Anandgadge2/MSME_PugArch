# Procurement Portal UX/UI & Workflow Simplification Audit

Date: 2026-06-16

## Executive summary

The portal already contains strong enterprise procurement capabilities, but the product surface exposes implementation nouns directly to users. The biggest UX issue is that first-time buyers must choose between **Requirements**, **RFQ**, **Tenders**, **Direct Purchase**, **Reverse Auctions**, **Bids**, **Quotations**, **Cart**, **Approvals**, **GRN**, **Invoices**, **Payments**, and **Escrow** before they understand the business outcome they want.

The recommended redesign is to keep the backend's formal procurement objects, but introduce a single user mental model:

> **Create Procurement → choose business intent → guided wizard → system recommends the compliant method → one common order lifecycle.**

Primary target outcome: a new MSME buyer or government officer can create a procurement in under 3 minutes without procurement training.

## Repository findings

### Application structure

- Frontend: Next.js/React app in `frontend/src`, with a catch-all app route delegating almost all screens through `frontend/src/App.tsx`.
- Backend: Express API in `backend/src`, with route aggregation in `backend/src/routes/index.ts`.
- Database: Prisma schema in `backend/prisma/schema.prisma` with domain models for marketplace, requirements, tenders, RFQ/quotes, auctions, purchase orders, delivery, GRN, invoices, payments, escrow, ratings, disputes, org roles, and master admin controls.

### Routing structure observations

`frontend/src/App.tsx` maps dozens of explicit paths to page components. This central route switch makes relationships hard to see and makes the sidebar mirror internal module boundaries instead of user tasks. Notable route clusters:

- Marketplace discovery: `/marketplace/*`, `/buyer/marketplace`, `/seller/marketplace`.
- Procurement creation or participation: `/buyer/requirements`, `/buyer/direct-purchase`, `/buyer/rfq`, `/buyer/tenders`, `/reverse-auctions`, `/bids`, `/buyer/publish-bid`.
- Fulfillment: `/buyer/orders`, `/seller/orders`, `/buyer/tracking`, `/seller/delivery`, `/seller/delivery-management`, `/grn`.
- Finance: `/buyer/invoices`, `/seller/invoices`, `/payments`, `/escrow`.
- Admin: `/admin/*`, `/master-admin`.

### Sidebar structure observations

The current sidebar is role-filtered, but still too long for buyers, sellers, and admins. It exposes technical modules as top-level peers: **Tenders**, **Quotations**, **Requirements**, **Direct Purchase**, **RFQ**, **Reverse Auctions**, **Create Auction**, **Cart**, **Cart Approvals**, **Technical Review**, **Approval Queue**, **Goods Receipt**, **Payments**, and **Escrow**. This overload is the root of the RFQ/Tender/Requirement confusion.

### API structure observations

The backend has modular routers for auth, payments, delivery, ratings, marketplace, organization/team, cart, approvals, GRN, tender evaluation, master admin, SHG, procurement bids, reverse auctions, disputes, and phase routes. The procurement bid module already includes an integrated order lifecycle API from bid creation through award, delivery, GRN, invoice, payment, and settlement. This should become the canonical lifecycle surface for all procurement methods.

### Database schema observations

The schema has overlapping procurement intent models:

- `BuyerRequirement` and `RequirementResponse` for open buyer needs.
- `Requirement` and `RequirementItem` for internal/core requirements.
- `DirectPurchase` for direct buy records.
- `QuoteRequest` and `QuoteResponse` for RFQ.
- `Tender`, `Bid`, `TenderItem`, `TenderDocument`, `TenderParticipant`, and evaluation models for formal tenders.
- `Auction`, `AuctionBid`, `AuctionParticipant`, `AuctionEventLog` for reverse auctions.
- `ProcurementBid`, `ProcurementBidParticipation`, `ProcurementBidAward`, and `ProcurementAuditLog` for another formal procurement/bid lifecycle.
- `PurchaseOrder`, `DeliveryWorkflow`, `GoodsReceiptNote`, `Invoice`, `PaymentTransaction`, `EscrowTransaction`, and `PaymentSettlement` for the common downstream lifecycle.

This confirms the UX should not delete capabilities; it should unify entry and tracking while preserving compliance-specific records underneath.

## Current UX problems ranked by severity

| Severity | Problem | Evidence | Impact | Recommendation |
|---|---|---|---|---|
| Critical | Too many procurement entry points | Buyer sidebar exposes Requirements, Direct Purchase, RFQ, Tenders, Reverse Auctions, Cart, Approvals, GRN separately | Users do not know where to start | Replace with one **Create Procurement** entry and one **My Procurements** area |
| Critical | Technical terms are top-level navigation labels | RFQ, GRN, Escrow, Reverse Auctions are shown without context | First-time MSMEs need training | Rename with business labels and show technical term as helper text |
| High | Duplicate and overlapping procurement models | Requirement, BuyerRequirement, QuoteRequest, Tender, ProcurementBid, Auction all exist | Similar workflows diverge | Add `ProcurementRequest` facade/orchestrator above existing models |
| High | Order lifecycle is fragmented | Delivery, GRN, invoices, payments, escrow are separate pages | Users cannot see current status or next action | Add a lifecycle tracker on all order/procurement pages |
| High | Admin and buyer concepts leak into seller UX | Sellers see RFQ, tenders, direct purchase as separate modules | Sellers need opportunity-based workflow | Use **Opportunities**, **My Bids**, **Orders**, **Payments** |
| Medium | Search is present but incomplete | Global search covers products, services, tenders, and quick pages | Users cannot search RFQs, orders, suppliers, invoices, requirements | Expand to all procurement objects |
| Medium | Forms are long and module-specific | Tender, RFQ, direct purchase, requirement forms are separate | Repeated data entry and abandonment | Convert to shared wizard components with autosave |
| Medium | Hidden admin controls | Admin functions are scattered across many `/admin/*` routes | Monitoring and approvals lack a single work queue | Create **Approvals & Monitoring** admin home |
| Low | Public marketplace is stronger than logged-in procurement IA | Marketplace pages are discoverable, internal procurement is not | Users can browse but not complete confidently | Use marketplace patterns inside procurement |

## Benchmark best practices to adopt

### GeM

- Guided procurement method selection based on category, value, rules, and seller availability.
- Clear compliance labels, approval trails, bid opening controls, and audit history.
- Seller opportunity discovery by category and eligibility.

### SAP Ariba / Coupa / Oracle Procurement Cloud

- One intake/request experience with behind-the-scenes sourcing, approval, contract, PO, invoice, and payment workflows.
- Role-specific work queues: requests to approve, sourcing events to evaluate, invoices to clear.
- Strong status models and audit trail visibility.

### Amazon Business

- Search-first buying, product detail pages, cart, checkout, approval routing, order tracking.
- Familiar language: buy, cart, order, invoice, delivery, reorder.
- Mobile-friendly cards and quick actions.

### IndiaMART / Udaan

- Lead/opportunity style seller experience.
- Inquiry/requirement posting for uncertain buyers.
- Supplier discovery with filters, verification cues, and response comparison.

## Proposed information architecture

### Current vs proposed

| Current concept | Proposed user-facing concept | Where it should live |
|---|---|---|
| Requirements | Post Requirement | Procurement → Create Procurement |
| RFQ | Request Quotations | Procurement → Create Procurement / My Procurements |
| Tender | Large Procurement | Procurement → Create Procurement / My Procurements |
| Reverse Auction | Negotiate Price | Procurement → Create Procurement / Advanced |
| Direct Purchase | Buy Directly | Marketplace / Cart / Procurement |
| Quotations | Supplier Responses | Suppliers / Responses |
| Bid Participation | My Bids | Seller → Opportunities / My Bids |
| Procurement Orders / Purchase Orders | Orders | Orders |
| GRN | Delivery Confirmation | Orders → Order detail |
| Escrow | Payment Hold | Payments → Escrow detail |
| Invoices | Invoices | Payments |
| Delivery Tracking | Delivery | Orders → Order detail |

### Target primary menus: buyer

1. Dashboard
2. Marketplace
3. Procurement
   - Create Procurement
   - My Procurements
   - Supplier Responses
   - Approvals
4. Orders
   - Active Orders
   - Delivery Confirmation
   - Delivery Tracking
5. Payments
   - Invoices
   - Transactions
   - Payment Hold / Escrow
6. Suppliers
   - Supplier Directory
   - Saved Suppliers
7. Reports
8. Administration
   - Team & Roles
   - Settings
   - Help

### Target primary menus: seller

1. Dashboard
2. Opportunities
   - New Opportunities
   - Request Quotations
   - Large Procurements
   - Buyer Requirements
   - Auctions
3. My Bids
4. Orders
   - Orders Received
   - Delivery Updates
5. Payments
   - Invoices
   - Payment Status
6. Marketplace
   - Products & Services
   - Storefront
7. Reports
8. Administration
   - Team & Roles
   - Settings
   - Help

### Target primary menus: admin

1. Dashboard
2. Approvals
   - Procurement Approvals
   - Seller / Buyer Approvals
   - Tender Approvals
   - Final Award Approvals
3. Monitoring
   - Active Procurements
   - Orders & Delivery
   - Payments & Escrow
   - Fraud Alerts
4. Marketplace
   - Catalogue Review
   - Categories
   - Homepage Sections
5. Organizations
   - Users
   - Organizations
   - Team & RBAC
6. Reports
7. Compliance
8. Settings

### Target primary menus: master admin

1. Master Console
2. Companies
3. Features
4. Plans & Entitlements
5. System Monitoring
6. Audit Logs
7. Reports
8. Settings

## Unified procurement creation flow

### Entry point

Replace buyer entry points **Requirements**, **RFQ**, **Tenders**, **Direct Purchase**, **Reverse Auctions**, and **Create Auction** with a single primary CTA:

> **Create Procurement**

### Step 1: choose intent

Show business questions, not modules:

- **Buy directly from marketplace** — best when item is known and listed.
- **Request quotations from suppliers** — best when price comparison is needed.
- **Create a large procurement** — best for high-value formal tendering.
- **Negotiate through auction** — best when qualified sellers compete on price.
- **Post an open requirement** — best when buyer does not know the exact seller/product.

### Step 2: requirement details

Collect shared fields once:

- Product or service
- Category
- Quantity / unit
- Budget or estimated value
- Delivery location
- Required delivery date
- Specifications
- Supporting documents

### Step 3: AI/rule recommendation

The system recommends a method using amount, category, urgency, seller availability, compliance rules, and buyer organization approval rules.

Examples:

- "Based on value and open supplier base, use **Request Quotations**. You can receive multiple prices and compare them."
- "Based on high value and formal evaluation rules, use **Large Procurement / Tender**."
- "This item is available from verified sellers. Use **Buy Directly** for fastest completion."

### Step 4: method-specific wizard

After recommendation, only ask extra fields required by the selected method.

### Step 5: review and publish

Use one review screen with:

- Procurement summary
- Recommended method and reason
- Approval path
- Seller visibility
- Timeline
- Documents
- Compliance warnings

## Common procurement lifecycle

Every procurement method should display the same visual tracker:

1. Procurement Created
2. Supplier Selected
3. Purchase Order Generated
4. Seller Accepted
5. Delivery Started
6. Delivery Completed
7. Delivery Confirmation / GRN
8. Invoice Uploaded
9. Invoice Approved
10. Payment Initiated
11. Payment Held in Escrow
12. Settlement Released
13. Completed

Map formal method states into this common tracker instead of forcing users to learn separate status vocabularies.

## Screen-by-screen recommendation matrix

| Current screen/file area | Recommendation | New label / destination | Notes |
|---|---|---|---|
| `frontend/src/features/requirements/pages/RequirementsPage.tsx` | Merge | Create Procurement → Post Open Requirement | Keep as method-specific wizard step |
| `frontend/src/features/rfq/pages/RfqPage.tsx` | Merge/Rename | Request Quotations | Keep RFQ acronym as secondary helper only |
| `frontend/src/views/Tenders.tsx` | Merge/Rename | Large Procurement | Use tender wizard for formal flow |
| `frontend/src/features/directPurchase/pages/DirectPurchasePage.tsx` | Merge | Buy Directly | Prefer Marketplace → Cart → Checkout |
| `frontend/src/features/reverseAuctions/pages/*` | Merge/Rename | Negotiate Price | Move behind Advanced or Create Procurement |
| `frontend/src/features/procurementBid/pages/BuyerPublishBidPage.tsx` | Merge | Large Procurement / Bid Publishing | Avoid separate public path for buyers |
| `frontend/src/features/procurementBid/pages/BidsListingPage.tsx` | Rename | Opportunities | Seller/public opportunity discovery |
| `frontend/src/features/procurementBid/pages/BidParticipationPage.tsx` | Keep/Rename | Submit Bid | Seller workflow page |
| `frontend/src/features/procurementBid/pages/BidResultsPage.tsx` | Keep | Evaluation Results | Link from procurement detail |
| `frontend/src/views/Quotations.tsx` | Merge/Rename | Supplier Responses | Buyer comparison and seller submissions |
| `frontend/src/views/PurchaseOrders.tsx` | Keep/Rename | Orders | One downstream lifecycle screen |
| `frontend/src/features/grn/pages/GrnListPage.tsx` | Merge | Delivery Confirmation | Show from order detail and orders menu |
| `frontend/src/features/invoices/pages/InvoiceRegisterPage.tsx` | Keep | Invoices | Move under Payments |
| `frontend/src/features/payments/pages/PaymentHistoryPage.tsx` | Keep | Transactions | Move under Payments |
| `frontend/src/features/escrow/pages/EscrowPage.tsx` | Keep/Rename | Payment Hold / Escrow | Explain escrow in plain language |
| `frontend/src/views/ParcelTracking.tsx` | Merge | Delivery Tracking | Put under Orders |
| `frontend/src/features/sellerDelivery/pages/SellerDeliveryManagementPage.tsx` | Keep | Delivery Updates | Seller order subflow |
| `frontend/src/views/Vendors.tsx` | Keep/Rename | Supplier Directory | Buyer supplier discovery |
| `frontend/src/features/search/GlobalSearch.tsx` | Expand | Universal Search | Add orders, RFQs, requirements, invoices, suppliers |
| `frontend/src/features/approvals/pages/ApprovalQueuePage.tsx` | Keep | Approvals | Work queue, not top-level technical page for all roles |
| `frontend/src/features/cart/pages/CartPage.tsx` | Keep | Cart | Direct purchase flow only |
| `frontend/src/features/cart/pages/CartApprovalPage.tsx` | Merge | Approvals | Approval queue should own this |
| `frontend/src/features/cart/pages/TechnicalReviewPage.tsx` | Merge | Approval detail | Avoid standalone sidebar entry |
| `frontend/src/views/MISReports.tsx` and report pages | Keep | Reports | Role-specific dashboards and exports |
| `frontend/src/views/OrganizationManagement.tsx` | Keep | Organizations | Admin only |
| `frontend/src/features/orgTeam/pages/TeamManagementPage.tsx` | Keep | Team & Roles | Administration |
| `frontend/src/features/fraudAlerts/pages/FraudAlertsPage.tsx` | Keep | Fraud Alerts | Admin Monitoring |
| `frontend/src/features/compliance/pages/ComplianceRulesPage.tsx` | Keep | Compliance Rules | Admin Compliance |
| `frontend/src/views/PortalDocumentation.tsx` | Keep/Expand | Help & Assistant | Add contextual procurement glossary |

## Detailed major process flows

### 1. Direct Purchase Flow

**Purpose:** Amazon-style purchase of listed products/services.

**When to use:** Buyer knows what to buy and item/service is available from verified marketplace sellers.

**Roles involved:** Buyer, buyer approver, seller, finance/admin/bank.

**Step-by-step process:**

1. Buyer logs in and lands on Buyer Dashboard.
2. Buyer selects **Marketplace** or quick action **Buy Directly**.
3. Buyer searches products/services.
4. Buyer filters by category, supplier, district, price, availability, delivery time, rating, and verified seller.
5. Buyer opens product/service detail page.
6. Page shows description, price, GST, delivery timeline, seller details, certifications, documents, stock, return/service terms.
7. Buyer clicks **Add to Cart**.
8. Cart shows item, quantity, tax, delivery charges, total, seller split, approval requirement.
9. Buyer clicks **Proceed to Purchase**.
10. System checks buyer approval rules and budget limits.
11. If approval required, request goes to approver; otherwise PO is generated.
12. Seller receives order notification.
13. Seller accepts or rejects order.
14. Seller dispatches goods or provides service.
15. Buyer receives delivery.
16. Buyer creates delivery confirmation/GRN.
17. Seller uploads invoice.
18. Buyer verifies invoice.
19. Buyer initiates payment.
20. Payment goes to nodal/escrow account.
21. Admin/bank settlement process runs.
22. Seller receives settlement.
23. Order is marked completed.

**Required screens:** Marketplace list, product/service detail, cart, checkout review, approval detail, order detail, delivery tracker, GRN modal, invoice detail, payment/escrow detail.

**Required API changes:** Add unified checkout endpoint that creates a `ProcurementRequest` facade, links cart items, starts approval, generates PO, and returns lifecycle tracker. Expand marketplace search filters and availability facets.

**Required DB changes:** Add optional `procurementRequestId` to Cart, DirectPurchase, PurchaseOrder, Invoice, PaymentTransaction, EscrowTransaction; store selected seller and approval policy snapshot.

**Notifications:** approval requested, approval completed/rejected, PO generated, seller accepted/rejected, dispatched, delivered, GRN requested, invoice uploaded, payment held, settlement released.

**Status values:** draft_cart, pending_approval, approved, po_generated, seller_accepted, dispatched, delivered, grn_confirmed, invoice_uploaded, invoice_approved, payment_initiated, escrow_held, settled, completed, cancelled, rejected.

**Edge cases:** seller rejects order, stock changes after cart, approval rejected, partial delivery, invoice mismatch, payment failure, settlement hold, buyer disputes delivery.

**Simplification suggestions:** Use Amazon-style cart and order timeline; hide Direct Purchase as a technical module and label action **Buy Directly**.

### 2. Request Quotations / RFQ Flow

**Purpose:** Get prices and terms from multiple suppliers.

**When to use:** Buyer knows requirement but wants competitive quotations.

**Roles involved:** Buyer, sellers, buyer approver, finance/admin.

**Step-by-step process:**

1. Buyer clicks **Create Procurement**.
2. Buyer chooses **Request Quotations from Suppliers**.
3. Buyer enters item/service name, quantity, specifications, delivery location, expected delivery date, budget range, last date for quotation.
4. Buyer uploads documents if required.
5. System suggests matching verified sellers by category, location, eligibility, rating, and capacity.
6. Buyer selects all eligible sellers or selected sellers.
7. Buyer publishes request.
8. Sellers receive notification.
9. Sellers submit price, GST, delivery time, terms, and documents.
10. Buyer opens comparison table.
11. System highlights lowest price, fastest delivery, best-rated seller, complete documentation, and exceptions.
12. Buyer selects preferred quotation.
13. Approval workflow starts if needed.
14. Purchase order is generated.
15. Seller accepts order.
16. Delivery happens.
17. Buyer confirms GRN/service completion.
18. Seller uploads invoice.
19. Buyer initiates payment.
20. Payment goes to escrow/nodal account.
21. Settlement is completed.
22. RFQ is marked completed.

**Required screens:** Create Procurement wizard, seller recommendation drawer, RFQ publish review, seller quote submission, buyer comparison table, award/approval, order detail.

**Required API changes:** Create `/api/procurements` intake endpoint with method `REQUEST_QUOTATIONS`; add seller recommendation endpoint; normalize quote comparison response.

**Required DB changes:** Link `QuoteRequest` and `QuoteResponse` to `ProcurementRequest`; store recommendation rationale and comparison metrics.

**Notifications:** RFQ published, quote submitted, quote deadline reminder, quote selected/rejected, approval requested, PO generated, order lifecycle alerts.

**Status values:** draft, published, quotes_open, quotes_closed, under_comparison, selected, pending_approval, awarded, po_generated, completed, cancelled.

**Edge cases:** no seller responds, expired RFQ, seller revises quote, buyer asks clarification, approval rejects selected quote, selected seller declines PO.

**Simplification suggestions:** Label as **Request Quotations**; show "RFQ" only as a small compliance term.

### 3. Tender / Large Procurement Flow

**Purpose:** Formal high-value procurement with approvals, bid documents, evaluation, and award.

**When to use:** High-value, regulated, complex, or multi-stage procurement.

**Roles involved:** Buyer, admin, sellers, evaluators, finance/admin.

**Step-by-step process:**

1. Buyer clicks **Create Procurement**.
2. Buyer chooses **Large Procurement / Tender**.
3. Wizard asks basic details, scope of work, eligibility, technical requirements, financial bid rules, required documents, important dates, terms.
4. Buyer saves draft.
5. Buyer submits tender for internal/admin approval.
6. Admin reviews tender.
7. Admin approves, rejects, or requests changes.
8. Approved tender is published.
9. Eligible sellers receive notification.
10. Sellers view tender details.
11. Sellers submit two-cover bid: technical bid and financial bid.
12. Tender closes automatically after deadline.
13. Admin/buyer opens technical bids.
14. Technical evaluation is completed.
15. Qualified sellers move to financial evaluation.
16. Financial bids are opened.
17. System generates L1/L2/L3 ranking.
18. Buyer/admin selects award recommendation.
19. Final approval is completed.
20. Purchase order is generated.
21. Seller accepts award/order.
22. Delivery/work execution starts.
23. Buyer records milestones or GRN.
24. Seller uploads invoice.
25. Buyer verifies invoice.
26. Payment is initiated.
27. Amount is held in escrow/nodal account.
28. Settlement is released after approval.
29. Tender is marked completed.

**Required screens:** Large procurement wizard, draft list, admin approval queue, tender detail, seller bid submission, technical evaluation, financial evaluation, award recommendation, order lifecycle.

**Required API changes:** Put tender creation behind unified intake; reuse procurement bid APIs for two-cover evaluation; add lifecycle projection endpoint for tender detail.

**Required DB changes:** Link `Tender`, `Bid`, `ProcurementBid`, evaluation, award, and PO records to a shared `ProcurementRequest` id. Preserve immutable approval and rule snapshots.

**Notifications:** draft submitted, admin change requested, tender published, bid submitted, deadline warnings, technical result, financial opening, award recommendation, final award, PO generated, delivery/payment events.

**Status values:** draft, pending_admin_approval, changes_requested, published, bid_submission_open, bid_submission_closed, technical_evaluation, financial_evaluation, award_recommended, final_approval_pending, awarded, po_generated, execution, completed, cancelled.

**Edge cases:** no bids, single bid, late bid, document incomplete, admin requests changes, technical disqualification, tie in L1, award rejected, milestone failure.

**Simplification suggestions:** Rename to **Large Procurement** and explain "Tender is the formal compliance process used for large procurements."

### 4. Reverse Auction Flow

**Purpose:** Let sellers compete by lowering price in real time.

**When to use:** Requirement/specifications are fixed and price competition is desired among eligible suppliers.

**Roles involved:** Buyer, invited sellers, admin, finance.

**Step-by-step process:**

1. Buyer clicks **Create Procurement**.
2. Buyer chooses **Negotiate Price / Reverse Auction**.
3. Buyer enters requirement, quantity, base price, minimum decrement, start time, end time, eligible sellers.
4. System sends invitations.
5. Sellers accept participation.
6. Auction starts at scheduled time.
7. Sellers submit lower price bids.
8. System shows real-time ranking.
9. Auction closes automatically.
10. System identifies lowest valid bidder.
11. Buyer reviews final result.
12. Approval workflow starts if needed.
13. Purchase order is generated for winning seller.
14. Seller accepts order.
15. Delivery/work completion happens.
16. Buyer confirms GRN/service completion.
17. Invoice is uploaded.
18. Payment is initiated.
19. Escrow/nodal settlement is completed.
20. Auction is marked completed.

**Required screens:** Auction setup wizard, invite seller step, seller participation page, live auction room, results page, order lifecycle.

**Required API changes:** Wrap existing reverse auction routes under unified procurement; add seller eligibility API and common lifecycle endpoint.

**Required DB changes:** Link `Auction` to `ProcurementRequest`; store decrement rules, invited seller snapshot, final ranking, and award link.

**Notifications:** invitation, participation accepted, auction starting soon, outbid, winning bid, approval requested, PO generated, lifecycle events.

**Status values:** draft, invited, scheduled, live, closed, result_under_review, pending_approval, awarded, po_generated, completed, cancelled.

**Edge cases:** no participants, seller connection loss, bid tie, bid below invalid threshold, auction extension rules, winning seller rejects PO.

**Simplification suggestions:** Hide from primary buyer sidebar unless enabled; label as **Negotiate Price**.

### 5. Buyer Requirement / Open Requirement Flow

**Purpose:** Let buyers publish a need when they do not know exact products or sellers.

**When to use:** Buyer has a business need but wants suppliers to propose products/services.

**Roles involved:** Buyer, sellers, buyer approver, finance.

**Step-by-step process:**

1. Buyer clicks **Create Procurement** or **Post Requirement**.
2. Buyer selects **Post Requirement to Marketplace**.
3. Buyer enters title, category, details, quantity, location, budget, last response date, documents/images.
4. Requirement is published publicly or to eligible sellers.
5. Sellers view it from **Opportunities**.
6. Sellers submit response/proposal.
7. Buyer views responses.
8. Buyer can chat, ask clarification, shortlist, convert to RFQ, or convert to direct order.
9. Buyer selects seller or converts to another method.
10. PO, order, delivery, GRN, invoice, payment, and settlement follow common lifecycle.

**Required screens:** Requirement wizard, public/private requirement detail, seller response form, buyer response inbox, conversion modal, order lifecycle.

**Required API changes:** Normalize `BuyerRequirement` responses with procurement conversion endpoints: convert to RFQ, direct order, tender, or auction.

**Required DB changes:** Add `convertedToProcurementRequestId`, `conversionMethod`, and response shortlist markers.

**Notifications:** requirement published, seller response, clarification, shortlist, conversion, award/order events.

**Status values:** draft, published, responses_open, responses_closed, under_review, shortlisted, converted_to_rfq, converted_to_order, completed, cancelled.

**Edge cases:** spam responses, buyer unclear specs, no responses, response after deadline, seller not eligible, conversion requires approval.

**Simplification suggestions:** Treat this as one option in Create Procurement; do not show as an isolated technical page.

### 6. Seller Opportunity Flow

**Purpose:** Give sellers one place to find and act on buyer demand.

**When to use:** Every seller login.

**Roles involved:** Seller, buyer/admin reviewers, finance.

**Step-by-step process:**

1. Seller logs in.
2. Seller dashboard shows new RFQs, open tenders, buyer requirements, auctions, and orders.
3. Seller opens **Opportunities**.
4. System labels opportunity type in plain language: Quick Quote, Tender Bid, Buyer Requirement, Auction.
5. Seller checks eligibility.
6. Seller submits required quote/bid/response.
7. Seller tracks status: Submitted, Under Review, Shortlisted, Awarded, Rejected.
8. If awarded, seller accepts order.
9. Seller delivers goods/services.
10. Seller uploads invoice.
11. Seller tracks payment: Payment Pending, Payment Held, Settlement Processing, Settled.

**Required screens:** Seller dashboard, opportunities list with filters, opportunity detail, bid/quote/response submission, my bids, order detail, invoice upload, payment tracker.

**Required API changes:** Add aggregated `/api/seller/opportunities` endpoint combining RFQs, tenders, buyer requirements, auctions, and procurement bids.

**Required DB changes:** Optional denormalized `OpportunityIndex` or search view for seller matching and unread state.

**Notifications:** new opportunity, deadline reminder, clarification, submitted, shortlisted, awarded/rejected, order accepted required, invoice/payment events.

**Status values:** new, viewed, eligible, submitted, under_review, clarification_requested, shortlisted, awarded, rejected, order_accepted, delivered, invoiced, settled.

**Edge cases:** not eligible, expired opportunity, missing document, bid withdrawal, duplicate submission, buyer asks clarification.

**Simplification suggestions:** Stop exposing buyer process names as seller top-level nav; seller thinks in opportunities and orders.

### 7. Common Order Lifecycle

**Purpose:** Make every procurement method converge into one understandable fulfillment and payment experience.

**When to use:** After any supplier is selected.

**Roles involved:** Buyer, seller, approver, admin/bank/finance.

**Step-by-step process:**

1. Procurement Created.
2. Supplier Selected.
3. Purchase Order Generated.
4. Seller Accepted.
5. Delivery Started.
6. Delivery Completed.
7. Delivery Confirmation / GRN.
8. Invoice Uploaded.
9. Invoice Approved.
10. Payment Initiated.
11. Payment Held in Escrow.
12. Settlement Released.
13. Completed.

**Required screens:** Order detail as single command center, delivery tab, documents tab, invoice tab, payments tab, activity/audit tab.

**Required API changes:** Add `/api/orders/:id/lifecycle` and `/api/procurements/:id/lifecycle` projections that map source-specific statuses to common tracker states.

**Required DB changes:** Add `ProcurementLifecycleEvent` or reuse `ProcurementAuditLog`/status logs with normalized event types.

**Notifications:** next action reminders for each actor.

**Status values:** created, supplier_selected, po_generated, seller_accepted, delivery_started, delivery_completed, grn_confirmed, invoice_uploaded, invoice_approved, payment_initiated, escrow_held, settlement_released, completed.

**Edge cases:** partial delivery, partial invoice, GRN rejected, invoice rejected, payment failed, escrow dispute, cancellation, return/replacement.

**Simplification suggestions:** This tracker should appear on procurement detail, order detail, invoice detail, payment detail, and seller dashboard cards.

## Database impact

### Add facade models rather than replacing existing models immediately

Introduce a top-level procurement intake/facade model:

```prisma
model ProcurementRequest {
  id                    Int      @id @default(autoincrement())
  organizationId        Int?
  buyerId               Int
  method                ProcurementRequestMethod
  userFacingTitle       String
  technicalType         String?
  categoryId            Int?
  estimatedValue        Decimal?
  budgetMin             Decimal?
  budgetMax             Decimal?
  deliveryLocation      String?
  deliveryDate          DateTime?
  recommendationReason  String?
  status                ProcurementRequestStatus
  sourceModel           String?
  sourceId              Int?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

Recommended enums:

- `BUY_DIRECTLY`
- `REQUEST_QUOTATIONS`
- `LARGE_PROCUREMENT`
- `NEGOTIATE_PRICE`
- `POST_REQUIREMENT`

Add a normalized lifecycle event table:

```prisma
model ProcurementLifecycleEvent {
  id                    Int      @id @default(autoincrement())
  procurementRequestId  Int?
  purchaseOrderId       Int?
  stage                 ProcurementLifecycleStageUnified
  status                String
  actorRole             String?
  actorId               Int?
  metadata              Json?
  createdAt             DateTime @default(now())
}
```

### Link existing tables

Add nullable `procurementRequestId` to:

- `BuyerRequirement`
- `Requirement`
- `DirectPurchase`
- `QuoteRequest`
- `Tender`
- `Auction`
- `ProcurementBid`
- `PurchaseOrder`
- `Invoice`
- `PaymentTransaction`
- `EscrowTransaction`

### Add saved UX state

- Draft wizard state and autosave timestamp.
- User onboarding/tour completion state.
- Recent pages and favorites.
- Procurement recommendation reason and rule snapshot.
- Role-specific dashboard preferences.

## API impact

### New orchestration APIs

- `POST /api/procurements` — create draft procurement intake.
- `POST /api/procurements/:id/recommend-method` — return recommended method and rationale.
- `PUT /api/procurements/:id/details` — shared requirement details.
- `POST /api/procurements/:id/publish` — create/link method-specific record and publish.
- `GET /api/procurements/:id/lifecycle` — common tracker.
- `GET /api/procurements/my` — buyer list.
- `GET /api/seller/opportunities` — seller opportunities aggregation.
- `GET /api/search` — universal search across products, services, suppliers, procurements, tenders, RFQs, orders, invoices.
- `POST /api/requirements/:id/convert` — convert open requirement to RFQ, direct order, tender, or auction.

### Existing APIs to preserve

Keep existing module APIs for backward compatibility. The new APIs should orchestrate them and progressively replace direct UI calls.

## Frontend file-level implementation plan

### Phase 1: Navigation simplification

- Update `frontend/src/components/layout/Navbar.tsx` to replace many procurement items with grouped role menus and plain-language labels.
- Keep old routes but remove most from primary sidebar.
- Add route aliases in `frontend/src/App.tsx`:
  - `/buyer/procurement/create`
  - `/buyer/procurements`
  - `/seller/opportunities`
  - `/orders`
  - `/payments/invoices`
- Update `frontend/src/features/search/GlobalSearch.tsx` quick pages to use new labels and add aliases.

### Phase 2: Unified procurement flow

- Add `frontend/src/features/procurementWizard/pages/CreateProcurementPage.tsx`.
- Add `frontend/src/features/procurementWizard/components/ProcurementIntentStep.tsx`.
- Add `frontend/src/features/procurementWizard/components/RequirementDetailsStep.tsx`.
- Add `frontend/src/features/procurementWizard/components/RecommendationStep.tsx`.
- Add `frontend/src/features/procurementWizard/components/ReviewPublishStep.tsx`.
- Add `frontend/src/features/procurementWizard/api.ts` and `types.ts`.
- Internally delegate method-specific steps to existing RFQ, tender, requirement, direct purchase, and auction APIs.

### Phase 3: Dashboard redesign

- Update `frontend/src/views/Dashboard.tsx` and `frontend/src/features/dashboard/components/RoleAwareActionCards.tsx` with persona-specific quick actions and work queues.
- Buyer dashboard: pending approvals, active procurements, orders awaiting delivery confirmation, pending payments.
- Seller dashboard: new opportunities, submitted bids, orders received, payment status.
- Admin dashboard: pending approvals, active tenders/procurements, escrow exposure, fraud alerts.

### Phase 4: AI/context assistant

- Add `frontend/src/features/assistant/ProcurementAssistant.tsx`.
- Add contextual help data in `frontend/src/features/assistant/procurementGlossary.ts`.
- Start rule-based; integrate AI later for in-flow guidance.
- Example prompts: "What is RFQ?", "Should I use tender?", "How do I release payment?".

### Phase 5: Performance and mobile

- Continue lazy loading already present in `frontend/src/App.tsx`.
- Add route prefetch for the new create procurement wizard and dashboard queues.
- Convert procurement/order tables to responsive card layouts below tablet width.
- Add skeleton loaders for wizard, comparison tables, and lifecycle tracker.
- Use React Query caching for dashboards and procurement lists.

## Proposed components

### `ProcurementLifecycleTracker`

Props:

- `currentStage`
- `events`
- `nextAction`
- `role`
- `sourceType`

Use on procurement, order, invoice, payment, and seller opportunity detail screens.

### `ProcurementMethodAdvisor`

Rules:

- Marketplace item selected and stock available → Buy Directly.
- Multiple sellers available and value is moderate → Request Quotations.
- High value or formal evaluation required → Large Procurement.
- Fixed spec and price negotiation desired → Negotiate Price.
- Unknown seller/product → Post Requirement.

### `UniversalSearch`

Expand the existing global search to include:

- Products
- Services
- Suppliers
- Requirements
- RFQs / Request Quotations
- Large Procurements / Tenders
- Auctions
- Orders
- Invoices
- Payments

## Success metrics

- 90% of new buyers create a procurement without opening help.
- Median time to create procurement under 3 minutes for RFQ/direct purchase and under 8 minutes for tender draft.
- 50% reduction in sidebar items visible to each role.
- 30% reduction in abandoned procurement drafts.
- 80% of orders have lifecycle tracker viewed before support contact.
- Mobile completion support for marketplace purchase, RFQ creation, seller bid submission, GRN, invoice upload, and payment tracking.

## Implementation roadmap

### Phase 1: Navigation simplification

- Rename labels.
- Hide redundant sidebar entries.
- Add grouped menus or at minimum reduce primary items.
- Add route aliases.
- Add help tooltips for RFQ/Tender/Requirement.

### Phase 2: Unified procurement flow

- Build Create Procurement wizard.
- Add backend procurement facade endpoints.
- Connect existing method-specific APIs.
- Add autosave drafts every 10 seconds.

### Phase 3: Dashboard redesign

- Create role dashboards with quick actions and work queues.
- Add lifecycle cards and pending next actions.
- Add seller opportunities aggregation.

### Phase 4: AI assistant

- Add contextual assistant and glossary.
- Add method recommendation explainability.
- Later connect to AI service for natural-language Q&A.

### Phase 5: Performance optimization

- Prefetch likely route chunks.
- Virtualize long tables.
- Add skeleton states.
- Cache dashboard/search/procurement list APIs.
- Add mobile bottom navigation and floating create button.

## Final target experience

A first-time buyer sees:

1. **Dashboard** with a large **Create Procurement** button.
2. A plain-language choice: buy directly, request quotations, create large procurement, negotiate price, or post requirement.
3. A short guided form.
4. A recommendation explaining the best method.
5. A publish/review screen.
6. One procurement/order tracker from creation through settlement.

A first-time seller sees:

1. **Opportunities** instead of separate tender/RFQ/requirement pages.
2. Clear opportunity type labels.
3. One submission workflow.
4. One status tracker for bids, awards, orders, invoices, and payment.

This preserves GeM-grade compliance and enterprise procurement depth while creating an Amazon-like UX for non-expert users.
