# Comprehensive Procurement Matrix, Lifecycle & Edge Cases Specification

## Executive Summary
This document provides an exhaustive, production-grade technical specification of the procurement framework implemented across the **MSME Enterprise Procurement Portal**. It covers all **6 procurement methods**, all **dropdown permutation matrices**, the **end-to-end operational lifecycle** (from creation to delivery and offline payment slip verification), and documents all known **edge cases, bottlenecks, and defensive security measures**.

---

## 1. Procurement Methods & Permutation Matrix

The portal supports 6 primary procurement methods, each configured through the multi-step Sourcing Wizard (`CreateProcurementPage.tsx` / `bid-wizard.validation.ts`):

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   PROCUREMENT METHODS                                       │
├───────────────────┬──────────────────────────────────────────────────────────────────────────┤
│ RFQ               │ Request for Quotation: Rapid goods/services purchase, standard specs     │
│ RFP               │ Request for Proposal: Complex requirements with technical & cost scoring │
│ OPEN_TENDER       │ Public Competitive Bidding: High-value, national reach                   │
│ LIMITED_TENDER    │ Selective Bidding: Restricted to pre-qualified or invited vendors        │
│ RATE_CONTRACT     │ Long-term Standing Price Agreement: Fixed unit rates for period          │
│ REVERSE_AUCTION   │ Dynamic Price Discovery: Real-time downward bidding above threshold      │
└───────────────────┴──────────────────────────────────────────────────────────────────────────┘
```

### Full Configuration Permutation Table

| Dimension | Permutation Options | Validation Rules & System Behavior |
| :--- | :--- | :--- |
| **Procurement Method** | • `RFQ`<br>• `RFP`<br>• `OPEN_TENDER`<br>• `LIMITED_TENDER`<br>• `RATE_CONTRACT`<br>• `REVERSE_AUCTION` | Enforces specific wizard steps. For example, `REVERSE_AUCTION` requires starting bid price and minimum decrement; `RATE_CONTRACT` requires contract validity period and estimated annual drawal. |
| **Sourcing Strategy** | • `Public Sourcing (Open)`<br>• `Limited / Invited Sourcing`<br>• `Direct / PAC Procurement` | **Public**: Accessible to all verified MSMEs/SHGs on marketplace.<br>**Limited**: Bidding gated strictly by `invitedSellers` array / `isActorInvitedToBid`. Non-invited sellers receive HTTP 403 / restricted view. |
| **Scope Category** | • `Goods / Products`<br>• `BOQ Multiline`<br>• `Services`<br>• `Works / Custom` | **Goods**: Brand preference, model, warranty, inspection type.<br>**BOQ Multiline**: Excel template upload or multi-row editor. Item-wise quantities, HSN/SAC, GST rate, unit of measure.<br>**Services**: Manpower count, shifts, SLA parameters, contract duration.<br>**Works**: Milestones, technical proposal format, deliverables. |
| **Packet Configuration** | • `Single Packet (Cover 1)`<br>• `Two Packet (Cover 1 + Cover 2)` | **Single Packet**: Technical credentials and price opened simultaneously.<br>**Two Packet**: Cover 1 (Technical & Eligibility) opened first. Cover 2 (Financial Quote) is cryptographically locked (`LOCKED`) until technical qualification is complete. |
| **Urgency & Delivery Timelines** | • `Emergency` (1–3 Days)<br>• `Urgent` (Within 1 Week / 7 Days)<br>• `Normal` (15–30 Days)<br>• `Extended` (Quarterly / Milestones) | Validated by `closingDate > publishingDate`. Emergency bids trigger high-priority alerts to sellers. Standard delivery SLA is attached to generated Purchase Orders. |
| **Evaluation Method** | • `L1 (Lowest Landed Cost)`<br>• `QCBS (Weighted Tech-Comm Score)`<br>• `Schedule of Rates (SOR)`<br>• `Item-wise Split Award` | **L1 Landed Cost**: Formula includes Base Price + GST + Freight + Loading.<br>**QCBS**: Configurable technical/financial weighting (e.g., 70:30, 80:20). Total score out of 100.<br>**Split Award**: Allows splitting quantities between $L_1$ and $L_2$ (if $L_2$ matches $L_1$ price). |
| **Commercial Terms** | • `Payment Terms`: 100% on Delivery, Milestone-based, Net 30, Net 45 (MSMED Act)<br>• `Delivery Terms`: FOR Destination, Ex-Factory, CIF, FOB | Attached to Purchase Order contract. Auto-generates statutory interest tracking if payment exceeds 45 days under Section 16 of the MSMED Act 2006. |

---

## 2. End-to-End Operational Lifecycle

The procurement lifecycle follows a rigid, audit-logged state machine:

```
[1. DRAFT] ──► [2. PUBLISHED] ──► [3. CLARIFICATION] ──► [4. PARTICIPATION]
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
▼
[5. TECHNICAL SCRUTINY] ──► [6. FINANCIAL UNSEALING] ──► [7. AWARD & PO]
                                                                  │
┌─────────────────────────────────────────────────────────────────┘
▼
[8. DELIVERY TRACKING] ──► [9. ACCEPTANCE] ──► [10. OFFLINE PAYMENT SLIP]
```

### Stage 1: Procurement Creation & Publishing
- Buyer drafts the procurement across the 8-step wizard.
- If admin approval is required, status transitions to `PENDING_ADMIN_APPROVAL`.
- Once approved or directly published by verified buyers, status becomes `PUBLISHED` / `OPEN_FOR_BIDDING`.

### Stage 2: Clarification Window
- **Seller Inquiry**: Sellers/SHGs submit technical or commercial queries via `POST /api/procurement-bids/:bidId/clarifications/ask`.
- **Buyer Clarification**: Buyer requests clarification from a specific participant via `POST /api/buyer/procurement-bids/:bidId/clarifications`, transitioning the participant's status to `CLARIFICATION_REQUIRED`.
- **Response & Attachment**: Seller responds via `POST /api/procurement-bids/:bidId/clarifications/:id/respond` with optional supporting document attachments.
- **Audit Logging**: All events are immutably logged via `procurementAudit` with actor, timestamp, IP address, and payload diff.

### Stage 3: Seller & SHG Participation (Two-Cover Flow)
- **Cover 1 (Technical & Statutory)**:
  - Seller uploads eligibility proofs (Udyam Certificate, Experience, OEM authorization, Technical compliance sheet).
  - For SHGs, corporate filings (CIN, corporate PAN, GST) are waived; group registration, member list, and bank passbooks are accepted.
- **Cover 2 (Commercial Quote / BOQ)**:
  - Line-item prices, GST percentages, freight, and loading charges are submitted.
  - **The Bias Lock**: The backend seals Cover 2 with:
    ```typescript
    financialStatus: 'LOCKED'
    ```
  - Quoted rates are hidden from buyers, committee members, and competing bidders.

### Stage 4: Technical Evaluation & Scrutiny
- Evaluation committee reviews technical submissions.
- Evaluators assign `QUALIFIED` or `DISQUALIFIED` with mandatory written remarks.
- **Scrutiny Completion Gate**: All submitted bidders must be evaluated before the system permits completing the technical phase (`TECHNICAL_EVALUATION_COMPLETED`).
- **Disqualified Quote Protection**: Disqualified sellers permanently retain `financialStatus: 'LOCKED'`. Their commercial quotes are never exposed.

### Stage 5: Financial Landed Cost Evaluation & Ranking
- Triggered via `openFinancialEvaluationLandedCost`.
- Evaluates only `QUALIFIED` bidders who have valid financial submissions.
- **Landed Cost Engine**:
  $$\text{Landed Cost} = \text{Base Price} + \text{GST Amount} + \text{Freight} + \text{Loading / Handling}$$
- Bidders are sorted by landed cost ascending and assigned ranks ($L_1, L_2, L_3, \dots$).
- **Single-Bidder Protocol**: If only 1 bidder qualifies, the system halts with:
  ```json
  { "error": "SINGLE_BID_CONFIRMATION_REQUIRED" }
  ```
  The buyer must provide explicit administrative confirmation (`singleBidConfirmed: true`) to proceed.

### Stage 6: Selection, Award & Purchase Order Generation
- Buyer recommends award to $L_1$ (`recommendAward`) or initiates split award (`recommendSplitAward` / `inviteL2ToMatchL1`).
- Admin approves final award (`approveFinalAward`).
- The system automatically triggers `createOrReuseProcurementPOForAward`:
  - Generates a unique PO Number (`PO-YYYY-XXXXXX`).
  - Sets up delivery milestone schedules.
  - Automatically compiles the official Purchase Order PDF via `getOrGeneratePurchaseOrderPdfBuffer`.
  - Dispatches email notification to the winning seller/SHG with the PO PDF attached.

### Stage 7: Delivery Tracking Lifecycle
The generated PO automatically links to `DeliveryTracking`, advancing through rigid stages:
1. `CREATED` ➔ Order generated.
2. `SELLER_ACCEPTED` ➔ Seller confirms manufacturing/procurement readiness.
3. `DISPATCHED` ➔ Goods shipped; courier, waybill, and tracking number recorded.
4. `DELIVERED` ➔ Physical delivery at consignee location.
5. `ACCEPTED` ➔ Consignee inspects goods and issues Good Receipt Note (GRN) acceptance.

### Stage 8: Payment via Offline Slip Upload & Verification
1. **Slip Submission**:
   - Buyer or Seller uploads scanned proof of offline payment (NEFT, RTGS, Treasury challan, or Bank draft) via `POST /api/payments/invoice/:invoiceId/offline-proof` or `POST /api/payments/:orderId/offline-proof`.
   - Captures payment date, reference/UTR number, payment mode, bank name, and file asset ID.
2. **Admin Verification**:
   - Finance/Admin verifies the receipt via `POST /api/payments/offline-proof/:proofId/verify`.
   - Transitions proof status to `VERIFIED`.
   - Transitions transaction status to `OFFLINE_PROOF_VERIFIED`.
   - Automatically marks invoice `status: 'paid'` and purchase order `status: 'paid_offline_verified'`.
3. **Escrow Release**:
   - If handled via escrow, finance triggers `releasePayment` requiring **2FA OTP verification** (`twoFactorVerified: true`).

---

## 3. Edge Cases & Handling Mechanisms

| Edge Case | Risk / Impact | System Mitigation & Resolution |
| :--- | :--- | :--- |
| **Single Bidder Qualified** | Risk of non-competitive pricing and cartelization | System halts with `SINGLE_BID_CONFIRMATION_REQUIRED`. Buyer must review market price reasonability and supply justification flag (`singleBidConfirmed: true`). |
| **Tied $L_1$ Quoted Rates** | Indecision on award recipient | Priority hierarchy: (1) MSME / Women SHG preference under PPP-MSE Order, (2) Highest technical scrutiny score, (3) Lowest delivery timeline SLA, (4) In-app reverse auction tie-breaker. |
| **Disqualified Bidder Peeking** | Bias or leakage of pricing information | Database stores financial quotes encrypted; serializer (`serializeParticipation`) filters out financial fields unless `canSeeFinancial` is true. Disqualified bidders' quotes are never unsealed. |
| **Clarification Window Expiry** | Bidders blocked indefinitely waiting for answers | Clarifications have a configured `dueDate`. If unanswered before bid closing date, the buyer must issue a bid corrigendum or extend the closing date. |
| **Partial BOQ Quoting** | Incomplete fulfillment across multi-line items | In BOQ bids, if `priceQuoteBasis: 'TOTAL_BOQ'`, participants must quote unit rates for 100% of line items. Incomplete line item lists are rejected at Step 4 validation. |
| **Duplicate Offline Slip Upload** | Fraudulent double-crediting of invoices | Proof submission validates unique combination of `transactionReference` and `payerUserId`. Status checks prevent re-verifying already verified transactions. |
| **Late Delivery Penalty (LD)** | Contractual dispute on delay deductions | Liquidated damages clause (`penaltyClause`) is locked into PO terms. System records timestamp of physical delivery vs scheduled SLA to compute applicable deduction percentage. |

---

## 4. Technical Bottlenecks & Architectural Solutions

1. **High Concurrency during Financial Opening**:
   - *Bottleneck*: Simultaneous sorting, landed cost computation, evaluation log insertion, and notification triggers across hundreds of participants.
   - *Solution*: Executed inside an atomic Prisma transaction (`db.$transaction`) with Neon-safe 20-second timeout configuration and Redis distributed lock.
2. **Large BOQ File Processing**:
   - *Bottleneck*: Memory exhaustion when parsing multi-megabyte Excel BOQ tables with thousands of items.
   - *Solution*: Streamed parsing using chunks, validation capped at 500 lines per batch, and async file asset linking.
3. **Real-time Bid Visibility & Leakage Prevention**:
   - *Bottleneck*: API endpoints exposing competitor lists or financial quotes through general queries.
   - *Solution*: Role-based projection scoping in `serializeBid` and `serializeParticipation`. The API excludes bidder names, counts, and amounts until published opening dates.

---

## 5. UI Presentation & Data Formatting Invariants

All frontend views ([`ProcurementDetailUnifiedView.tsx`](file:///c:/Pugarch/MSME_Portal_PugArch/MSME_PugArch/frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx), [`BidParticipationPage.tsx`](file:///c:/Pugarch/MSME_Portal_PugArch/MSME_PugArch/frontend/src/features/procurementBid/pages/BidParticipationPage.tsx), [`SellerEventDetailPage.tsx`](file:///c:/Pugarch/MSME_Portal_PugArch/MSME_PugArch/frontend/src/features/sellerOpportunities/pages/SellerEventDetailPage.tsx)) enforce strict data formatting standards:

1. **Zero Raw JSON Dumps**:
   - No instances of `{JSON.stringify(...)}` in production view templates.
2. **Exclusion of Database Internals**:
   - `noisyDetailKeys` actively strips `_id`, `__v`, `tenantId`, `technicalPacket`, `rawPayload`, `password`, and `token` from all rendering grids.
3. **Human-Readable Presentation**:
   - Numbers formatted as Indian Rupee currency: `formatMoney(val)` ➔ `₹1,50,000`.
   - Dates formatted in local Indian standard notation: `15 Mar 2026, 05:30 PM`.
   - Statuses displayed with semantic badges (`QUALIFIED`, `EVALUATED`, `L1`, `DISQUALIFIED`).
4. **Authentic Data Rule**:
   - Zero synthetic, randomized, or mock fallback records. All metrics and cards strictly reflect live database state.

---

## 6. Accessibility (VPAT AA) & Defensive Security

- **Keyboard Navigation (WCAG 2.1.1)**: Full tab index navigation across the participation wizard, modal traps for preview dialogs, and enter-key trigger handlers.
- **Form Labels & ARIA (WCAG 1.3.1 & 4.1.2)**: Every wizard field has an associated `<label htmlFor="...">`, `aria-required`, and `aria-invalid` with contextual error messaging.
- **Color Contrast (WCAG 1.4.3)**: High-contrast text palettes (slate-900 on white / slate-50) exceeding the 4.5:1 ratio requirement.
- **Defensive RBAC & Tenant Scoping**: Every mutating procurement route enforces `authenticate`, `requireAccountType`, and `requirePermission` with district/organization boundaries.
- **2FA Escrow Enforcement**: Releasing financial escrow or milestone disbursements strictly requires two-factor verification.
