import React from 'react';
import { SupplierAgreementContent } from '../registration/LegalDocumentsText';

export { SupplierAgreementContent as SupplierAgreementPolicyContent };

/**
 * Official Legal Text: Order Placement & Procurement Facilitation Policy
 * Extracted verbatim from /docs/Order_Placement_Procurement_Policy.pdf
 */
export function OrderPlacementPolicyContent() {
  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">
      <div className="text-center border-b border-slate-200 pb-4 mb-4">
        <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
          ORDER PLACEMENT &amp; PROCUREMENT FACILITATION POLICY
        </h2>
        <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-wide">
          JSG SMILE – Jharsuguda Supplier &amp; MSME Integrated Local Exchange
        </p>
        <p className="text-xs font-semibold text-slate-500">Website: www.jsgsmile.in</p>
        <p className="text-[11px] font-semibold text-slate-400">Effective Date: Statutory Operational Release</p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          1. PURPOSE
        </h3>
        <p className="leading-relaxed text-slate-700">
          This Order Placement &amp; Procurement Facilitation Policy (&ldquo;Policy&rdquo;) establishes the procedures, responsibilities, and guidelines governing the placement, acceptance, execution, tracking, and completion of procurement transactions through JSG SMILE (www.jsgsmile.in).
        </p>
        <p className="mt-1.5 leading-relaxed text-slate-700">
          The objective of this Policy is to facilitate transparent, efficient, and accountable procurement transactions between registered Buyers and Suppliers/MSMEs operating within Jharsuguda District.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          2. NATURE OF THE PORTAL
        </h3>
        <p className="font-bold text-slate-900">2.1 JSG SMILE is a procurement facilitation platform.</p>
        <p className="mt-2 font-bold text-slate-900">2.2 The Portal enables:</p>
        <ul className="space-y-1 pl-2 my-1.5">
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Product and service discovery.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Requirement posting.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>RFQ generation.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Quotation submission.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Purchase order creation.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Transaction tracking.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Payment tracking.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Supplier-Buyer communication.</span></li>
        </ul>
        <p className="mt-3 font-bold text-slate-900">2.3 The Portal does not:</p>
        <ul className="space-y-1 pl-2 my-1.5">
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Act as Buyer.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Act as Supplier.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Enter into commercial contracts.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Negotiate pricing.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Guarantee order fulfillment.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Guarantee delivery.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Guarantee payments.</span></li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          3. ELIGIBILITY FOR ORDER PLACEMENT
        </h3>
        <p className="leading-relaxed text-slate-700">Orders may be placed only by:</p>
        <ul className="space-y-1 pl-2 my-1.5">
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Verified Buyers registered on the Portal.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Authorized representatives of registered organizations.</span></li>
          <li className="flex items-start gap-2"><span className="text-[#12335f] font-bold shrink-0">•</span><span>Users possessing valid procurement authority within their organizations.</span></li>
        </ul>
        <p className="mt-1 leading-relaxed text-slate-700">
          The Portal may request additional authorization documents before permitting order placement.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          4. PROCUREMENT WORKFLOW
        </h3>
        <p className="leading-relaxed text-slate-700">The procurement process on JSG SMILE consists of standard lifecycle stages:</p>
        <div className="grid gap-2 sm:grid-cols-2 my-2 text-xs">
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 1: Requirement Identification</strong>
            <span className="text-slate-600">Buyer identifies procurement requirement and scope.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 2: Supplier Discovery</strong>
            <span className="text-slate-600">Buyer discovers registered local MSMEs, SHGs, and contractors.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 3: Request for Quotation (RFQ) / Bid</strong>
            <span className="text-slate-600">Buyer issues technical specs, BOQ, delivery terms, and schedules.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 4: Quotation Submission</strong>
            <span className="text-slate-600">Suppliers submit price bids, technical compliance, and validity commitments.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 5: Evaluation</strong>
            <span className="text-slate-600">Buyer independently evaluates bids on L1/T1 criteria without platform bias.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 6: Order Placement</strong>
            <span className="text-slate-600">Buyer places digital purchase order / work contract via the Portal.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 7: Order Acceptance</strong>
            <span className="text-slate-600">Supplier accepts commitment or declines with documented rationale.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 8: Delivery &amp; Inspection</strong>
            <span className="text-slate-600">Supplier fulfills goods/services per agreed quality specifications.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 9: Confirmation</strong>
            <span className="text-slate-600">Buyer confirms Goods Receipt (GRN) and generates acceptance note.</span>
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
            <strong className="text-slate-900 block font-bold">Stage 10: Settlement</strong>
            <span className="text-slate-600">Payment settlement proceeds under T+1 guidelines and MSMED Act terms.</span>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          5. ORDER CREATION
        </h3>
        <p className="leading-relaxed text-slate-700">
          An order generated electronically through the Portal includes Order Number, Buyer Information, Supplier Information, Product/Service Details, Quantity, Unit Price, Total Value, Applicable Taxes, Delivery Terms, Payment Terms, and Special Conditions.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          6. ORDER ACCEPTANCE
        </h3>
        <p className="leading-relaxed text-slate-700">
          <strong>6.1</strong> Suppliers shall review all order details before acceptance.
        </p>
        <p className="mt-1 leading-relaxed text-slate-700">
          <strong>6.2</strong> Acceptance of an order constitutes the Supplier&apos;s binding commitment to fulfill the order according to agreed terms.
        </p>
        <p className="mt-1 leading-relaxed text-slate-700">
          <strong>6.3</strong> Suppliers may reject orders due to capacity limitations, product unavailability, or regulatory restrictions.
        </p>
        <p className="mt-1 leading-relaxed text-slate-700">
          <strong>6.4</strong> Rejection of an order does not create liability for the Portal.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          7. COMMERCIAL TERMS &amp; RESPONSIBILITIES
        </h3>
        <p className="leading-relaxed text-slate-700">
          Commercial terms including pricing, discounts, taxes, delivery charges, warranty conditions, and service obligations shall be determined solely between Buyer and Supplier. The Portal does not set commercial terms.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          8. T+1 SETTLEMENT FRAMEWORK &amp; ESCROW PROTOCOL
        </h3>
        <p className="leading-relaxed text-slate-700">
          Subject to successful completion of transaction milestones: Buyer confirms delivery, invoice validation occurs, and payment settlement request is initiated. Timelines remain subject to standard banking cutoffs and statutory approvals.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          9. AUDIT TRAIL, INTEGRITY &amp; JURISDICTION
        </h3>
        <p className="leading-relaxed text-slate-700">
          The Portal maintains comprehensive audit logs of all RFQs, bids, quotations, order revisions, and payment references. These records constitute conclusive evidence for statutory compliance. This Policy is governed by the laws of India, subject to the exclusive jurisdiction of competent courts in Odisha.
        </p>
      </div>
    </div>
  );
}

/**
 * Official Legal Text: Order Cancellation, Withdrawal & Refund Policy
 * Extracted verbatim from /docs/Order_Cancellation_Refund_Policy.pdf
 */
export function CancellationRefundPolicyContent() {
  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">
      <div className="text-center border-b border-slate-200 pb-4 mb-4">
        <h2 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight">
          ORDER CANCELLATION, WITHDRAWAL &amp; REFUND POLICY
        </h2>
        <p className="mt-1 text-xs font-bold text-slate-500 uppercase tracking-wide">
          JSG SMILE – Jharsuguda Supplier &amp; MSME Integrated Local Exchange
        </p>
        <p className="text-xs font-semibold text-slate-500">Website: www.jsgsmile.in</p>
        <p className="text-[11px] font-semibold text-slate-400">Effective Date: Statutory Operational Release</p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          1. PURPOSE &amp; APPLICABILITY
        </h3>
        <p className="leading-relaxed text-slate-700">
          This Order Cancellation, Withdrawal &amp; Refund Policy (&ldquo;Policy&rdquo;) establishes the statutory rules governing cancellation of orders, withdrawal of quotations, termination of procurement transactions, and refund processing on JSG SMILE (www.jsgsmile.in).
        </p>
        <p className="mt-1.5 leading-relaxed text-slate-700">
          This Policy applies to all RFQs, Quotations, Purchase Orders, Service Orders, Work Orders, Deliveries, and Payment Transactions processed through JSG SMILE.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          2. CANCELLATION STAGES &amp; LIABILITIES
        </h3>
        <p className="leading-relaxed text-slate-700">Transactions may be cancelled at the following lifecycle stages:</p>
        <ul className="space-y-2 pl-2 my-2 text-xs">
          <li className="flex items-start gap-2">
            <span className="text-[#12335f] font-black shrink-0">Stage 1:</span>
            <span><strong>Before RFQ Publication:</strong> Buyer may freely modify or withdraw requirements without financial liability.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#12335f] font-black shrink-0">Stage 2:</span>
            <span><strong>After RFQ Publication, Before Order Placement:</strong> Buyer may withdraw RFQ. Suppliers may withdraw quotations before expiration without penalty.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#12335f] font-black shrink-0">Stage 3:</span>
            <span><strong>After Order Placement, Before Supplier Acceptance:</strong> Buyer may cancel or Supplier may decline; no binding supply commitment arises until acceptance.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#12335f] font-black shrink-0">Stage 4:</span>
            <span><strong>After Order Acceptance, Before Dispatch:</strong> Cancellation permitted only by mutual agreement and subject to agreed compensation for raw material or mobilization expenses.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#12335f] font-black shrink-0">Stage 5:</span>
            <span><strong>After Dispatch or Service Commencement:</strong> Cancellation is not automatic. Parties must mutually determine return logistics, compensation, and refund eligibility.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#12335f] font-black shrink-0">Stage 6:</span>
            <span><strong>After Delivery or Service Completion:</strong> Governed strictly by warranty terms, defect verification, and formal inspection reports.</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          3. BUYER &amp; SUPPLIER CANCELLATION RIGHTS
        </h3>
        <p className="leading-relaxed text-slate-700">
          <strong>Buyer Cancellation:</strong> Permitted when scope revisions occur, administrative approvals are withdrawn, or supplier defaults arise. The Buyer remains responsible for obligations already incurred under accepted orders.
        </p>
        <p className="mt-2 leading-relaxed text-slate-700">
          <strong>Supplier Cancellation:</strong> Permitted in cases of documented component unavailability, regulatory embargoes, or force majeure events. Supplier must promptly notify the Buyer through the Portal.
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          4. REFUND ELIGIBILITY &amp; TIMELINES
        </h3>
        <div className="grid gap-2 sm:grid-cols-2 my-2 text-xs">
          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
            <strong className="text-emerald-900 block font-bold mb-1">Eligible for Full / Pro-rata Refund</strong>
            <ul className="space-y-1 text-slate-700">
              <li>• Duplicate payments or gateway over-deductions</li>
              <li>• Technical transaction failures</li>
              <li>• Mutually agreed cancellation prior to dispatch</li>
              <li>• Supplier inability to deliver verified items</li>
            </ul>
          </div>
          <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50">
            <strong className="text-rose-900 block font-bold mb-1">Non-Eligible Scenarios</strong>
            <ul className="space-y-1 text-slate-700">
              <li>• Change of mind after delivery</li>
              <li>• Fully rendered and accepted services</li>
              <li>• Custom-manufactured or specialized BOQ items where production commenced</li>
            </ul>
          </div>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-600">
          Indicative Timelines: Failed Transactions (3–7 business days), Duplicate Payments (7–10 business days), Approved Cancellations (7–15 business days).
        </p>
      </div>

      <div>
        <h3 className="text-xs sm:text-sm font-black text-[#12335f] mt-4 mb-2 border-l-4 border-[#12335f] pl-3 uppercase tracking-wide">
          5. DISCLAIMER &amp; LIMITATION OF LIABILITY
        </h3>
        <p className="leading-relaxed text-slate-700">
          District Administration Jharsuguda, District Industries Centre (DIC), Government of Odisha, and the Portal Operator function solely as facilitators and do not determine cancellation penalties, adjudicate refund entitlement, or bear commercial liability. Maximum liability is NIL to the fullest extent permitted by Indian law.
        </p>
      </div>
    </div>
  );
}
