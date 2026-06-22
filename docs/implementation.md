Based on your detailed answers, here's the final comprehensive implementation plan for the BidCreationWizardV2 (9-step formal bid creation wizard).
BidCreationWizardV2 — Final Implementation Plan
1. Overview
Aspect	Decision
Module Name	BidCreationWizardV2 (new feature, separate from existing ProcurementWizard)
Route	/buyer/create-bid (new) — existing /buyer/create-procurement unchanged
Use Case	Formal bids: Product, Service, Custom, BOQ, RA, Reverse Auction, PAC
Existing Wizard	Keep for quick procurement/cart/direct purchase/L1
DB Enum Values	PRODUCT_BID, SERVICE_BID, CUSTOM_BID, BOQ_BID, BID_WITH_RA, REVERSE_AUCTION, PAC_BID
UI Labels	User-friendly labels via central mapping constant
2. Backend Changes
2.1 Database (Prisma)
New Model: BidWizardDraft
model BidWizardDraft {
  id              Int      @id @default(autoincrement())
  buyerId         Int
  bidType         BidType  // Enum: PRODUCT_BID, SERVICE_BID, etc.
  currentStep     Int      @default(1)
  completedSteps  Int[]    @default([])
  formData        Json     // All step data
  validationState Json     // Per-step validation errors
  lastSavedAt     DateTime @default(now())
  draftStatus     DraftStatus @default(DRAFT)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  buyer           User     @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  @@index([buyerId, updatedAt])
  @@index([bidType, draftStatus])
}

enum BidType {
  PRODUCT_BID
  SERVICE_BID
  CUSTOM_BID
  BOQ_BID
  BID_WITH_RA
  REVERSE_AUCTION
  PAC_BID
}

enum DraftStatus {
  DRAFT
  SUBMITTED
  PUBLISHED
}
Extend ProcurementBid with Two Packet fields:
model ProcurementBid {
  // ... existing fields
  packetType       PacketType?     @default(SINGLE_PACKET)
  technicalPacket  Json?           // Step 6 technical criteria
  financialPacket  Json?           // Step 7 financial criteria
  // ...
}

enum PacketType {
  SINGLE_PACKET_PACKET
  TWO_PACKET
}
Master Data Tables (if not exist):
model DistrictMaster {
  id        Int    @id @default(autoincrement())
  name      String @unique
  state     String @default("Maharashtra")
  talukas   TalukaMaster[]
}

model TalukaMaster {
  id         Int      @id @default(autoincrement())
  name       String
  districtId Int
  district   DistrictMaster @relation(fields: [districtId], references: [id])
  villages   VillageMaster[]
  @@unique([name, districtId])
}

model VillageMaster {
  id       Int      @id @default(autoincrement())
  name     String
  talukaId Int
  taluka   TalukaMaster @relation(fields: [talukaId], references: [id])
  @@unique([name, talukaId])
}
2.2 New API Routes (bid-wizard.routes.ts)
Method	Path	Description
POST	/api/buyer/bid-wizard/draft	Create draft (returns draftId)
GET	/api/buyer/bid-wizard/draft/:id	Load draft
PUT	/api/buyer/bid-wizard/draft/:id	Update draft (auto-save + manual)
POST	/api/buyer/bid-wizard/validate-step	Validate single step payload
POST	/api/buyer/bid-wizard/submit	Final submit after preview
GET	/api/buyer/bid-wizard/preview/:id	Get compiled preview data
DELETE	/api/buyer/bid-wizard/draft/:id	Delete draft
2.3 Validation Schemas (Zod)
Step 1 Schema:
const step1Schema = z.object({
  bidType: z.enum(['PRODUCT_BID', 'SERVICE_BID', 'CUSTOM_BID', 'BOQ_BID', 'BID_WITH_RA', 'REVERSE_AUCTION', 'PAC_BID']),
  procurementMethod: z.enum(['DIRECT_PURCHASE', 'L1_PURCHASE', 'E_BID', 'E_BID_WITH_RA', 'REVERSE_AUCTION', 'PAC_PROCUREMENT']),
  packetType: z.enum(['SINGLE_PACKET', 'TWO_PACKET']),
  isReverseAuctionRequired: z.boolean(),
  isPacRequired: z.boolean(),
  bidCreationMode: z.enum(['FRESH_BID', 'RE_BID', 'CORRIGENDUM', 'CANCELLED_RECREATED']),
});
Conditional Step 4 Schemas (one per bid type):
- step4ProductSchema, step4ServiceSchema, step4CustomSchema, step4BoqSchema, step4RaSchema, step4PacSchema
Step 6 Technical Packet Schema (if packetType === TWO_PACKET):
const technicalPacketSchema = z.object({
  technicalEligibilityCriteria: z.array(z.string()),
  minimumExperience: z.string().optional(),
  minimumTurnover: z.number().optional(),
  similarWorkExperience: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  technicalProposalRequired: z.boolean(),
  complianceSheet: z.boolean(),
  pastWorkDocuments: z.array(z.string()).optional(),
  oemAuthorization: z.boolean().optional(),
  technicalDocumentUploads: z.array(z.number()).optional(), // fileAssetIds
  technicalEvaluationMethod: z.string(),
  technicalQualificationScore: z.number().optional(),
  technicalCommitteeIds: z.array(z.number()).optional(),
});
Step 7 Financial Packet Schema (if packetType === TWO_PACKET):
const financialPacketSchema = z.object({
  financialQuoteFormat: z.enum(['ITEM_WISE', 'TOTAL_BOQ', 'PERCENTAGE', 'LOT_WISE']),
  boqPriceSchedule: z.array(z.number()).optional(),
  taxGstDetails: z.object({ gstIncluded: z.boolean(), gstRate: z.number() }),
  paymentTerms: z.string(),
  priceValidityDays: z.number(),
  financialDocumentUploads: z.array(z.number()).optional(),
  financialOpeningRules: z.string(),
  financialEvaluationMethod: z.string(),
});
2.4 Service Layer (bid-wizard.service.ts)
Key functions:
- createDraft(buyerId, bidType, initialData) → creates BidWizardDraft
- updateDraft(draftId, step, formData, validationState, completedSteps)
- validateStep(step, formData, bidType, packetType) → returns { valid: boolean, errors: Record<string, string[]> }
- compilePreview(draftId) → merges all steps, resolves "Other" values
- submitBid(draftId) → creates ProcurementBid + documents, marks draft SUBMITTED
3. Frontend Implementation
3.1 Feature Structure
frontend/src/features/bidCreationWizardV2/
├── components/
│   ├── BidWizardLayout.tsx           # Stepper, progress, nav, save status
│   ├── steps/
│   │   ├── Step1_BidTypeSelection.tsx
│   │   ├── Step2_BuyerDetails.tsx
│   │   ├── Step3_BidBasicDetails.tsx
│   │   ├── Step4_ItemsDetails.tsx    # Conditional render per bidType
│   │   ├── Step5_DeliveryDetails.tsx
│   │   ├── Step6_EligibilityDetails.tsx  # + TechnicalPacket if Two Packet
│   │   ├── Step7_TermsDocuments.tsx      # + FinancialPacket if Two Packet
│   │   ├── Step8_SpecialConditions.tsx
│   │   └── Step9_PreviewPublish.tsx
│   ├── common/
│   │   ├── FormField.tsx             # Label, *, input, error, help text
│   │   ├── SearchableSelect.tsx      # Debounced search, "Other" + textbox
│   │   ├── SearchableMultiSelect.tsx
│   │   ├── OtherTextInput.tsx        # "Other" handler
│   │   ├── ConditionalSection.tsx    # Show/hide by bidType/packetType
│   │   ├── DocumentUploadSection.tsx # Multi-file, progress, mandatory/optional
│   │   ├── ConsigneeForm.tsx         # Single consignee
│   │   ├── MultipleConsigneeTable.tsx # Qty per consignee
│   │   ├── ConsigneeExcelUpload.tsx  # Bulk upload
│   │   ├── PacketTypeBadge.tsx       # Visual indicator
│   │   ├── TechnicalPacketSection.tsx
│   │   ├── FinancialPacketSection.tsx
│   │   ├── PreviewSection.tsx        # Read-only card per step
│   │   ├── DeclarationCheckbox.tsx   # Required checkbox with text
│   │   └── SaveStatusIndicator.tsx   # Saving... / Saved / Failed
├── hooks/
│   ├── useBidWizard.ts               # Main state: step, formData, validation, draftId
│   ├── useStepValidation.ts          # Runs validation on step change/blur
│   ├── useDraftPersistence.ts        # Auto-save (debounced) + manual save
│   ├── useFieldDependencies.ts       # Bid-type → field visibility logic
│   └── useMasterData.ts              # District/Taluka/Village search
├── utils/
│   ├── constants.ts                  # All dropdown options (centralized)
│   ├── validation.ts                 # Validation rules per step
│   ├── fieldMapping.ts               # Form → API payload transform
│   ├── bidTypeConfig.ts              # Bid type → steps, required fields
│   └── helpers.ts                    # Money format, date helpers
├── types/
│   ├── steps.ts                      # Step 1-9 interfaces
│   ├── masterData.ts                 # District/Taluka/Village
│   └── api.ts                        # API request/response types
├── api.ts                            # API calls
└── pages/
    └── CreateBidPage.tsx             # Main page, route handler
3.2 Constants File (constants.ts)
// Central enum → label mapping
export const BID_TYPE_LABELS: Record<BidType, string> = {
  PRODUCT_BID: 'Product Bid',
  SERVICE_BID: 'Service Bid',
  CUSTOM_BID: 'Custom Bid',
  BOQ_BID: 'BOQ Based Bid',
  BID_WITH_RA: 'Bid with Reverse Auction',
  REVERSE_AUCTION: 'Reverse Auction',
  PAC_BID: 'PAC / Proprietary Bid',
};

// All dropdown options from your spec
export const PROCUREMENT_METHOD_OPTIONS = [
  { value: 'DIRECT_PURCHASE', label: 'Direct Purchase' },
  { value: 'L1_PURCHASE', label: 'L1 Purchase' },
  { value: 'E_BID', label: 'e-Bid' },
  { value: 'E_BID_WITH_RA', label: 'e-Bid with Reverse Auction' },
  { value: 'REVERSE_AUCTION', label: 'Reverse Auction' },
  { value: 'PAC_PROCUREMENT', label: 'PAC Procurement' },
] as const;

export const PACKET_TYPE_OPTIONS = [
  { value: 'SINGLE_PACKET', label: 'Single Packet' },
  { value: 'TWO_PACKET', label: 'Two Packet' },
] as const;

export const MAHARASHTRA_DISTRICTS = [
  'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad / Chhatrapati Sambhajinagar',
  'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli',
  'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur',
  'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar',
  'Nashik', 'Osmanabad / Dharashiv', 'Palghar', 'Parbhani', 'Pune',
  'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur',
  'Thane', 'Wardha', 'Washim', 'Yavatmal',
] as const;

// Product categories, Service categories, Units, Financial Years, etc.
// All from your spec...
3.3 Core Hook: useBidWizard.ts
interface BidWizardState {
  draftId: number | null;
  currentStep: number;
  bidType: BidType | null;
  packetType: 'SINGLE_PACKET' | 'TWO_PACKET';
  formData: {
    step1: Step1Data;
    step2: Step2Data;
    step3: Step3Data;
    step4: Step4Data;       // Discriminated union by bidType
    step5: Step5Data;
    step6: Step6Data;
    step7: Step7Data;
    step8: Step8Data;
    step9: Step9Data;
  };
  validationErrors: Record<number, Record<string, string[]>>;
  completedSteps: number[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  lastSavedAt: string | null;
  isSubmitting: boolean;
}

// Actions
const actions = {
  setStep: (step: number) => void;
  updateField: (step: number, field: string, value: any) => void;
  updateStepData: (step: number, data: any) => void;
  validateCurrentStep: () => Promise<boolean>;
  saveDraft: (manual?: boolean) => Promise<void>;
  submitBid: () => Promise<void>;
  loadDraft: (draftId: number) => Promise<void>;
  resetWizard: () => void;
};
3.4 Auto-Save Logic (useDraftPersistence.ts)
// Debounced auto-save per step
const DEBOUNCE_MS = 1000;

useEffect(() => {
  if (!isDirty || !draftId) return;
  const timer = setTimeout(() => {
    saveDraft({ silent: true });
  }, DEBOUNCE_MS);
  return () => clearTimeout(timer);
}, [formData, currentStep, isDirty]);

// Manual save button always visible
const handleManualSave = () => saveDraft({ silent: false });
3.5 Conditional Rendering (useFieldDependencies.ts)
const STEP_CONFIG_BY_BID_TYPE: Record<BidType, StepConfig[]> = {
  PRODUCT_BID: [
    { step: 4, component: 'ProductBidFields', required: true },
    { step: 4, component: 'WarrantySection', required: true },
    { step: 4, component: 'InspectionType', required: true },
  ],
  SERVICE_BID: [
    { step: 4, component: 'ServiceBidFields', required: true },
    { step: 4, component: 'SLASection', required: true },
    { step: 4, component: 'StatutoryCompliance', required: true },
  ],
  CUSTOM_BID: [
    { step: 4, component: 'CustomBidFields', required: true },
  ],
  BOQ_BID: [
    { step: 4, component: 'BOQUploadOrEntry', required: true },
    { step: 4, component: 'BOQLineItemsTable', required: true },
  ],
  BID_WITH_RA: [
    { step: 4, component: 'ProductBidFields', required: true },
    { step: 4, component: 'ReverseAuctionFields', required: true },
  ],
  REVERSE_AUCTION: [
    { step: 4, component: 'ReverseAuctionFields', required: true },
  ],
  PAC_BID: [
    { step: 4, component: 'PACFields', required: true },
  ],
};

// Two Packet conditional sections
const TWO_PACKET_SECTIONS = {
  step6: 'TechnicalPacketSection',
  step7: 'FinancialPacketSection',
};
4. Step-by-Step Component Details
Step 1: Bid Type Selection
- Fields: Bid Type (SearchableSelect), Procurement Method (SearchableSelect), Packet Type (Radio), RA Required (Radio), PAC Required (Radio), Bid Creation Mode (SearchableSelect)
- All required
- On bidType change → reset step 4, update conditional steps
- On packetType change → set flag for step 6/7 sections
Step 2: Buyer/Department Details
- Auto-fill from BuyerProfile (use useMasterData to fetch on mount)
- Fields: Org Name (auto), Ministry (SearchableSelect), Buyer Name (auto), Designation (auto), Email (auto), Mobile (auto), Office Address (textarea), State (SearchableSelect), District (SearchableSelect, required), Taluka (SearchableSelect, dependent on district, required), Village/City/Ward (SearchableSelect or text), Financial Year (SearchableSelect), Dept File No (optional), Competent Authority Name/Designation (text, required)
- "Other" option for Ministry, State, District with required textbox
Step 3: Bid Basic Details
- Title (text, required), Short Description (textarea, required), Procurement Category (SearchableSelect, required), Sector/Department Area (SearchableSelect, required), Estimated Value (number, required), Budget Confirmed (Radio), Budget Head (conditional text), Procurement Purpose (textarea), Priority (SearchableSelect), Publishing Date (datetime, auto), Closing Date (datetime, required), Validity Period (SearchableSelect), Pre-Bid Meeting (Radio), Pre-Bid Date/Mode/Venue (conditional)
Step 4: Item/Service/BOQ/Custom Details
- Conditional render based on bidType from Step 1
- Each sub-component handles its own validation
- "Other" handled via OtherTextInput wrapper
Step 5: Delivery/Consignee Details
- Consignee Type (Radio: Single/Multiple)
- Single: ConsigneeForm component
- Multiple: MultipleConsigneeTable + ConsigneeExcelUpload
- Delivery Period (SearchableSelect), Installation Site Same (Radio), Installation Address (conditional), Inspection Officer (optional), Acceptance Criteria (textarea, required), LD/Penalty (Radio), Penalty Details (conditional)
Step 6: Eligibility & Evaluation
- Evaluation Method (SearchableSelect)
- Technical Qualification (Radio), Min Experience (conditional), Min Turnover (conditional), Similar Work (conditional), Bidder Documents (SearchableMultiSelect), MSE Preference (Radio), Make in India (Radio), EMD (Radio + conditional amount), PBG (Radio + conditional %), Blacklisting Declaration (Radio), Conflict of Interest (Radio)
- If Two Packet: Render TechnicalPacketSection component
Step 7: Terms, Documents & Compliance
- Document uploads (Scope, Tech Spec, Budget Sanction, Admin Approval, BOQ, PAC Cert, Drawings, Additional Terms) — mandatory/optional per bid type
- Payment Terms (SearchableSelect), Advance Payment (Radio), Part Payment (Radio), Invoice Required (Radio), GST Invoice (Radio), E-way Bill (Radio)
- If Two Packet: Render FinancialPacketSection component
Step 8: Special Conditions
- All Radio fields: Corrigendum, Cancellation, Clarification, Seller Query, Document Resubmission, Splitting, Multiple Award, Rate Contract
Step 9: Preview & Publish
- Read-only summary cards for each step (use PreviewSection component)
- Each card has "Edit" link → navigates to that step
- Two required DeclarationCheckbox components
- Buttons: Save Draft, Submit for Approval (if workflow), Publish Bid, Generate Preview PDF
- Publish disabled until all validations pass + declarations checked
5. Shared Reusable Components
Component	Purpose
SearchableSelect	Debounced search, "Other" + required textbox, server-side search for large datasets
SearchableMultiSelect	Multi-select with search, chips display
OtherTextInput	Shows required textbox when "Other" selected, stores dropdownValue: "Other", otherValue: "..."
FormField	Label + red asterisk + input + error message + help text
ConditionalSection	showWhen prop (function), animates in/out
DocumentUploadSection	Drag-drop, progress, mandatory badge, file type validation
ConsigneeForm / MultipleConsigneeTable	Reusable across steps
TechnicalPacketSection / FinancialPacketSection	Only rendered when packetType === TWO_PACKET
SaveStatusIndicator	Shows saving/saved/failed with timestamp
DeclarationCheckbox	Required checkbox with full text, validation
6. Validation Rules Summary
Step	Must Pass Before Next Step
1	All 6 fields filled
2	All auto-filled present, Ministry, District, Taluka, Financial Year, Competent Authority
3	Title, Category, Sector, Est. Value, Closing Date, Validity, Priority
4	Per bidType required fields (see spec)
5	Consignee, Delivery Period, Acceptance Criteria
6	Eval Method, EMD/PBG amounts if yes, Technical Packet if Two Packet
7	Required docs uploaded, Payment Terms, GST Invoice
8	All radios answered
9	Both declarations checked, ALL previous steps valid
7. Integration & Routes
Backend Route Registration
// backend/src/routes/index.ts
import bidWizardRoutes from '../modules/procurementBid/bid-wizard.routes';
router.use('/buyer/bid-wizard', bidWizardRoutes);
Frontend Route
// frontend/src/app/buyer/create-bid/[[...slug]]/page.tsx
'use client';
import CreateBidPage from '@/features/bidCreationWizardV2/pages/CreateBidPage';
export default CreateBidPage;
Navigation Entry Points
- Buyer Dashboard → "Create Formal Bid" → /buyer/create-bid
- Keep "Quick Procurement" → /buyer/create-procurement (existing)
8. Migration & Backward Compatibility
Action	Approach
Existing ProcurementWizard	Keep unchanged — feature flag if needed
Shared logic	Extract to frontend/src/features/shared/ (SearchableSelect, DocumentUpload, etc.)
Old bid creation in ProcurementWizard	Deprecate via comment, not delete
Database migration	Add BidWizardDraft, DistrictMaster, TalukaMaster, VillageMaster, extend ProcurementBid
API versioning	New routes under /bid-wizard, old routes untouched
9. Implementation Phases
Phase	Deliverables
1. Backend Core	Prisma models, migration, validation schemas, routes, service
2. Frontend Foundation	Types, constants, shared components (SearchableSelect, FormField, etc.)
3. Step Components	9 step components + conditional logic
4. Wizard Orchestration	useBidWizard, useDraftPersistence, useStepValidation, layout
5. Integration & Polish	Route, API connect, preview generation, PDF, error handling
6. Testing	Unit (validation), E2E (full flow), conditional rendering, draft restore
Total: ~13-15 days
10. Key Technical Decisions Summary
Decision	Implementation
Enum in DB	BidType enum with normalized values
UI Labels	Central BID_TYPE_LABELS mapping constant
Taluka	Searchable dependent dropdown → "Other" + required textbox
Draft	Auto-save (1s debounce) + manual button, per-step
Two Packet	Step 1 selects, Step 6 Technical, Step 7 Financial
Dropdowns	All searchable, "Other" with textbox, display otherValue
Validation	Per-step + full validation at Step 9
Backward Compat	Keep ProcurementWizard, extract shared components
11. Open Questions (Optional)
1. Master Data Seeding: Do you want me to include a seed script for Maharashtra districts/talukas/villages, or will you provide CSV/JSON?
2. PDF Generation: Use existing remotion or pdf-lib? Or server-side generation?
3. Approval Workflow: The "Submit for Internal Approval" button — should it trigger existing approval chain or new workflow?
4. File Upload Limits: 10MB per file? Total draft size limit?
5. Real-time Validation: Show errors on blur vs on change? (Recommend: on blur for draft, on change for Step 9)
Ready to implement? I can start with Phase 1 (Backend Core) — creating the Prisma models, validation schemas, and API routes.
▣  Plan · Nemotron 3 Ultra Free · 8m 12s
make me a separate md file named opencode_implementation_plan.md and include this plan in this file proplery 
+ Thought: 11.1s
I'm in plan mode (read-only), so I cannot create files. However, I'll provide the complete markdown content below that you can save as opencode_implementation_plan.md.
BidCreationWizardV2 — Implementation Plan
1. Overview
Aspect	Decision
Module Name	BidCreationWizardV2 (new feature, separate from existing ProcurementWizard)
Route	/buyer/create-bid (new) — existing /buyer/create-procurement unchanged
Use Case	Formal bids: Product, Service, Custom, BOQ, RA, Reverse Auction, PAC
Existing Wizard	Keep for quick procurement/cart/direct purchase/L1
DB Enum Values	PRODUCT_BID, SERVICE_BID, CUSTOM_BID, BOQ_BID, BID_WITH_RA, REVERSE_AUCTION, PAC_BID
UI Labels	User-friendly labels via central mapping constant
2. Backend Changes
2.1 Database (Prisma)
New Model: BidWizardDraft
model BidWizardDraft {
  id              Int      @id @default(autoincrement())
  buyerId         Int
  bidType         BidType  // Enum: PRODUCT_BID, SERVICE_BID, etc.
  currentStep     Int      @default(1)
  completedSteps  Int[]    @default([])
  formData        Json     // All step data
  validationState Json     // Per-step validation errors
  lastSavedAt     DateTime @default(now())
  draftStatus     DraftStatus @default(DRAFT)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  buyer           User     @relation(fields: [buyerId], references: [id], onDelete: Cascade)
  @@index([buyerId, updatedAt])
  @@index([bidType, draftStatus])
}

enum BidType {
  PRODUCT_BID
  SERVICE_BID
  CUSTOM_BID
  BOQ_BID
  BID_WITH_RA
  REVERSE_AUCTION
  PAC_BID
}

enum DraftStatus {
  DRAFT
  SUBMITTED
  PUBLISHED
}
Extend ProcurementBid with Two Packet fields:
model ProcurementBid {
  // ... existing fields
  packetType       PacketType?     @default(SINGLE_PACKET)
  technicalPacket  Json?           // Step 6 technical criteria
  financialPacket  Json?           // Step 7 financial criteria
  // ...
}

enum PacketType {
  SINGLE_PACKET
  TWO_PACKET
}
Master Data Tables (if not exist):
model DistrictMaster {
  id        Int    @id @default(autoincrement())
  name      String @unique
  state     String @default("Maharashtra")
  talukas   TalukaMaster[]
}

model TalukaMaster {
  id         Int      @id @default(autoincrement())
  name       String
  districtId Int
  district   DistrictMaster @relation(fields: [districtId], references: [id])
  villages   VillageMaster[]
  @@unique([name, districtId])
}

model VillageMaster {
  id       Int      @id @default(autoincrement())
  name     String
  talukaId Int
  taluka   TalukaMaster @relation(fields: [talukaId], references: [id])
  @@unique([name, talukaId])
}
2.2 New API Routes (bid-wizard.routes.ts)
Method	Path	Description
POST	/api/buyer/bid-wizard/draft	Create draft (returns draftId)
GET	/api/buyer/bid-wizard/draft/:id	Load draft
PUT	/api/buyer/bid-wizard/draft/:id	Update draft (auto-save + manual)
POST	/api/buyer/bid-wizard/validate-step	Validate single step payload
POST	/api/buyer/bid-wizard/submit	Final submit after preview
GET	/api/buyer/bid-wizard/preview/:id	Get compiled preview data
DELETE	/api/buyer/bid-wizard/draft/:id	Delete draft
2.3 Validation Schemas (Zod)
Step 1 Schema:
const step1Schema = z.object({
  bidType: z.enum(['PRODUCT_BID', 'SERVICE_BID', 'CUSTOM_BID', 'BOQ_BID', 'BID_WITH_RA', 'REVERSE_AUCTION', 'PAC_BID']),
  procurementMethod: z.enum(['DIRECT_PURCHASE', 'L1_PURCHASE', 'E_BID', 'E_BID_WITH_RA', 'REVERSE_AUCTION', 'PAC_PROCUREMENT']),
  packetType: z.enum(['SINGLE_PACKET', 'TWO_PACKET']),
  isReverseAuctionRequired: z.boolean(),
  isPacRequired: z.boolean(),
  bidCreationMode: z.enum(['FRESH_BID', 'RE_BID', 'CORRIGENDUM', 'CANCELLED_RECREATED']),
});
Conditional Step 4 Schemas (one per bid type):
- step4ProductSchema, step4ServiceSchema, step4CustomSchema, step4BoqSchema, step4RaSchema, step4PacSchema
Step 6 Technical Packet Schema (if packetType === TWO_PACKET):
const technicalPacketSchema = z.object({
  technicalEligibilityCriteria: z.array(z.string()),
  minimumExperience: z.string().optional(),
  minimumTurnover: z.number().optional(),
  similarWorkExperience: z.string().optional(),
  certifications: z.array(z.string()).optional(),
  technicalProposalRequired: z.boolean(),
  complianceSheet: z.boolean(),
  pastWorkDocuments: z.array(z.string()).optional(),
  oemAuthorization: z.boolean().optional(),
  technicalDocumentUploads: z.array(z.number()).optional(), // fileAssetIds
  technicalEvaluationMethod: z.string(),
  technicalQualificationScore: z.number().optional(),
  technicalCommitteeIds: z.array(z.number()).optional(),
});
Step 7 Financial Packet Schema (if packetType === TWO_PACKET):
const financialPacketSchema = z.object({
  financialQuoteFormat: z.enum(['ITEM_WISE', 'TOTAL_BOQ', 'PERCENTAGE', 'LOT_WISE']),
  boqPriceSchedule: z.array(z.number()).optional(),
  taxGstDetails: z.object({ gstIncluded: z.boolean(), gstRate: z.number() }),
  paymentTerms: z.string(),
  priceValidityDays: z.number(),
  financialDocumentUploads: z.array(z.number()).optional(),
  financialOpeningRules: z.string(),
  financialEvaluationMethod: z.string(),
});
2.4 Service Layer (bid-wizard.service.ts)
Key functions:
- createDraft(buyerId, bidType, initialData) → creates BidWizardDraft
- updateDraft(draftId, step, formData, validationState, completedSteps)
- validateStep(step, formData, bidType, packetType) → returns { valid: boolean, errors: Record<string, string[]> }
- compilePreview(draftId) → merges all steps, resolves "Other" values
- submitBid(draftId) → creates ProcurementBid + documents, marks draft SUBMITTED
3. Frontend Implementation
3.1 Feature Structure
frontend/src/features/bidCreationWizardV2/
├── components/
│   ├── BidWizardLayout.tsx           # Stepper, progress, nav, save status
│   ├── steps/
│   │   ├── Step1_BidTypeSelection.tsx
│   │   ├── Step2_BuyerDetails.tsx
│   │   ├── Step3_BidBasicDetails.tsx
│   │   ├── Step4_ItemsDetails.tsx    # Conditional render per bidType
│   │   ├── Step5_DeliveryDetails.tsx
│   │   ├── Step6_EligibilityDetails.tsx  # + TechnicalPacket if Two Packet
│   │   ├── Step7_TermsDocuments.tsx      # + FinancialPacket if Two Packet
│   │   ├── Step8_SpecialConditions.tsx
│   │   └── Step9_PreviewPublish.tsx
│   ├── common/
│   │   ├── FormField.tsx             # Label, *, input, error, help text
│   │   ├── SearchableSelect.tsx      # Debounced search, "Other" + textbox
│   │   ├── SearchableMultiSelect.tsx
│   │   ├── OtherTextInput.tsx        # "Other" handler
│   │   ├── ConditionalSection.tsx    # Show/hide by bidType/packetType
│   │   ├── DocumentUploadSection.tsx # Multi-file, progress, mandatory/optional
│   │   ├── ConsigneeForm.tsx         # Single consignee
│   │   ├── MultipleConsigneeTable.tsx # Qty per consignee
│   │   ├── ConsigneeExcelUpload.tsx  # Bulk upload
│   │   ├── PacketTypeBadge.tsx       # Visual indicator
│   │   ├── TechnicalPacketSection.tsx
│   │   ├── FinancialPacketSection.tsx
│   │   ├── PreviewSection.tsx        # Read-only card per step
│   │   ├── DeclarationCheckbox.tsx   # Required checkbox with text
│   │   └── SaveStatusIndicator.tsx   # Saving... / Saved / Failed
├── hooks/
│   ├── useBidWizard.ts               # Main state: step, formData, validation, draftId
│   ├── useStepValidation.ts          # Runs validation on step change/blur
│   ├── useDraftPersistence.ts        # Auto-save (debounced) + manual save
│   ├── useFieldDependencies.ts       # Bid-type → field visibility logic
│   └── useMasterData.ts              # District/Taluka/Village search
├── utils/
│   ├── constants.ts                  # All dropdown options (centralized)
│   ├── validation.ts                 # Validation rules per step
│   ├── fieldMapping.ts               # Form → API payload transform
│   ├── bidTypeConfig.ts              # Bid type → steps, required fields
│   └── helpers.ts                    # Money format, date helpers
├── types/
│   ├── steps.ts                      # Step 1-9 interfaces
│   ├── masterData.ts                 # District/Taluka/Village
│   └── api.ts                        # API request/response types
├── api.ts                            # API calls
└── pages/
    └── CreateBidPage.tsx             # Main page, route handler
3.2 Constants File (constants.ts)
// Central enum → label mapping
export const BID_TYPE_LABELS: Record<BidType, string> = {
  PRODUCT_BID: 'Product Bid',
  SERVICE_BID: 'Service Bid',
  CUSTOM_BID: 'Custom Bid',
  BOQ_BID: 'BOQ Based Bid',
  BID_WITH_RA: 'Bid with Reverse Auction',
  REVERSE_AUCTION: 'Reverse Auction',
  PAC_BID: 'PAC / Proprietary Bid',
};

// All dropdown options from your spec
export const PROCUREMENT_METHOD_OPTIONS = [
  { value: 'DIRECT_PURCHASE', label: 'Direct Purchase' },
  { value: 'L1_PURCHASE', label: 'L1 Purchase' },
  { value: 'E_BID', label: 'e-Bid' },
  { value: 'E_BID_WITH_RA', label: 'e-Bid with Reverse Auction' },
  { value: 'REVERSE_AUCTION', label: 'Reverse Auction' },
  { value: 'PAC_PROCUREMENT', label: 'PAC Procurement' },
] as const;

export const PACKET_TYPE_OPTIONS = [
  { value: 'SINGLE_PACKET', label: 'Single Packet' },
  { value: 'TWO_PACKET', label: 'Two Packet' },
] as const;

export const MAHARASHTRA_DISTRICTS = [
  'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad / Chhatrapati Sambhajinagar',
  'Beed', 'Bhandara', 'Buldhana', 'Chandrapur', 'Dhule', 'Gadchiroli',
  'Gondia', 'Hingoli', 'Jalgaon', 'Jalna', 'Kolhapur', 'Latur',
  'Mumbai City', 'Mumbai Suburban', 'Nagpur', 'Nanded', 'Nandurbar',
  'Nashik', 'Osmanabad / Dharashiv', 'Palghar', 'Parbhani', 'Pune',
  'Raigad', 'Ratnagiri', 'Sangli', 'Satara', 'Sindhudurg', 'Solapur',
  'Thane', 'Wardha', 'Washim', 'Yavatmal',
] as const;

// Product categories, Service categories, Units, Financial Years, etc.
// All from your spec...
3.3 Core Hook: useBidWizard.ts
interface BidWizardState {
  draftId: number | null;
  currentStep: number;
  bidType: BidType | null;
  packetType: 'SINGLE_PACKET' | 'TWO_PACKET';
  formData: {
    step1: Step1Data;
    step2: Step2Data;
    step3: Step3Data;
    step4: Step4Data;       // Discriminated union by bidType
    step5: Step5Data;
    step6: Step6Data;
    step7: Step7Data;
    step8: Step8Data;
    step9: Step9Data;
  };
  validationErrors: Record<number, Record<string, string[]>>;
  completedSteps: number[];
  saveStatus: 'idle' | 'saving' | 'saved' | 'failed';
  lastSavedAt: string | null;
  isSubmitting: boolean;
}

// Actions
const actions = {
  setStep: (step: number) => void;
  updateField: (step: number, field: string, value: any) => void;
  updateStepData: (step: number, data: any) => void;
  validateCurrentStep: () => Promise<boolean>;
  saveDraft: (manual?: boolean) => Promise<void>;
  submitBid: () => Promise<void>;
  loadDraft: (draftId: number) => Promise<void>;
  resetWizard: () => void;
};
3.4 Auto-Save Logic (useDraftPersistence.ts)
// Debounced auto-save per step
const DEBOUNCE_MS = 1000;

useEffect(() => {
  if (!isDirty || !draftId) return;
  const timer = setTimeout(() => {
    saveDraft({ silent: true });
  }, DEBOUNCE_MS);
  return () => clearTimeout(timer);
}, [formData, currentStep, isDirty]);

// Manual save button always visible
const handleManualSave = () => saveDraft({ silent: false });
3.5 Conditional Rendering (useFieldDependencies.ts)
const STEP_CONFIG_BY_BID_TYPE: Record<BidType, StepConfig[]> = {
  PRODUCT_BID: [
    { step: 4, component: 'ProductBidFields', required: true },
    { step: 4, component: 'WarrantySection', required: true },
    { step: 4, component: 'InspectionType', required: true },
  ],
  SERVICE_BID: [
    { step: 4, component: 'ServiceBidFields', required: true },
    { step: 4, component: 'SLASection', required: true },
    { step: 4, component: 'StatutoryCompliance', required: true },
  ],
  CUSTOM_BID: [
    { step: 4, component: 'CustomBidFields', required: true },
  ],
  BOQ_BID: [
    { step: 4, component: 'BOQUploadOrEntry', required: true },
    { step: 4, component: 'BOQLineItemsTable', required: true },
  ],
  BID_WITH_RA: [
    { step: 4, component: 'ProductBidFields', required: true },
    { step: 4, component: 'ReverseAuctionFields', required: true },
  ],
  REVERSE_AUCTION: [
    { step: 4, component: 'ReverseAuctionFields', required: true },
  ],
  PAC_BID: [
    { step: 4, component: 'PACFields', required: true },
  ],
};

// Two Packet conditional sections
const TWO_PACKET_SECTIONS = {
  step6: 'TechnicalPacketSection',
  step7: 'FinancialPacketSection',
};
4. Step-by-Step Component Details
Step 1: Bid Type Selection
- Fields: Bid Type (SearchableSelect), Procurement Method (SearchableSelect), Packet Type (Radio), RA Required (Radio), PAC Required (Radio), Bid Creation Mode (SearchableSelect)
- All required
- On bidType change → reset step 4, update conditional steps
- On packetType change → set flag for step 6/7 sections
Step 2: Buyer/Department Details
- Auto-fill from BuyerProfile (use useMasterData to fetch on mount)
- Fields: Org Name (auto), Ministry (SearchableSelect), Buyer Name (auto), Designation (auto), Email (auto), Mobile (auto), Office Address (textarea), State (SearchableSelect), District (SearchableSelect, required), Taluka (SearchableSelect, dependent on district, required), Village/City/Ward (SearchableSelect or text), Financial Year (SearchableSelect), Dept File No (optional), Competent Authority Name/Designation (text, required)
- "Other" option for Ministry, State, District with required textbox
Step 3: Bid Basic Details
- Title (text, required), Short Description (textarea, required), Procurement Category (SearchableSelect, required), Sector/Department Area (SearchableSelect, required), Estimated Value (number, required), Budget Confirmed (Radio), Budget Head (conditional text), Procurement Purpose (textarea), Priority (SearchableSelect), Publishing Date (datetime, auto), Closing Date (datetime, required), Validity Period (SearchableSelect), Pre-Bid Meeting (Radio), Pre-Bid Date/Mode/Venue (conditional)
Step 4: Item/Service/BOQ/Custom Details
- Conditional render based on bidType from Step 1
- Each sub-component handles its own validation
- "Other" handled via OtherTextInput wrapper
Step 5: Delivery/Consignee Details
- Consignee Type (Radio: Single/Multiple)
- Single: ConsigneeForm component
- Multiple: MultipleConsigneeTable + ConsigneeExcelUpload
- Delivery Period (SearchableSelect), Installation Site Same (Radio), Installation Address (conditional), Inspection Officer (optional), Acceptance Criteria (textarea, required), LD/Penalty (Radio), Penalty Details (conditional)
Step 6: Eligibility & Evaluation
- Evaluation Method (SearchableSelect)
- Technical Qualification (Radio), Min Experience (conditional), Min Turnover (conditional), Similar Work (conditional), Bidder Documents (SearchableMultiSelect), MSE Preference (Radio), Make in India (Radio), EMD (Radio + conditional amount), PBG (Radio + conditional %), Blacklisting Declaration (Radio), Conflict of Interest (Radio)
- If Two Packet: Render TechnicalPacketSection component
Step 7: Terms, Documents & Compliance
- Document uploads (Scope, Tech Spec, Budget Sanction, Admin Approval, BOQ, PAC Cert, Drawings, Additional Terms) — mandatory/optional per bid type
- Payment Terms (SearchableSelect), Advance Payment (Radio), Part Payment (Radio), Invoice Required (Radio), GST Invoice (Radio), E-way Bill (Radio)
- If Two Packet: Render FinancialPacketSection component
Step 8: Special Conditions
- All Radio fields: Corrigendum, Cancellation, Clarification, Seller Query, Document Resubmission, Splitting, Multiple Award, Rate Contract
Step 9: Preview & Publish
- Read-only summary cards for each step (use PreviewSection component)
- Each card has "Edit" link → navigates to that step
- Two required DeclarationCheckbox components
- Buttons: Save Draft, Submit for Approval (if workflow), Publish Bid, Generate Preview PDF
- Publish disabled until all validations pass + declarations checked
5. Shared Reusable Components
Component	Purpose
SearchableSelect	Debounced search, "Other" + required textbox, server-side search for large datasets
SearchableMultiSelect	Multi-select with search, chips display
OtherTextInput	Shows required textbox when "Other" selected, stores dropdownValue: "Other", otherValue: "..."
FormField	Label + red asterisk + input + error message + help text
ConditionalSection	showWhen prop (function), animates in/out
DocumentUploadSection	Drag-drop, progress, mandatory badge, file type validation
ConsigneeForm / MultipleConsigneeTable	Reusable across steps
TechnicalPacketSection / FinancialPacketSection	Only rendered when packetType === TWO_PACKET
SaveStatusIndicator	Shows saving/saved/failed with timestamp
DeclarationCheckbox	Required checkbox with full text, validation
6. Validation Rules Summary
Step	Must Pass Before Next Step
1	All 6 fields filled
2	All auto-filled present, Ministry, District, Taluka, Financial Year, Competent Authority
3	Title, Category, Sector, Est. Value, Closing Date, Validity, Priority
4	Per bidType required fields (see spec)
5	Consignee, Delivery Period, Acceptance Criteria
6	Eval Method, EMD/PBG amounts if yes, Technical Packet if Two Packet
7	Required docs uploaded, Payment Terms, GST Invoice
8	All radios answered
9	Both declarations checked, ALL previous steps valid
7. Integration & Routes
Backend Route Registration
// backend/src/routes/index.ts
import bidWizardRoutes from '../modules/procurementBid/bid-wizard.routes';
router.use('/buyer/bid-wizard', bidWizardRoutes);
Frontend Route
// frontend/src/app/buyer/create-bid/[[...slug]]/page.tsx
'use client';
import CreateBidPage from '@/features/bidCreationWizardV2/pages/CreateBidPage';
export default CreateBidPage;
Navigation Entry Points
- Buyer Dashboard → "Create Formal Bid" → /buyer/create-bid
- Keep "Quick Procurement" → /buyer/create-procurement (existing)
8. Migration & Backward Compatibility
Action	Approach
Existing ProcurementWizard	Keep unchanged — feature flag if needed
Shared logic	Extract to frontend/src/features/shared/ (SearchableSelect, DocumentUpload, etc.)
Old bid creation in ProcurementWizard	Deprecate via comment, not delete
Database migration	Add BidWizardDraft, DistrictMaster, TalukaMaster, VillageMaster, extend ProcurementBid
API versioning	New routes under /bid-wizard, old routes untouched
9. Implementation Phases
Phase	Deliverables
1. Backend Core	Prisma models, migration, validation schemas, routes, service
2. Frontend Foundation	Types, constants, shared components (SearchableSelect, FormField, etc.)
3. Step Components	9 step components + conditional logic
4. Wizard Orchestration	useBidWizard, useDraftPersistence, useStepValidation, layout
5. Integration & Polish	Route, API connect, preview generation, PDF, error handling
6. Testing	Unit (validation), E2E (full flow), conditional rendering, draft restore
Total: ~13-15 days
10. Key Technical Decisions Summary
Decision	Implementation
Enum in DB	BidType enum with normalized values
UI Labels	Central BID_TYPE_LABELS mapping constant
Taluka	Searchable dependent dropdown → "Other" + required textbox
Draft	Auto-save (1s debounce) + manual button, per-step
Two Packet	Step 1 selects, Step 6 Technical, Step 7 Financial
Dropdowns	All searchable, "Other" with textbox, display otherValue
Validation	Per-step + full validation at Step 9
Backward Compat	Keep ProcurementWizard, extract shared components
11. Open Questions (Optional)
1. Master Data Seeding: Do you want me to include a seed script for Maharashtra districts/talukas/villages, or will you provide CSV/JSON?
2. PDF Generation: Use existing remotion or pdf-lib? Or server-side generation?
3. Approval Workflow: The "Submit for Internal Approval" button — should it trigger existing approval chain or new workflow?
4. File Upload Limits: 10MB per file? Total draft size limit?
5. Real-time Validation: Show errors on blur vs on change? (Recommend: on blur for draft, on change for Step 9)
12. File Creation Checklist
Backend (New Files)
- backend/prisma/schema.prisma — Add BidWizardDraft, DistrictMaster, TalukaMaster, VillageMaster, extend ProcurementBid
- backend/src/modules/procurementBid/bid-wizard.routes.ts
- backend/src/modules/procurementBid/bid-wizard.service.ts
- backend/src/modules/procurementBid/bid-wizard.validation.ts
- backend/src/modules/procurementBid/bid-wizard.types.ts
Frontend (New Feature)
- frontend/src/features/bidCreationWizardV2/types/steps.ts
- frontend/src/features/bidCreationWizardV2/types/masterData.ts
- frontend/src/features/bidCreationWizardV2/types/api.ts
- frontend/src/features/bidCreationWizardV2/utils/constants.ts
- frontend/src/features/bidCreationWizardV2/utils/validation.ts
- frontend/src/features/bidCreationWizardV2/utils/fieldMapping.ts
- frontend/src/features/bidCreationWizardV2/utils/bidTypeConfig.ts
- frontend/src/features/bidCreationWizardV2/utils/helpers.ts
- frontend/src/features/bidCreationWizardV2/hooks/useBidWizard.ts
- frontend/src/features/bidCreationWizardV2/hooks/useStepValidation.ts
- frontend/src/features/bidCreationWizardV2/hooks/useDraftPersistence.ts
- frontend/src/features/bidCreationWizardV2/hooks/useFieldDependencies.ts
- frontend/src/features/bidCreationWizardV2/hooks/useMasterData.ts
- frontend/src/features/bidCreationWizardV2/components/common/FormField.tsx
- frontend/src/features/bidCreationWizardV2/components/common/SearchableSelect.tsx
- frontend/src/features/bidCreationWizardV2/components/common/SearchableMultiSelect.tsx
- frontend/src/features/bidCreationWizardV2/components/common/OtherTextInput.tsx
- frontend/src/features/bidCreationWizardV2/components/common/ConditionalSection.tsx
- frontend/src/features/bidCreationWizardV2/components/common/DocumentUploadSection.tsx
- frontend/src/features/bidCreationWizardV2/components/common/ConsigneeForm.tsx
- frontend/src/features/bidCreationWizardV2/components/common/MultipleConsigneeTable.tsx
- frontend/src/features/bidCreationWizardV2/components/common/ConsigneeExcelUpload.tsx
- frontend/src/features/bidCreationWizardV2/components/common/PacketTypeBadge.tsx
- frontend/src/features/bidCreationWizardV2/components/common/TechnicalPacketSection.tsx
- frontend/src/features/bidCreationWizardV2/components/common/FinancialPacketSection.tsx
- frontend/src/features/bidCreationWizardV2/components/common/PreviewSection.tsx
- frontend/src/features/bidCreationWizardV2/components/common/DeclarationCheckbox.tsx
- frontend/src/features/bidCreationWizardV2/components/common/SaveStatusIndicator.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step1_BidTypeSelection.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step2_BuyerDetails.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step3_BidBasicDetails.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step4_ItemsDetails.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step5_DeliveryDetails.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step6_EligibilityDetails.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step7_TermsDocuments.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step8_SpecialConditions.tsx
- frontend/src/features/bidCreationWizardV2/components/steps/Step9_PreviewPublish.tsx
- frontend/src/features/bidCreationWizardV2/components/BidWizardLayout.tsx
- frontend/src/features/bidCreationWizardV2/api.ts
- frontend/src/features/bidCreationWizardV2/pages/CreateBidPage.tsx
Modified Files
- backend/src/routes/index.ts — Register /buyer/bid-wizard routes
- frontend/src/app/buyer/create-bid/[[...slug]]/page.tsx — New route page