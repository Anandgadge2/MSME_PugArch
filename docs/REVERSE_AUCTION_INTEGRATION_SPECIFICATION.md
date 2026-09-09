# Reverse Auction Integration Specification & Architecture

## 1. Executive Summary & Vision

This document details the complete end-to-end integration of the **Dynamic Reverse Auction (e-RA) Lifecycle** into the MSME Procurement Portal.

The architecture preserves all existing procurement methods (Direct Purchase, RFQ, RFP, Rate Contracts, Open Tender, Limited Tender) while adding an event-driven Reverse Auction engine that bridges:
1. **Buyer Submitted Bids Evaluation**
2. **One-Click Reverse Auction Configuration & Kickoff**
3. **Real-Time Synchronized Live Bidding Room (Buyer Leaderboard & Seller Bidding Console)**
4. **Anti-Collusion Masking on the Seller Side**
5. **Auto-Completion & Winner L1 Determination**
6. **One-Click PO Generation & Transition to Order Fulfillment**

---

## 2. High-Level Lifecycle & State Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. BUYER SUBMITTED BIDS                         │
│  - Vendors submit initial quotes (e.g., 10 Vendors, Lowest: ₹9,50,000)│
│  - Procurement Method: Reverse Auction                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Buyer clicks [ START REVERSE AUCTION ]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   2. CONFIGURATION MODAL / SETUP                       │
│  - Start Time & End Time (Date/Time Pickers)                           │
│  - Minimum Decrement (e.g., ₹5,000)                                    │
│  - Auto-Extension Window (e.g., 5 min if bid received in last 5 min)   │
│  - Eligible Vendors Pre-Selected (Qualified bidders auto-enrolled)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Buyer clicks [ START AUCTION ]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3. AUCTION LIVE ROOM                            │
│  BUYER VIEW:                                                           │
│    - Status: 🔴 REVERSE AUCTION — LIVE                                │
│    - Timer Countdown (e.g., 00:42:18)                                  │
│    - Current L1, Total Bids, Participating Vendors                     │
│    - Real-Time Ranking: 🥇 L1 Vendor D (₹9,15,000), 🥈 L2 Vendor A ... │
│    - Live Bid Activity Feed (Timestamped stream of bid events)        │
│                                                                        │
│  SELLER VIEW (Private & Anonymized):                                   │
│    - Status: 🔴 Reverse Auction LIVE                                  │
│    - Timer Countdown (00:42:18)                                        │
│    - Current Market L1 (₹9,15,000)                                     │
│    - Seller's Current Bid (₹9,30,000) | Seller's Current Rank (L4)    │
│    - Minimum Allowed Next Bid (₹9,10,000 = L1 - Decrement)             │
│    - Button: [ PLACE LOWER BID ] -> Bid Submission Modal               │
│    - NO competitor names exposed (Anti-collusion)                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Timer reaches 00:00:00 (Auto-Close)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   4. REVERSE AUCTION COMPLETED                         │
│  - Status: 🟢 REVERSE AUCTION COMPLETED                                │
│  - Final Lowest Evaluated Bidder: Vendor D (₹9,05,000)                 │
│  - Total Bids Placed: 84 | Participating Vendors: 10                   │
│  - Action: [ VIEW AUCTION RESULT ]                                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Buyer clicks [ ACCEPT / AWARD L1 ]
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   5. PURCHASE ORDER (PO) GENERATION                    │
│  - Backend auto-generates PurchaseOrder (`PO-RA-XXXXX`)                │
│  - Status set to `GENERATED` / `ISSUED`                                │
│  - Auto-notification sent to winning Seller and Buyer                  │
│  - Button switches to [ VIEW / GENERATE PO ] -> Opens PO Receipt Modal │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Dynamic Action Matrix by Procurement Method

On the Buyer's Submitted Bids / Evaluation screen (`ProcurementDetailUnifiedView.tsx` / `BidResultsPage.tsx`), action buttons must dynamically reflect the procurement method and lifecycle stage:

| Procurement Method | Lifecycle Stage | Primary Button Label | Secondary Action |
| :--- | :--- | :--- | :--- |
| **Normal Quotation (RFQ/RFP)** | Quotations Received | `Accept Quotation` | View Quotation Details |
| **Normal Quotation (RFQ/RFP)** | Awarded | `PO Generated` / `View PO` | Download PO PDF |
| **Reverse Auction** | Bids Submitted (Pre-Auction) | `[ START REVERSE AUCTION ]` | Review Initial Quotes |
| **Reverse Auction** | Auction In Progress | `🟢 AUCTION LIVE` (View Live) | Pause / Extend Auction |
| **Reverse Auction** | Auction Ended | `[ VIEW AUCTION RESULT ]` | Audit Event Logs |
| **Reverse Auction** | L1 Evaluated | `[ ACCEPT / AWARD L1 ]` | Reject / Cancel Auction |
| **Reverse Auction** | L1 Awarded / Finalized | `[ VIEW / GENERATE PO ]` | Track Delivery / Order |

---

## 4. Current Codebase Audit & Gap Analysis

### 4.1 Existing Backend Assets
* **Prisma Schema** (`backend/prisma/schema.prisma`):
  * `model Auction`: Contains `startPrice`, `currentBid`, `currentLowestAmount`, `minDecrementAmount`, `autoExtensionEnabled`, `autoExtensionWindowMinutes`, `statusEnum`, `linkedRequirementId`, `linkedBidId`.
  * `model AuctionBid`: Contains `auctionId`, `sellerId`, `sellerOrgId`, `amount`, `rankAtSubmission`, `submittedAt`, `isValid`.
  * `model AuctionParticipant`: Contains `auctionId`, `sellerOrgId`, `sellerUserId`, `status`, `lastBidAmount`, `currentRank`.
  * `model AuctionEventLog`: Contains audit history for live events.
* **Auction Routes** (`backend/src/routes/reverse-auction.routes.ts`):
  * `POST /api/reverse-auctions`: Creates auction.
  * `POST /api/reverse-auctions/:id/start`: Transitions status to `LIVE`.
  * `POST /api/reverse-auctions/:id/bids`: Bidding with distributed lock (`withDistributedLock`), decrement checks, and auto-extension.
  * `GET /api/reverse-auctions/:id/live-summary`: Returns auction timer, current lowest amount, and minimum next bid.
  * `GET /api/reverse-auctions/:id/result`: Returns finalized ranks.
  * `POST /api/reverse-auctions/:id/award-recommendation`: Recommends winner.

### 4.2 Critical Gaps Identified & Solutions

1. **Auto-Enrollment of Submitted Vendors**:
   * *Problem*: In `reverse-auction.routes.ts`, `POST /bids` restricts bidding to participants with status `TECHNICALLY_QUALIFIED` through a multi-step pre-bid document upload. In the requested flow, vendors have **already submitted proposals and quotations** on the procurement.
   * *Solution*: When the buyer clicks **"START AUCTION"** from the Submitted Bids modal, the backend creates the `Auction` and immediately creates `AuctionParticipant` rows for all submitted vendors with `status: 'TECHNICALLY_QUALIFIED'`, initialized with their quote amounts as their starting bids. No duplicate document re-upload is needed.

2. **Starting Price Initialization**:
   * *Problem*: If `startPrice` is arbitrarily set, it might be higher than the lowest quote already submitted.
   * *Solution*: Auto-set `startPrice` and `currentLowestAmount` to the lowest quoted price among submitted vendors (L1 initial bid), ensuring bidding can only decrease from that benchmark.

3. **Buyer Submitted Bids Page (`ProcurementDetailUnifiedView.tsx` / `BidResultsPage.tsx`)**:
   * *Problem*: Currently only shows static table rows with `Review Quotation` and `Accept Quotation`.
   * *Solution*: Add the `[ START REVERSE AUCTION ]` button, the interactive Configuration Modal, and embed the **Live Auction Monitor Panel** with real-time ranking and event log.

4. **Seller Side Submitted Bid Page (`SellerBidsPage.tsx` & Detail View)**:
   * *Problem*: Currently displays a standard static table row with status `SUBMITTED`.
   * *Solution*: When `bid.auctionStatus === 'LIVE'` or `linkedAuction.status === 'LIVE'`, show a prominent **Live Auction Bidding Card** with live timer, market L1, seller's rank, and the **[ PLACE LOWER BID ]** modal.

5. **Direct Purchase Order (PO) Transition**:
   * *Problem*: `award-recommendation` marks status as `AWARD_RECOMMENDED`, but does not create a `PurchaseOrder` in `db.purchaseOrder`.
   * *Solution*: Introduce `POST /api/reverse-auctions/:id/accept-and-generate-po` which accepts the L1 bid, creates the `PurchaseOrder` record, and issues it to the winning seller with items and audit trail.

---

## 5. UI/UX Component Specifications

### 5.1 Buyer: Start Reverse Auction Modal

```tsx
interface StartReverseAuctionModalProps {
  isOpen: boolean;
  onClose: () => void;
  procurementId: number | string;
  procurementTitle: string;
  initialLowestQuote: number;
  submittedVendors: Array<{
    sellerOrgId: number;
    sellerUserId: number;
    vendorName: string;
    quotedAmount: number;
  }>;
  onAuctionStarted: (auctionId: number) => void;
}
```

#### Fields & Validations:
1. **Auction Start**: Date picker + Time picker (Defaults to current time + 5 minutes).
2. **Auction End**: Date picker + Time picker (Defaults to Start time + 1 hour).
3. **Minimum Bid Decrement**:
   * Default: `₹5,000` (or 0.5% of lowest quote).
   * Validation: Must be > 0.
4. **Auto Extension**:
   * Toggle: Checked by default.
   * Extension Window: `5 Minutes` (If a bid is received in the last 5 minutes, extend by 5 minutes).
   * Max Auto-Extensions: `10` (or configurable).
5. **Eligible Vendors**:
   * Displays chips/list of all submitted vendors (e.g. `10 Vendors Selected`).
   * Checkbox to exclude any disqualified vendors if necessary.

---

### 5.2 Buyer: Live Auction Panel (`LiveAuctionLeaderboard`)

Embedded at the top of the Submitted Bids page when the auction is `LIVE`:

```tsx
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 REVERSE AUCTION — LIVE                             [ Refresh ] [ End ]   │
│ ─────────────────────────────────────────────────────────────────────────── │
│ ⏳ Time Remaining: 00:42:18                                                 │
│                                                                             │
│ 💰 Current L1: ₹9,15,000         📉 Total Decrement: ₹35,000 (3.68%)        │
│ 📊 Total Bids: 37                👥 Participating Vendors: 10               │
└─────────────────────────────────────────────────────────────────────────────┘

Live Bid Ranking
┌──────┬──────────────────────┬──────────────────┬────────────────┬───────────┐
│ Rank │ Vendor Organization  │ Current Bid      │ Decrement      │ Time      │
├──────┼──────────────────────┼──────────────────┼────────────────┼───────────┤
│ 🥇 L1│ Vendor D             │ ₹9,15,000        │ -₹10,000       │ 11:14:05  │
│ 🥈 L2│ Vendor B             │ ₹9,20,000        │ -₹10,000       │ 11:14:21  │
│ 🥉 L3│ Vendor A             │ ₹9,25,000        │ -₹5,000        │ 11:13:42  │
│  4   │ Vendor H             │ ₹9,30,000        │ -₹5,000        │ 11:13:10  │
└──────┴──────────────────────┴──────────────────┴────────────────┴───────────┘

Recent Bidding Activity (Audit Stream)
• 11:14:21 — Vendor B submitted ₹9,20,000 (New L2)
• 11:14:05 — Vendor D submitted ₹9,15,000 (New L1)
• 11:13:42 — Vendor A submitted ₹9,25,000
• 11:13:10 — Vendor H submitted ₹9,30,000
```

---

### 5.3 Seller: Live Auction Card & Bid Placement Modal

#### Seller Card Display (on `SellerBidsPage` / Opportunity Detail):
```tsx
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Reverse Auction LIVE                                                     │
│ Procurement: Supply of 100 Laptops (REQ-2026-00042)                         │
│                                                                             │
│ ⏳ Time Remaining: 00:42:18                                                 │
│                                                                             │
│ Market Current L1:   ₹9,15,000                                              │
│ Your Current Bid:    ₹9,30,000                                              │
│ Your Current Rank:   L4                                                     │
│ Min Allowed Bid:     ₹9,10,000   (Current L1 - ₹5,000 decrement)            │
│                                                                             │
│                             [ PLACE LOWER BID ]                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Seller Bid Placement Modal:
* **Current Best Bid**: `₹9,30,000`
* **Market L1**: `₹9,15,000`
* **Minimum Decrement**: `₹5,000`
* **Maximum Allowed Bid**: `₹9,10,000`
* **Input**: `Enter New Bid (INR)` -> prefilled or placeholder `≤ 910000`
* **Validation**:
  * Real-time warning if input > `₹9,10,000`: *"Bid must be at least ₹5,000 lower than current L1 (₹9,15,000)"*.
* **Button**: `[ SUBMIT BID ]`
* **Post-Submit Feedback**: Immediate toast: `✅ Bid Submitted Successfully! Your Rank: L2`.

#### Security & Privacy Rule (Mandatory):
* The seller API response **never** contains competitor IDs or organization names.
* Only `currentLowestAmount`, `sellerCurrentRank`, `sellerLastBid`, and `minimumNextBid` are returned.

---

### 5.4 Auction Completion & PO Generation Flow

When the timer reaches `00:00:00`:
1. UI transitions to `🟢 REVERSE AUCTION COMPLETED`.
2. Shows summary card:
   * **Final L1**: `₹9,05,000`
   * **Winning Supplier**: `Vendor D`
   * **Total Bids**: `84`
   * **Participating Vendors**: `10`
3. Primary button: `[ ACCEPT / AWARD L1 ]`.
4. On clicking `[ ACCEPT / AWARD L1 ]`:
   * Confirmation modal: *"Accept Vendor D's L1 quote of ₹9,05,000 and issue Purchase Order?"*
   * On confirmation:
     * Dispatches `POST /api/reverse-auctions/:id/accept-and-generate-po`.
     * Creates `PurchaseOrder` in `db.purchaseOrder`.
     * Automatically assigns reference `PO-RA-2026-XXXXX`.
     * Toast: *"Purchase Order Generated Successfully!"*
     * UI button changes to `[ VIEW PURCHASE ORDER ]`, opening `PurchaseOrderReceiptModal`.

---

## 6. Real-Time Synchronization Architecture

To deliver real-time responsiveness without unnecessary server load:

1. **Smart Interval Polling**:
   * When an auction is `LIVE`: 3-second refetch interval (`staleTime: 2000`, `refetchInterval: 3000`).
   * When paused or scheduled: 15-second refetch interval.
   * Auto-pauses when browser tab is inactive (`window.onfocus / onblur` handling).
2. **Instant Optimistic Invalidation**:
   * When any seller submits a bid, React Query's cache keys `['reverse-auction-live', id]`, `['reverse-auction-bids', id]`, and `['procurement-detail', id]` are invalidated immediately.
3. **Optional WebSocket / Server-Sent Events (SSE)**:
   * Backend event broadcaster ready on `/api/reverse-auctions/:id/stream` via SSE for sub-second updates in high-frequency auctions.

---

## 7. Step-by-Step Implementation Roadmap

### Phase A: Backend Enhancement
1. Add `POST /api/reverse-auctions/start-from-bids`:
   * Accepts `requirementId`, `startPrice`, `minDecrement`, `autoExtensionWindowMinutes`, `selectedSellers`.
   * Creates `Auction` with status `LIVE` (or `SCHEDULED`).
   * Enrolls all selected sellers as `AuctionParticipant` with `status: 'TECHNICALLY_QUALIFIED'`.
2. Add `POST /api/reverse-auctions/:id/accept-and-generate-po`:
   * Finalizes auction, creates `PurchaseOrder` with line items, and issues notifications.

### Phase B: Frontend Buyer Components
1. Create `StartReverseAuctionModal.tsx` in `frontend/src/features/reverseAuctions/components/`.
2. Create `LiveAuctionLeaderboard.tsx` for real-time buyer rank and bid stream.
3. Integrate into `ProcurementDetailUnifiedView.tsx` and `BidResultsPage.tsx`.

### Phase C: Frontend Seller Components
1. Create `SellerLiveAuctionBanner.tsx` and `PlaceLowerBidModal.tsx`.
2. Integrate into `SellerBidsPage.tsx` and seller procurement view.

### Phase D: Testing & Validation
1. Simulate multi-seller live bidding session with decrement validation.
2. Verify countdown auto-extension when bid occurs within 5 minutes of deadline.
3. Verify PO creation and receipt modal display.
