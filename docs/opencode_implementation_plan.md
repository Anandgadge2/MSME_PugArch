# BidCreationWizardV2 Implementation Plan

## 1. Objective

Add a separate formal bid creation module for buyers without replacing the existing quick procurement, cart, direct purchase, L1 purchase, tender, approval, GRN, invoice, payment, dashboard, reverse auction, and procurement order flows.

## 2. Routing Decision

| Area | Decision |
| --- | --- |
| Existing quick procurement | Keep `/buyer/create-procurement` and `ProcurementWizard` unchanged |
| Existing simple bid page | Keep `/buyer/publish-bid` unchanged |
| New formal bid wizard | Add `/buyer/create-bid` |
| Frontend routing | Register lazy route in `frontend/src/App.tsx`, following the current route-dispatch pattern |
| Backend routing | Register once at `/buyer/bid-wizard` inside `backend/src/routes/index.ts` |

## 3. Backend Scope

New draft model:

```prisma
model BidWizardDraft {
  id              Int         @id @default(autoincrement())
  buyerId         Int
  bidType         BidType
  currentStep     Int         @default(1)
  completedSteps  Int[]       @default([])
  formData        Json
  validationState Json?
  lastSavedAt     DateTime    @default(now())
  draftStatus     DraftStatus @default(DRAFT)
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
}
```

Added enums:

- `BidType`: `PRODUCT_BID`, `SERVICE_BID`, `CUSTOM_BID`, `BOQ_BID`, `BID_WITH_RA`, `REVERSE_AUCTION`, `PAC_BID`
- `DraftStatus`: `DRAFT`, `SUBMITTED`, `PUBLISHED`, `CANCELLED`
- `PacketType`: `SINGLE_PACKET`, `TWO_PACKET`

Extended `ProcurementBid`:

- `packetType`
- `technicalPacket`
- `financialPacket`

## 4. Backend APIs

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/buyer/bid-wizard/draft` | Create draft after Step 1 bid type selection |
| `GET` | `/api/buyer/bid-wizard/draft/:id` | Load owned draft |
| `PUT` | `/api/buyer/bid-wizard/draft/:id` | Auto-save or manual save draft |
| `POST` | `/api/buyer/bid-wizard/validate-step` | Validate one step |
| `GET` | `/api/buyer/bid-wizard/preview/:id` | Compile preview and validation state |
| `POST` | `/api/buyer/bid-wizard/submit` | Validate all steps and create existing `ProcurementBid` |
| `DELETE` | `/api/buyer/bid-wizard/draft/:id` | Delete or cancel draft |

## 5. Security Rules

- All bid wizard APIs require authentication.
- All bid wizard APIs require buyer role.
- Every draft ID route checks `draft.buyerId === req.user.id`.
- Seller and admin users cannot access buyer draft APIs through this route.
- Final submit validates all steps server-side before creating `ProcurementBid`.

## 6. Final Bid Lifecycle

The module does not create a parallel lifecycle.

```text
BidWizardDraft -> validate all steps -> transform payload -> existing ProcurementBid -> existing submitForApproval flow
```

The existing `createBuyerBid` and `submitForApproval` service path remains the final lifecycle owner.

## 7. Frontend Scope

Feature root:

```text
frontend/src/features/bidCreationWizardV2/
```

Implemented groups:

- `pages/CreateBidPage.tsx`
- `components/BidWizardLayout.tsx`
- `components/steps/Step1...Step9`
- `components/common/*`
- `hooks/useBidWizard.ts`
- `hooks/useDraftPersistence.ts`
- `hooks/useStepValidation.ts`
- `hooks/useFieldDependencies.ts`
- `hooks/useMasterData.ts`
- `utils/constants.ts`
- `utils/validation.ts`
- `utils/fieldMapping.ts`
- `utils/bidTypeConfig.ts`
- `utils/helpers.ts`
- `types/*`

## 8. Wizard Steps

1. Bid Type Selection
2. Buyer / Department Details
3. Bid Basic Details
4. Item / Service / BOQ / Custom / PAC / RA Details
5. Delivery / Consignee Details
6. Eligibility & Evaluation
7. Terms, Documents & Compliance
8. Special Conditions
9. Preview & Publish

## 9. Dropdown Rules

- New wizard dropdowns use searchable controls.
- `Other` opens a required "Please specify" input.
- `N/A` is only enabled on fields where it is logically valid.
- Backend resolves `{ dropdownValue: "Other", otherValue: "..." }` before final submit.

## 10. Verification

Commands run:

```bash
cd backend && npm run prisma:validate
cd frontend && npm run typecheck
cd frontend && npm run build
cd backend && npx prisma generate
cd backend && npm run build
```

Notes:

- Initial Prisma generate failed due to a Windows DLL file lock on `query_engine-windows.dll.node`.
- After stopping the leftover repo-local backend process, Prisma generate and backend build passed.
