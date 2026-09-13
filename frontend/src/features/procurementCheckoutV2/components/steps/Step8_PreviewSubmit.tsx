'use client';

import { FileText } from 'lucide-react';
import { PROCUREMENT_METHOD_LABELS } from '../../constants';
import type { CartDto } from '../../../cart/api';
import type { CartEvaluation, CheckoutFormData } from '../../types';
import { formatCurrency } from '../../../shared/format';
import { cn } from '../../../../lib/utils';

import { ComplianceConsentCard, type ComplianceDoc } from '../../../../components/compliance/ComplianceConsentCard';
import { OrderPlacementPolicyContent, CancellationRefundPolicyContent } from '../../../../components/compliance/CompliancePoliciesText';

const DECLARATIONS = [
  ['specsConfirmed', 'I confirm the selected product/service meets required specifications.'],
  ['priceReasonabilityConfirmed', 'I confirm price reasonability.'],
  ['budgetConfirmed', 'I confirm budget availability.'],
  ['authorityConfirmed', 'I confirm competent authority approval.'],
  ['noDemandSplitConfirmed', 'I confirm this purchase is not split to avoid Bid/RA or higher approval.'],
  ['termsAccepted', 'I agree to portal procurement terms.'],
] as const;

const MANDATORY_DECLARATIONS = new Set<string>([
  'specsConfirmed',
  'priceReasonabilityConfirmed',
  'budgetConfirmed',
  'noDemandSplitConfirmed',
  'termsAccepted',
]);

export default function Step8_PreviewSubmit({
  cart,
  form,
  evaluation,
  onDeclarationChange,
  errors,
}: {
  cart?: CartDto;
  form: CheckoutFormData;
  evaluation: CartEvaluation | null;
  onDeclarationChange: (field: string, value: boolean) => void;
  errors: Record<string, string>;
}) {
  const total = cart?.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice), 0) ?? 0;

  const complianceDocs: ComplianceDoc[] = [
    {
      id: 'procurement',
      name: 'Order_Placement_Procurement_Policy.pdf',
      pdfFile: 'Order_Placement_Procurement_Policy.pdf',
      title: 'Procurement Policy',
      content: <OrderPlacementPolicyContent />,
    },
    {
      id: 'cancellation',
      name: 'Order_Cancellation_Refund_Policy.pdf',
      pdfFile: 'Order_Cancellation_Refund_Policy.pdf',
      title: 'Cancellation & Refund',
      content: <CancellationRefundPolicyContent />,
    },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-black text-slate-950">Step 8 — Preview & Submit</h2>
      <div className="grid gap-3 text-xs md:grid-cols-2">
        <PreviewBlock title="Cart Summary" lines={[`${cart?.items.length || 0} items`, `Total ${formatCurrency(total)}`]} />
        <PreviewBlock title="Procurement Method" lines={[PROCUREMENT_METHOD_LABELS[form.selectedMethod] || form.selectedMethod || '—']} />
        <PreviewBlock title="Buyer" lines={[String(form.buyerDetails.organizationName || '—'), String(form.buyerDetails.buyerOfficerName || '')]} />
        <PreviewBlock title="Delivery" lines={[String(form.deliveryDetails.deliveryAddress || '—'), String(form.deliveryDetails.deliveryPeriod || '')]} />
        <PreviewBlock
          title="Budget & Sanction"
          lines={[
            `Confirmed: ${form.budgetSanction.budgetAvailabilityConfirmed || 'No'}`,
            `Budget Head/Scheme: ${form.budgetSanction.budgetHeadScheme || '—'}`,
            `Financial Year: ${form.budgetSanction.financialYear || '—'}`,
            `Fund Source: ${form.budgetSanction.fundSource || '—'}`,
            `Sanction Amount: ${form.budgetSanction.sanctionAmount ? formatCurrency(Number(form.budgetSanction.sanctionAmount)) : '—'}`,
            `Sanction Order No: ${form.budgetSanction.sanctionOrderNumber || 'Pending / Proposal note'}`,
            `Approving Authority: ${form.budgetSanction.approvingAuthority || '—'}`,
            `Estimated Price: ${form.priceReasonability.estimatedPrice ? formatCurrency(Number(form.priceReasonability.estimatedPrice)) : '—'}`,
            ...(form.priceReasonability.portalL1Price ? [`Portal L1 Price: ${formatCurrency(Number(form.priceReasonability.portalL1Price))}`] : []),
            `Remarks: ${form.priceReasonability.priceReasonabilityRemarks || '—'}`
          ]}
        />
      </div>
      {/* Uploaded Documents Preview */}
      {(() => {
        const docs = Array.isArray((form.termsDocuments as any)?.documents)
          ? [...((form.termsDocuments as any).documents as any[])]
          : [];
        if (form.budgetSanction.budgetApprovalDocumentId && form.budgetSanction.budgetApprovalDocumentName) {
          docs.push({
            documentType: 'Budget Approval',
            fileName: String(form.budgetSanction.budgetApprovalDocumentName),
          });
        }
        if (form.budgetSanction.sanctionOrderDocumentId && form.budgetSanction.sanctionOrderDocumentName) {
          docs.push({
            documentType: 'Sanction Order',
            fileName: String(form.budgetSanction.sanctionOrderDocumentName),
          });
        }
        const terms = form.termsDocuments as Record<string, unknown>;
        const termLines = ['deliveryTerms', 'paymentTerms', 'warrantyTerms', 'inspectionTerms'].map(k => String(terms[k] || '')).filter(Boolean);
        if (docs.length === 0 && termLines.length === 0) return null;
        return (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-black text-slate-800">Terms & Documents</p>
            {termLines.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {termLines.map((line, i) => (
                  <p key={i} title={line} className="text-slate-600 truncate">{line}</p>
                ))}
              </div>
            )}
            {docs.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Uploaded Documents ({docs.length})</p>
                {docs.map((doc, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-slate-600">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span title={doc.fileName} className="truncate">{doc.fileName}</span>
                    <span className="shrink-0 text-slate-400">({doc.documentType})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}
      {evaluation?.warnings?.map(w => (
        <p key={w} className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">{w}</p>
      ))}
      <div className="space-y-3 border-t border-slate-200 pt-4">
        <h3 className="text-sm font-black text-slate-900">Mandatory Sourcing Declarations</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {DECLARATIONS.filter(([key]) => key !== 'termsAccepted').map(([key, label]) => {
            const isMandatory = MANDATORY_DECLARATIONS.has(key);
            const hasError = Boolean(errors[key]);
            return (
              <label
                key={key}
                className={cn(
                  "flex items-start gap-2 text-xs cursor-pointer transition-colors p-2 rounded-lg border border-slate-100 bg-white hover:bg-slate-50",
                  hasError ? "border-red-300 text-red-600 font-medium" : "text-slate-700 hover:text-slate-900"
                )}
              >
                <input
                  type="checkbox"
                  checked={Boolean(form.declarations[key as keyof typeof form.declarations])}
                  onChange={e => onDeclarationChange(key, e.target.checked)}
                  className="mt-0.5 rounded text-[#12335f] focus:ring-[#12335f]/20 cursor-pointer"
                />
                <span>
                  {label}
                  {isMandatory && <span className="text-red-500 font-bold ml-1">*</span>}
                </span>
              </label>
            );
          })}
        </div>

        {/* Compliance Legal Consent Card for Procurement & Cancellation */}
        <div className="pt-2">
          <ComplianceConsentCard
            docs={complianceDocs}
            title="Procurement & Order Cancellation Policies"
            subtitle="Statutory compliance agreement governing Purchase Order issuance, T+1 settlement, and cancellation terms."
            accepted={Boolean(form.declarations.termsAccepted)}
            onAcceptedChange={val => onDeclarationChange('termsAccepted', val)}
            checkboxLabel="I accept the Procurement Facilitation Policy and Cancellation & Refund Policy"
            checkboxDescription="By authorizing this order, you legally confirm administrative sanction, agree to binding purchase order terms, and accept the cancellation and settlement framework of JSG SMILE."
            readerHeightClassName="h-[240px] sm:h-[280px]"
            showPolicyLibrary
          />
          {errors.termsAccepted && (
            <p className="text-xs font-bold text-red-600 mt-1">{errors.termsAccepted}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewBlock({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="font-black text-slate-800">{title}</p>
      {lines.map(l => <p key={l} className="text-slate-600">{l}</p>)}
    </div>
  );
}
