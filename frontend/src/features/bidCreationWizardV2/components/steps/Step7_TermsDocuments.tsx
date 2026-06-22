import React from 'react';
import FormField from '../common/FormField';
import SearchableSelect from '../common/SearchableSelect';
import DocumentUploadSection from '../common/DocumentUploadSection';
import ConditionalSection from '../common/ConditionalSection';
import FinancialPacketSection from '../common/FinancialPacketSection';
import { PAYMENT_TERMS_OPTIONS } from '../../utils/constants';
import type { StepComponentProps } from '../../types/steps';

export default function Step7_TermsDocuments({ data, packetType, errors, updateField }: StepComponentProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <DocumentUploadSection label="Technical Specification Document" mandatory value={data.technicalSpecificationDocumentIds} onChange={value => updateField('technicalSpecificationDocumentIds', value)} />
        <DocumentUploadSection label="Budget Sanction Document" mandatory value={data.budgetSanctionDocumentIds} onChange={value => updateField('budgetSanctionDocumentIds', value)} />
        <DocumentUploadSection label="Administrative Approval Document" mandatory value={data.administrativeApprovalDocumentIds} onChange={value => updateField('administrativeApprovalDocumentIds', value)} />
        <DocumentUploadSection label="Scope of Work" value={data.scopeOfWorkDocumentIds} onChange={value => updateField('scopeOfWorkDocumentIds', value)} />
        <DocumentUploadSection label="BOQ Document" value={data.boqDocumentIds} onChange={value => updateField('boqDocumentIds', value)} />
        <DocumentUploadSection label="PAC Certificate" value={data.pacCertificateDocumentIds} onChange={value => updateField('pacCertificateDocumentIds', value)} />
        <DocumentUploadSection label="Drawings / Layouts" value={data.drawingDocumentIds} onChange={value => updateField('drawingDocumentIds', value)} />
        <DocumentUploadSection label="Additional Terms" value={data.additionalTermDocumentIds} onChange={value => updateField('additionalTermDocumentIds', value)} />
      </div>
      {Object.entries(errors).filter(([key]) => key.includes('Document') || key.includes('document') || key.includes('Uploads')).map(([key, value]) => (
        <p key={key} className="text-xs font-bold text-red-600">{value[0]}</p>
      ))}
      <div className="grid gap-4 md:grid-cols-2">
        <FormField label="Payment Terms" required error={errors.paymentTerms}><SearchableSelect value={data.paymentTerms} options={PAYMENT_TERMS_OPTIONS} onChange={value => updateField('paymentTerms', value)} allowOther /></FormField>
        {['advancePaymentAllowed', 'partPaymentAllowed', 'invoiceRequired', 'gstInvoiceRequired', 'ewayBillRequired'].map(field => (
          <label key={field} className="flex min-h-12 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={Boolean(data[field])} onChange={event => updateField(field, event.target.checked)} className="h-4 w-4 accent-[#12335f]" />
            {field}
          </label>
        ))}
      </div>
      <ConditionalSection showWhen={packetType === 'TWO_PACKET'}>
        <h3 className="mb-4 text-sm font-black text-slate-900">Financial Packet</h3>
        <FinancialPacketSection value={data.financialPacket} onChange={value => updateField('financialPacket', value)} />
        {errors.financialPacket && <p className="mt-2 text-xs font-bold text-red-600">{errors.financialPacket[0]}</p>}
      </ConditionalSection>
    </div>
  );
}
