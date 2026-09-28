# SIMPLIFIED PROCUREMENT RULES & ARCHITECTURE INVARIANTS

> **Permanent Architectural Directive**  
> This portal is intentionally architected as a **simple, streamlined MSME procurement portal**. The rules documented below are mandatory system invariants and must never be altered or regressed in future refactoring.

---

## 1. Zero EMD (Earnest Money Deposit)
* **Rule**: There is strictly **no EMD** anywhere in the system.
* **Invariants**:
  - No `EmdPayment` model, table, routes, or gating.
  - Sellers (MSMEs and SHGs) participate in tenders and bids without deposit or financial entry fees.
  - No EMD exemption certificates or payment verification steps are required.

---

## 2. Zero Sub-Categories
* **Rule**: All categories in the portal are **flat, single-level** product or service classifications.
* **Invariants**:
  - No nested parent-child subcategories or deep taxonomies.
  - The `Category` model contains only direct names, codes, and icons.
  - No `subCategory` columns or nested dropdown selections exist in procurement bids or reverse auctions.

---

## 3. Zero Award Splitting (Single Qualified Winner)
* **Rule**: Every tender or bid is awarded strictly **100% to a single winning bidder** (the evaluated Lowest Landed Cost $L_1$ or top-ranked QCBS bidder).
* **Invariants**:
  - No item-wise or line-item split awards (`ITEM_WISE_SPLIT_AWARD` is eliminated).
  - No counter-offer negotiations to invite $L_2$ to match $L_1$ pricing for partial quantity splitting.
  - All line items and BOQs belong to the single contract awarded to the winning seller.

---

## 4. Sequential Award & PO Acceptance Lifecycle (No Auto-PO)

The procurement conclusion strictly follows a **5-step sequential state machine**:

```
[1. Buyer Awards L1 Seller]
              │
              ▼ (Status: AWARD_OFFERED)
[2. Winning Seller Reviews & Accepts Award]
              │
              ▼ (Status: AWARD_ACCEPTED)
[3. Seller / System Generates Purchase Order]
              │
              ▼ (Status: PO_GENERATED / PENDING_ACCEPTANCE)
[4. Winning Seller Accepts the Purchase Order]
              │
              ▼ (Status: ORDERED / PO_ACCEPTED / FULFILLMENT)
[5. Standby Bidders Transition to NOT_SELECTED & Receive Notification]
```

### Detailed Sequential Steps:

1. **No Auto-PO on Award**:
   - When a buyer selects a winning seller ($L_1$), the system creates an award record with `awardStatus: 'OFFERED'`.
   - **No Purchase Order is generated automatically** at this stage.
   - **Crucial**: Other competing bidders are **NOT** marked as `NOT_SELECTED` yet. They remain in `QUALIFIED` / `UNDER_EVALUATION` (Standby) status.

2. **Winning Seller Accepts the Award**:
   - The awarded seller receives notification of the award offer.
   - The seller reviews commercial terms and submits `acceptAward`.
   - The award transitions to `ACCEPTED`, and bid status transitions to `AWARD_ACCEPTED`.

3. **Purchase Order Generation**:
   - Following award acceptance, the formal Purchase Order is generated (`PO_GENERATED`).
   - The PO is linked to the accepted award and buyer-seller commitments.

4. **Winning Seller Accepts the Purchase Order**:
   - The seller reviews the official PO terms, delivery milestones, and SLA schedules, then submits `acceptPO`.
   - PO status transitions to `ACCEPTED` (`acceptedAt` timestamp recorded).
   - Delivery tracking is activated for physical fulfillment.

5. **Standby Bidders Notified & Updated**:
   - **Only after Step 4 is complete**:
     - All other participating sellers for that bid have their `finalStatus` set to `NOT_SELECTED`.
     - An automated notification is sent to each standby bidder: *"The tender evaluation for [Title] has concluded and the purchase order has been finalized. Thank you for your participation."*

### Fallback Protection:
If the selected seller **declines** the award (`declineAward`), the tender cleanly returns to evaluation. Because other participants were **not** prematurely marked `NOT_SELECTED`, the buyer can immediately offer the award to the next qualified bidder (e.g., $L_2$) without reopening the tender or requiring bidders to re-apply.

---

## 5. Zero PAC (Proprietary Article Certificate / Monopoly Gating)
* **Rule**: There is strictly **no PAC** workflow, certificate requirement, or `PAC_BID` type in the portal.
* **Invariants**:
  - No `PAC_BID` enum value in Prisma schema or system types.
  - No `pacJustification` column in `ProcurementRequest` or `pacApprovalRequired` in `ProcurementModeSetting`.
  - Private anchor buyers (Vedanta, JSW, UltraTech, etc.) desiring single-vendor sourcing use standard commercial `SINGLE_SOURCE` / direct proposal mechanisms without statutory GFR-style bureaucratic PAC certificates or verification file gates.
  - Zero dead PAC badges, filters, or error validators in the frontend wizard and marketplace.

---

## 6. Zero TReDS / Invoice Factoring (Financier Intermediary Role)
* **Rule**: There is strictly **no TReDS / invoice factoring** intermediary or third-party `FINANCIER` account type.
* **Invariants**:
  - Direct corporate buyer-seller commercial settlement via verified Milestone & Escrow payment rails.
  - No `InvoiceFactoring` database model, migration, or relations on `User` / `Invoice`.
  - No `FINANCIER` account role, dynamic RBAC permission tier, or financier registration flows.
  - No third-party factoring lien assignments or payout splits in escrow settlement pipelines.

---

## 7. Zero PBG (Performance Bank Guarantee / ePBG)
* **Rule**: There is strictly **no PBG / ePBG** requirement or bank guarantee verification workflow.
* **Invariants**:
  - No institutional PBG/ePBG issuance tracking, bank guarantee lodging, or verification checkpoints.
  - Performance assurance is governed by standard commercial payment retention and mutual contractual terms agreed upon in the Purchase Order.
  - Zero PBG inputs, mandatory guarantee amount fields, or blocking validation errors in procurement creation or rate contracts.

