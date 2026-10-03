import type { ProcurementDetailUnifiedViewProps, DisplayDocument } from '../components/ProcurementDetailUnifiedView';
import { formatRefId } from '../../../utils/refIdUtils';
import { formatDate, formatDateTime } from '../../shared/format';

export interface AdapterContext {
  user: any;
  router: any;
  requestId: string | number;
  procurementType: 'RFQ' | 'RFP' | 'RATE_CONTRACT' | 'OPEN_TENDER' | 'LIMITED_TENDER' | string;
  procurementLabel?: string;
  backRouteLabel?: string;
  backRoute?: string;
  onRefresh?: () => void | Promise<void>;
  onCancel?: () => void;
  onSubmitAction?: () => void;
  onDownloadPdf?: () => void;
  onConvertToInvoice?: () => void;
  invoiceStatusData?: any;
  isConvertingInvoice?: boolean;
  extraProps?: Partial<ProcurementDetailUnifiedViewProps>;
}

function formatDateString(dateVal?: string | Date | null, includeTime: boolean = false): string | undefined {
  if (!dateVal) return undefined;
  const formatted = includeTime ? formatDateTime(dateVal) : formatDate(dateVal);
  return formatted === '—' ? String(dateVal) : formatted;
}

export function adaptProcurementUnifiedProps(
  bidInput: any,
  reqInput: any,
  ctx: AdapterContext
): ProcurementDetailUnifiedViewProps {
  const bid: any = bidInput || {};
  const reqObj: any = reqInput?.requirement || reqInput?.data?.requirement || reqInput?.data || reqInput || {};
  const user = ctx.user;
  const isBuyerOrAdmin = user?.role === 'buyer' || user?.role === 'admin';

  const payload = bid.technicalPacket || bid.payload || reqObj.technicalPacket || reqObj.payload || {};
  const basics = payload.basics || {};
  const schedule = payload.schedule || {};
  const terms = payload.terms || {};

  // Resolve ID & display number
  const targetId = bid.id || reqObj.id || ctx.requestId;
  const rawDisplayId =
    bid.bidNumber ||
    bid.rfqNumber ||
    bid.tenderNumber ||
    reqObj.requirementNumber ||
    bid.displayId ||
    reqObj.displayId ||
    (targetId ? formatRefId(targetId) : 'N/A');

  const title =
    bid.title ||
    bid.subject ||
    reqObj.title ||
    reqObj.subject ||
    basics.title ||
    basics.subject ||
    'Procurement Opportunity';

  const status = String(bid.status || reqObj.status || 'DRAFT').toUpperCase();

  // Buyer details
  const rawBuyerProfile = bid.buyer?.buyerProfile || reqObj.buyer?.buyerProfile || bid.buyerProfile || reqObj.buyerProfile;
  const resolvedBuyerProfile = rawBuyerProfile || bid.buyerOrganization || reqObj.buyerOrganization || reqObj.organization || {};
  const contactPerson =
    bid.contactPerson ||
    bid.buyerName ||
    reqObj.contactPerson ||
    reqObj.buyerName ||
    resolvedBuyerProfile?.representativeName ||
    resolvedBuyerProfile?.contactPerson ||
    bid.buyer?.name ||
    reqObj.buyer?.name ||
    '—';

  const orgName =
    bid.orgName ||
    bid.buyerOrganization?.name ||
    reqObj.orgName ||
    reqObj.organizationName ||
    resolvedBuyerProfile?.organizationName ||
    resolvedBuyerProfile?.name ||
    '—';

  const buyerEmail =
    bid.buyerEmail ||
    reqObj.buyerEmail ||
    bid.buyer?.email ||
    reqObj.buyer?.email ||
    resolvedBuyerProfile?.email ||
    '';

  const buyerMobile =
    bid.buyerMobile ||
    reqObj.buyerMobile ||
    bid.buyer?.mobile ||
    reqObj.buyer?.mobile ||
    resolvedBuyerProfile?.mobile ||
    resolvedBuyerProfile?.phone ||
    '';

  const buyerAddress =
    bid.buyerAddress ||
    reqObj.buyerAddress ||
    resolvedBuyerProfile?.registeredAddress ||
    resolvedBuyerProfile?.address ||
    '';

  // Participations
  const participationsList: any[] =
    bid.participations ||
    bid.proposals ||
    bid.vendorResponses ||
    reqObj.participations ||
    reqObj.proposals ||
    [];

  const ownParticipation = participationsList.find(
    (p: any) =>
      p.sellerId === user?.organizationId ||
      p.sellerId === user?.id ||
      p.sellerOrgId === user?.organizationId
  ) || bid.ownParticipation || reqObj.ownParticipation;

  const ownResponse = ownParticipation || bid.ownResponse || reqObj.ownResponse;
  const hasSubmittedProposal = Boolean(ownParticipation || ownResponse || bid.hasSubmittedProposal || reqObj.hasSubmittedProposal);

  // Financial & Dates
  const estimatedValue =
    bid.estimatedValue ??
    reqObj.estimatedValue ??
    basics.estimatedValue ??
    reqObj.estimatedBudget ??
    0;

  const discloseEstimatedCost = Boolean(
    bid.discloseEstimatedCost ??
    reqObj.discloseEstimatedCost ??
    payload.discloseEstimatedCost ??
    basics.discloseEstimatedCost ??
    false
  );

  const deadline =
    schedule.submissionDate ||
    schedule.submissionDeadline ||
    bid.deadlineDate ||
    bid.submissionEndDate ||
    bid.rawEndDate ||
    bid.endDate ||
    reqObj.lastDate ||
    reqObj.submissionDeadline;

  const publishedDate = (() => {
    const rawPub = schedule.publishDate || schedule.publishedDate || bid.publishedAt || reqObj.publishedAt;
    if (rawPub) return formatDateString(rawPub, true);
    return formatDateString(reqObj.approvedAt || bid.approvedAt || reqObj.createdAt || bid.createdAt || bid.startDate);
  })();

  const items = bid.items || payload.items || reqObj.items || payload.boqTable || reqObj.payload?.items || [];
  const documents: DisplayDocument[] =
    bid.documents ||
    bid.bidDocuments ||
    reqObj.documents ||
    payload.documents ||
    [];

  return {
    procurementType: ctx.procurementType,
    procurementLabel: ctx.procurementLabel,
    backRouteLabel: ctx.backRouteLabel || (isBuyerOrAdmin ? 'My Procurements' : 'Opportunities'),
    backRoute: ctx.backRoute || (isBuyerOrAdmin ? '/buyer/my-procurements' : '/seller/opportunities'),
    id: targetId,
    displayId: rawDisplayId,
    subject: title,
    title,
    status,
    rawBid: bid,

    // Buyer Information
    buyerName: contactPerson,
    contactPerson,
    orgName,
    buyerEmail,
    buyerMobile,
    buyerAddress,
    department: resolvedBuyerProfile?.department || bid.department || reqObj.department,
    buyer: {
      name: contactPerson,
      email: buyerEmail,
      mobile: buyerMobile,
      buyerProfile: {
        ...resolvedBuyerProfile,
        organizationName: orgName,
        representativeName: contactPerson,
        contactPerson,
        email: buyerEmail,
        mobile: buyerMobile,
        phone: buyerMobile,
        registeredAddress: buyerAddress,
        address: buyerAddress,
        department: resolvedBuyerProfile?.department || bid.department || reqObj.department,
      },
    },

    // Commercial & Scope
    estimatedValue,
    discloseEstimatedCost,
    urgency: bid.urgency || reqObj.urgency || basics.urgency || 'MEDIUM',
    category: bid.category?.name || bid.category || reqObj.category?.name || basics.category || 'Goods / Products',
    procurementMethod: ctx.procurementLabel || 'Procurement',
    buyingType: basics.buyingType || bid.buyingType || reqObj.buyingType || 'Goods / Products',
    deliveryLocation: bid.deliveryLocation || bid.location || reqObj.location || basics.deliveryLocation || '—',
    paymentTerms: bid.paymentTerms || terms.paymentTerms || reqObj.paymentTerms,
    deliveryTerms: bid.deliveryTerms || terms.deliveryTerms || reqObj.deliveryTerms,
    description: bid.description || reqObj.description || basics.description || '',

    // Key Dates
    deadlineDate: deadline,
    createdAt: reqObj.createdAt || bid.createdAt,
    publishedDate,
    submissionStartDate: formatDateString(schedule.submissionStartDate || schedule.startDate || reqObj.startDate, true),
    closingDate: formatDateString(deadline, true),
    clarificationDate: formatDateString(schedule.clarificationDate || reqObj.clarificationDeadline || deadline, true),
    technicalDate: formatDateString(bid.technicalOpeningDate || schedule.technicalOpeningDate, true),
    financialDate: formatDateString(bid.financialOpeningDate || schedule.financialOpeningDate, true),
    bidValidityDate: formatDateString(bid.bidValidityDate || schedule.bidValidityDate || terms.bidValidityDate),
    packetType: schedule.packetType || bid.packetType || payload.packetType || (bid.financialOpeningDate ? 'Two Packet' : 'Single Packet'),

    // Documents & Items
    documents,
    items,
    boqTable: payload.boqTable || reqObj.payload?.boqTable,
    payload,
    approvalAuthority: bid.approvalAuthority || payload.internal?.approvalAuthority || payload.approvalAuthority,
    justification: bid.justification || payload.internal?.justification || payload.limitedTenderJustification || basics.justification,
    internalDetails: bid.internalDetails || payload.internal,

    // Participation
    participations: participationsList,
    participantsCount: bid.participantsCount ?? participationsList.length,
    hasSubmittedProposal,
    ownParticipation,
    ownResponse,
    awards: bid.awards || reqObj.awards || [],
    purchaseOrders: bid.purchaseOrders || reqObj.purchaseOrders || [],
    activeOrder: bid.activeOrder || reqObj.activeOrder || null,
    lifecycleStage: bid.lifecycleStage || reqObj.lifecycleStage,
    linkedAuction: bid.linkedAuction || null,

    // Actions & Handlers
    onBack: () => ctx.router.push(ctx.backRoute || (isBuyerOrAdmin ? '/buyer/my-procurements' : '/seller/opportunities')),
    onRefresh: ctx.onRefresh,
    onCancelClick: ctx.onCancel,
    cancelButtonLabel: status === 'DRAFT' || status === 'SUBMITTED' ? 'Withdraw' : 'Cancel',
    submitButtonLabel: isBuyerOrAdmin ? 'View Evaluation & Results' : (hasSubmittedProposal ? 'Proposal Submitted' : 'Submit Proposal'),
    onSubmitClick: ctx.onSubmitAction,
    onDownloadClick: ctx.onDownloadPdf,

    // Invoicing
    invoiceStatus: ctx.invoiceStatusData,
    isConvertingInvoice: ctx.isConvertingInvoice,
    onConvertToInvoiceClick: ctx.onConvertToInvoice,

    ...ctx.extraProps,
  };
}
