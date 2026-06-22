-- Procurement checkout refactor: ProcurementRequest, mode settings, L1 comparison, PRC, CRAC

CREATE TYPE "ProcurementRequestStatus" AS ENUM (
  'DRAFT',
  'PROCUREMENT_METHOD_SELECTED',
  'SUBMITTED_FOR_APPROVAL',
  'APPROVED',
  'REJECTED',
  'SENT_BACK_FOR_CORRECTION',
  'CONVERTED_TO_ORDER',
  'CONVERTED_TO_BID',
  'CANCELLED'
);

CREATE TABLE "ProcurementRequest" (
  "id" SERIAL PRIMARY KEY,
  "requestNumber" TEXT NOT NULL UNIQUE,
  "cartId" INTEGER,
  "buyerId" INTEGER NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "selectedMethod" TEXT,
  "recommendedMethod" TEXT,
  "status" "ProcurementRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "cartSnapshot" JSONB,
  "buyerDetails" JSONB,
  "consigneeDetails" JSONB,
  "deliveryDetails" JSONB,
  "budgetSanction" JSONB,
  "paymentAuthority" JSONB,
  "priceReasonability" JSONB,
  "termsDocuments" JSONB,
  "l1ComparisonId" INTEGER,
  "pacJustification" JSONB,
  "warnings" JSONB,
  "declarations" JSONB,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ProcurementModeSetting" (
  "id" SERIAL PRIMARY KEY,
  "organizationId" INTEGER,
  "directPurchaseMaxValue" DECIMAL(18,2) NOT NULL DEFAULT 25000,
  "l1PurchaseMaxValue" DECIMAL(18,2) NOT NULL DEFAULT 500000,
  "bidMinValue" DECIMAL(18,2) NOT NULL DEFAULT 500001,
  "raRecommendedMinValue" DECIMAL(18,2) NOT NULL DEFAULT 500001,
  "pacApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  "internalApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
  "demandSplitLookbackDays" INTEGER NOT NULL DEFAULT 90,
  "demandSplitSimilarityThreshold" DECIMAL(5,4) NOT NULL DEFAULT 0.8,
  "allowNonL1WithApproval" BOOLEAN NOT NULL DEFAULT true,
  "governmentProcurementOnlineGatewayEnabled" BOOLEAN NOT NULL DEFAULT false,
  "allowLegacyGrnInvoiceGate" BOOLEAN NOT NULL DEFAULT true,
  "financeSkipThreshold" DECIMAL(18,2) NOT NULL DEFAULT 50000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "L1Comparison" (
  "id" SERIAL PRIMARY KEY,
  "comparisonNumber" TEXT NOT NULL UNIQUE,
  "cartId" INTEGER,
  "buyerId" INTEGER NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "comparedSellers" JSONB NOT NULL,
  "selectedSellerId" INTEGER,
  "l1SellerId" INTEGER,
  "nonL1Justification" TEXT,
  "snapshot" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ProvisionalReceiptCertificate" (
  "id" SERIAL PRIMARY KEY,
  "prcNumber" TEXT NOT NULL UNIQUE,
  "purchaseOrderId" INTEGER NOT NULL,
  "grnId" INTEGER,
  "generatedById" INTEGER NOT NULL,
  "receivedQuantity" DECIMAL(18,3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "remarks" TEXT,
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "ConsigneeReceiptAcceptanceCertificate" (
  "id" SERIAL PRIMARY KEY,
  "cracNumber" TEXT NOT NULL UNIQUE,
  "purchaseOrderId" INTEGER NOT NULL,
  "prcId" INTEGER,
  "grnId" INTEGER,
  "generatedById" INTEGER NOT NULL,
  "inspectionResult" TEXT NOT NULL,
  "acceptedQuantity" DECIMAL(18,3) NOT NULL,
  "rejectedQuantity" DECIMAL(18,3),
  "acceptanceRemarks" TEXT NOT NULL,
  "rejectionReason" TEXT,
  "installationCompleted" BOOLEAN,
  "warrantyDocumentId" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'GENERATED',
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "ProcurementModeSetting_organizationId_key" ON "ProcurementModeSetting"("organizationId");
CREATE INDEX "ProcurementRequest_buyerId_status_idx" ON "ProcurementRequest"("buyerId", "status");
CREATE INDEX "ProcurementRequest_organizationId_status_idx" ON "ProcurementRequest"("organizationId", "status");
CREATE INDEX "ProcurementRequest_selectedMethod_idx" ON "ProcurementRequest"("selectedMethod");
CREATE INDEX "ProcurementRequest_cartId_idx" ON "ProcurementRequest"("cartId");
CREATE INDEX "L1Comparison_buyerId_idx" ON "L1Comparison"("buyerId");
CREATE INDEX "L1Comparison_organizationId_idx" ON "L1Comparison"("organizationId");
CREATE INDEX "L1Comparison_cartId_idx" ON "L1Comparison"("cartId");
CREATE INDEX "ProvisionalReceiptCertificate_purchaseOrderId_idx" ON "ProvisionalReceiptCertificate"("purchaseOrderId");
CREATE INDEX "ProvisionalReceiptCertificate_grnId_idx" ON "ProvisionalReceiptCertificate"("grnId");
CREATE INDEX "ProvisionalReceiptCertificate_generatedById_idx" ON "ProvisionalReceiptCertificate"("generatedById");
CREATE INDEX "ConsigneeReceiptAcceptanceCertificate_purchaseOrderId_idx" ON "ConsigneeReceiptAcceptanceCertificate"("purchaseOrderId");
CREATE INDEX "ConsigneeReceiptAcceptanceCertificate_prcId_idx" ON "ConsigneeReceiptAcceptanceCertificate"("prcId");
CREATE INDEX "ConsigneeReceiptAcceptanceCertificate_grnId_idx" ON "ConsigneeReceiptAcceptanceCertificate"("grnId");
CREATE INDEX "ConsigneeReceiptAcceptanceCertificate_generatedById_idx" ON "ConsigneeReceiptAcceptanceCertificate"("generatedById");

ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcurementRequest" ADD CONSTRAINT "ProcurementRequest_l1ComparisonId_fkey" FOREIGN KEY ("l1ComparisonId") REFERENCES "L1Comparison"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProcurementModeSetting" ADD CONSTRAINT "ProcurementModeSetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "L1Comparison" ADD CONSTRAINT "L1Comparison_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "L1Comparison" ADD CONSTRAINT "L1Comparison_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProvisionalReceiptCertificate" ADD CONSTRAINT "ProvisionalReceiptCertificate_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProvisionalReceiptCertificate" ADD CONSTRAINT "ProvisionalReceiptCertificate_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProvisionalReceiptCertificate" ADD CONSTRAINT "ProvisionalReceiptCertificate_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsigneeReceiptAcceptanceCertificate" ADD CONSTRAINT "ConsigneeReceiptAcceptanceCertificate_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsigneeReceiptAcceptanceCertificate" ADD CONSTRAINT "ConsigneeReceiptAcceptanceCertificate_prcId_fkey" FOREIGN KEY ("prcId") REFERENCES "ProvisionalReceiptCertificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsigneeReceiptAcceptanceCertificate" ADD CONSTRAINT "ConsigneeReceiptAcceptanceCertificate_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceiptNote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsigneeReceiptAcceptanceCertificate" ADD CONSTRAINT "ConsigneeReceiptAcceptanceCertificate_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ProcurementModeSetting" (
  "organizationId",
  "directPurchaseMaxValue",
  "l1PurchaseMaxValue",
  "bidMinValue",
  "raRecommendedMinValue",
  "pacApprovalRequired",
  "internalApprovalRequired",
  "demandSplitLookbackDays",
  "demandSplitSimilarityThreshold",
  "allowNonL1WithApproval",
  "governmentProcurementOnlineGatewayEnabled",
  "allowLegacyGrnInvoiceGate",
  "financeSkipThreshold",
  "updatedAt"
)
SELECT NULL, 25000, 500000, 500001, 500001, true, true, 90, 0.8, true, false, true, 50000, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ProcurementModeSetting" WHERE "organizationId" IS NULL);
