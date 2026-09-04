'use client';

import React, { useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { formatRefId } from '../../../utils/refIdUtils';
import {
  ChevronRight,
  Loader2,
  Building2,
  Calendar,
  FileText,
  Upload,
  CheckCircle2,
  IndianRupee,
  AlertTriangle,
  ArrowLeft,
  Clock,
  ShieldCheck,
  X,
  Paperclip,
  Package,
  FileUp,
  Eye,
  Trash2,
  AlertCircle,
  Circle
} from 'lucide-react';
import { toast } from 'sonner';
import { getApi, postApi } from '../../shared/apiClient';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { getCookieValue } from '../../../lib/auth';
import { BASE_URL } from '../../../lib/api';
import { EmdCard, EmdInfo, isEmdApplicable } from '../components/EmdCard';
import { EmdPaymentModal } from '../components/EmdPaymentModal';
import { DocumentPreviewModal } from '../../../components/DocumentPreviewModal';
import { getDocumentPreviewMode, type DocumentPreview } from '../../../lib/files';
import { parseQuoteRequestItems, cleanItemName } from '../utils/quoteItemParser';

const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const authHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const csrfToken = getCookieValue('csrfToken');
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  return headers;
};

const uploadFile = (file: File, onProgress?: (percent: number) => void): Promise<{ id: number; url: string }> =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entityType', 'quotation');

    xhr.open('POST', `${BASE_URL}/api/upload`, true);
    xhr.withCredentials = true;

    for (const [key, value] of Object.entries(authHeaders())) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress(Math.round((event.loaded / event.total) * 100));
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      let body: any = {};
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        if (body?.data) body = body.data;
      } catch {
        // ignore
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ id: body.id || body.fileAssetId, url: body.url || body.fileUrl || '' });
      } else {
        reject(new Error(body?.message || body?.error || `Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.onabort = () => reject(new Error('Upload aborted'));
    xhr.send(formData);
  });

const formatDate = (dateStr?: string | Date) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
};

const formatCurrency = (val?: number | string) => {
  if (!val) return '—';
  const n = Number(val);
  if (isNaN(n)) return String(val);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

type UploadState = {
  file?: File;
  fileName?: string;
  fileSize?: number;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  url?: string;
  error?: string;
};

// One upload slot per document the buyer asked for at procurement creation.
type RequestedDocUpload = {
  id?: string;
  name: string;
  required: boolean;
  fileAssetId?: number | null;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
  status: 'empty' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  taggedAs?: string;
  url?: string;
};

// Seller's quote against each buyer line item.
type LineQuote = {
  itemName: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: string;
  gstPercent: string;
  makeBrand: string;
  remarks: string;
};

const parseResponseData = (value: any) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
};

const firstPresent = (...values: any[]) =>
  values.find(value => value !== undefined && value !== null && value !== '');

const toArray = (value: any): any[] => Array.isArray(value) ? value : [];

const dedupeDocuments = (documents: any[]) => {
  const seen = new Set<string>();
  return documents.filter(doc => {
    const key = String(doc?.fileAssetId || doc?.id || doc?.fileUrl || doc?.url || doc?.fileName || doc?.name || '').trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const submittedStatus = (response: any) =>
  String(response?.status || response?.submissionStatus || response?.responseStatus || '').trim().toUpperCase();

const isFinalSubmittedResponse = (response: any) => {
  const status = submittedStatus(response);
  return Boolean(response) && status !== '' && status !== 'DRAFT';
};

const fileNameFromUrl = (url?: string) => {
  if (!url) return '';
  const parts = String(url).split('/');
  return decodeURIComponent(parts[parts.length - 1] || '').trim();
};

const findSupportingAttachment = (response: any, documents: any[]) => {
  const responseData = response?.responseData || {};
  const explicitUrl = firstPresent(
    response?.attachmentUrl,
    responseData?.attachmentUrl,
    responseData?.supportingDocument?.fileUrl,
    responseData?.supportingDocument?.url
  );
  if (explicitUrl) {
    return {
      fileName: firstPresent(responseData?.supportingDocument?.fileName, fileNameFromUrl(explicitUrl), 'Attachment'),
      fileUrl: explicitUrl,
      fileSize: responseData?.supportingDocument?.fileSize
    };
  }

  return documents.find(doc => {
    const label = String(doc?.documentName || doc?.documentType || doc?.fileName || doc?.name || '').toLowerCase();
    return String(doc?.id || '').startsWith('att-') || label.includes('quote attachment') || label.includes('quotation attachment') || label.includes('supporting');
  });
};

const normalizeOwnResponse = (raw: any) => {
  if (!raw) return null;
  const responseData = parseResponseData(raw.responseData || raw.acknowledgement);
  const documents = dedupeDocuments([
    ...toArray(responseData.documents),
    ...toArray(responseData.requestedDocuments),
    ...toArray(raw.documents),
    ...toArray(raw.requestedDocuments)
  ]);
  const lineItems = toArray(responseData.lineItems).length
    ? toArray(responseData.lineItems)
    : toArray(responseData.lineQuotes).length
    ? toArray(responseData.lineQuotes)
    : toArray(raw.lineItems).length
    ? toArray(raw.lineItems)
    : toArray(raw.lineQuotes);
  const status = raw.status || raw.submissionStatus || responseData.status || 'SUBMITTED';
  const supportingAttachment = findSupportingAttachment({ ...raw, responseData }, documents);

  return {
    ...raw,
    status,
    submissionStatus: raw.submissionStatus || status,
    responseData: {
      ...responseData,
      documents,
      lineItems
    },
    offeredPrice: firstPresent(raw.offeredPrice, responseData.offeredPrice, raw.quotedAmount, raw.totalAmount, responseData.quotedAmount, responseData.totalAmount),
    offeredQuantity: firstPresent(raw.offeredQuantity, responseData.offeredQuantity, responseData.quantity),
    deliveryTimeline: firstPresent(raw.deliveryTimeline, responseData.deliveryTimeline),
    terms: firstPresent(raw.terms, responseData.terms),
    message: firstPresent(raw.message, responseData.message, raw.coverNote, responseData.coverNote, raw.offeredItemDescription),
    attachmentUrl: firstPresent(raw.attachmentUrl, responseData.attachmentUrl, supportingAttachment?.fileUrl, supportingAttachment?.url),
    attachmentFileName: firstPresent(supportingAttachment?.fileName, supportingAttachment?.name),
    attachmentFileSize: supportingAttachment?.fileSize,
    documents,
    lineItems
  };
};

const findSellerParticipation = (bidData: any, user: any) => {
  const participations = [
    ...toArray(bidData?.participations),
    ...toArray(bidData?.results),
    ...toArray(bidData?.quoteResponses)
  ];
  return participations.find((p: any) => {
    const sellerId = p.sellerId || p.seller?.id || p.sellerUserId;
    const orgId = p.organizationId || p.sellerOrganizationId || p.seller?.organizationId || p.seller?.organization?.id;
    return String(sellerId || '') === String(user?.id || '') ||
      (user?.organizationId && String(orgId || '') === String(user.organizationId));
  });
};

const participationToOwnResponse = (participation: any) => {
  if (!participation) return null;
  const responseData = parseResponseData(participation.responseData || participation.acknowledgement);
  const documents = dedupeDocuments([
    ...toArray(responseData.documents),
    ...toArray(responseData.requestedDocuments),
    ...toArray(participation.documents)
  ]);
  const supportingAttachment = findSupportingAttachment({ ...participation, responseData }, documents);

  return normalizeOwnResponse({
    id: participation.id,
    status: participation.status || participation.submissionStatus || 'SUBMITTED',
    submissionStatus: participation.submissionStatus || participation.status || 'SUBMITTED',
    offeredPrice: firstPresent(participation.offeredPrice, participation.quotedAmount, participation.totalAmount, responseData.offeredPrice),
    offeredQuantity: firstPresent(participation.offeredQuantity, responseData.offeredQuantity),
    deliveryTimeline: firstPresent(participation.deliveryTimeline, responseData.deliveryTimeline),
    terms: firstPresent(participation.terms, responseData.terms),
    message: firstPresent(participation.message, responseData.message, participation.coverNote, responseData.coverNote, participation.offeredItemDescription),
    attachmentUrl: firstPresent(participation.attachmentUrl, responseData.attachmentUrl, supportingAttachment?.fileUrl, supportingAttachment?.url),
    createdAt: participation.submittedAt || participation.createdAt,
    updatedAt: participation.updatedAt || participation.submittedAt || participation.createdAt,
    submittedAt: participation.submittedAt || participation.createdAt,
    responseData: {
      ...responseData,
      documents,
      lineItems: toArray(participation.lineItems).length ? toArray(participation.lineItems) : toArray(responseData.lineItems),
      lineQuotes: toArray(responseData.lineQuotes)
    },
    documents,
    lineItems: toArray(participation.lineItems).length ? toArray(participation.lineItems) : toArray(responseData.lineItems)
  });
};

const chooseOwnResponse = (primary: any, fallback: any) => {
  const normalizedPrimary = normalizeOwnResponse(primary);
  const normalizedFallback = normalizeOwnResponse(fallback);
  if (isFinalSubmittedResponse(normalizedPrimary)) return normalizedPrimary;
  if (isFinalSubmittedResponse(normalizedFallback)) return normalizedFallback;
  return normalizedPrimary || normalizedFallback;
};

export default function SubmitQuotationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname() || (typeof window !== 'undefined' ? window.location.pathname : '');
  const { user } = useAuth();
  const conversationIdParam = searchParams?.get('conversationId');
  const quoteRequestIdParam = searchParams?.get('quoteRequestId');

  // Extract ID from pathname if not in searchParams (e.g. /seller/procurement/rfq/REQ-51952/respond or /bids/123/participate)
  const procRespondMatch = pathname.match(/^\/(?:seller|shg|buyer)\/procurement\/(?:rfq|rfp|open-tender|limited-tender|rate-contract)\/([^/]+)\/respond/i);
  const bidParticipateMatch = pathname.match(/^\/bids\/([^/]+)\/participate/i);
  const pathTokens = pathname.split('/').filter(Boolean);
  const respondIdx = pathTokens.indexOf('respond');
  const participateIdx = pathTokens.indexOf('participate');
  const fallbackPathId = respondIdx > 0 ? pathTokens[respondIdx - 1] : (participateIdx > 0 ? pathTokens[participateIdx - 1] : '');

  const extractedPathId = procRespondMatch
    ? decodeURIComponent(procRespondMatch[1])
    : (bidParticipateMatch ? decodeURIComponent(bidParticipateMatch[1]) : (fallbackPathId ? decodeURIComponent(fallbackPathId) : ''));

  const requirementIdParam = searchParams?.get('requirementId') || searchParams?.get('id') || searchParams?.get('requestId') || searchParams?.get('bidId') || searchParams?.get('rfqId') || extractedPathId;
  const isMarketplaceQuoteFlow = Boolean(conversationIdParam);
  const requirementId = isMarketplaceQuoteFlow
    ? 0
    : (requirementIdParam ? (isNaN(Number(requirementIdParam)) ? requirementIdParam : Number(requirementIdParam)) : 0);
  const conversationId = conversationIdParam ? Number(conversationIdParam) : 0;

  const [offeredPrice, setOfferedPrice] = useState('');
  const [offeredQuantity, setOfferedQuantity] = useState('');
  const [deliveryTimeline, setDeliveryTimeline] = useState('');
  const [message, setMessage] = useState('');
  const [terms, setTerms] = useState('');
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState | null>(null);
  const [docUploads, setDocUploads] = useState<RequestedDocUpload[]>([]);
  const [lineQuotes, setLineQuotes] = useState<LineQuote[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isEmdModalOpen, setIsEmdModalOpen] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<DocumentPreview | null>(null);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const { data: queryData, isLoading, error } = useQuery({
    queryKey: ['marketplace-requirement-quotation', isMarketplaceQuoteFlow ? `conv-${conversationId}` : requirementId, user?.id, user?.organizationId],
    queryFn: async () => {
      // 1. Marketplace Product Conversation Flow
      if (isMarketplaceQuoteFlow && conversationId) {
        try {
          const conv = await getApi<any>(`/api/conversations/${conversationId}`);
          if (conv) {
            const rawSubject = String(conv.subject || '');
            const cleanedTitle = cleanItemName(rawSubject) || 'Requested Product';

            const buyerOrgName = conv.buyer?.buyerProfile?.organizationName ||
              conv.buyer?.company?.name ||
              conv.buyer?.organization?.organizationName ||
              conv.buyer?.name ||
              'Buyer Organization';

            const firstMsg = conv.messages?.find((m: any) => m.senderId !== Number(user?.id))?.content || conv.messages?.[0]?.content || '';
            const existingQuote = conv.quoteRequest?.quoteResponses?.find((r: any) => r.sellerId === Number(user?.id)) || conv.quoteRequest?.quoteResponses?.[0];

            const parsedItems = parseQuoteRequestItems(conv.subject, firstMsg || conv.quoteRequest?.message);

            return {
              requirement: {
                id: `conv-${conv.id}`,
                conversationId: conv.id,
                quoteRequestId: conv.quoteRequest?.id || (quoteRequestIdParam ? Number(quoteRequestIdParam) : undefined),
                isMarketplaceQuote: true,
                isQuoteRequestEntity: true,
                title: `Quotation for ${cleanedTitle}`,
                subject: conv.subject,
                description: firstMsg,
                estimatedValue: conv.quoteRequest?.estimatedValue || undefined,
                buyerOrganization: { organizationName: buyerOrgName },
                items: parsedItems.length > 0 ? parsedItems : [{
                  itemName: cleanedTitle,
                  quantity: 1,
                  unitOfMeasure: 'Nos',
                  description: firstMsg
                }],
                requiredDocuments: ['GST Certificate', 'Detailed Price Breakup'],
                documents: []
              },
              ownResponse: existingQuote ? normalizeOwnResponse({
                id: existingQuote.id,
                status: existingQuote.status,
                offeredPrice: existingQuote.totalAmount,
                deliveryTimeline: existingQuote.deliveryDays ? `${existingQuote.deliveryDays} Days` : '',
                terms: existingQuote.notes || '',
                message: existingQuote.notes || '',
                attachmentUrl: existingQuote.documentUrl
              }) : null
            };
          }
        } catch (convErr) {
          console.error('Failed to load marketplace quote conversation:', convErr);
        }
      }

      // 2. Standard RFQ Marketplace Requirements Flow
      let marketplaceResult: { requirement: any; ownResponse: any } | null = null;
      try {
        const data = await getApi<any>(`/api/marketplace/requirements/${requirementId}`);
        if (data && (data.requirement || data.id)) {
          marketplaceResult = {
            requirement: data.requirement || data,
            ownResponse: normalizeOwnResponse(data.ownResponse || data.myResponse || data.response || null),
          };
        }
      } catch (err) {
        // Fallback to procurement bid endpoint if marketplace requirement route fails
      }

      // 3. Procurement Bid Flow
      let bidResult: { requirement: any; ownResponse: any } | null = null;
      try {
        const bidData = await getApi<any>(`/api/procurement-bids/${encodeURIComponent(String(requirementId))}`);
        if (bidData) {
          const userParticipation = findSellerParticipation(bidData, user);
          const ownResponseData = participationToOwnResponse(userParticipation);

          bidResult = {
            requirement: {
              id: bidData.bidNumber || bidData.id || requirementId,
              procurementBidId: bidData.id,
              procurementBidNumber: bidData.bidNumber,
              sourceId: bidData.sourceId,
              sourceModel: bidData.sourceModel,
              procurementType: bidData.procurementType,
              procurementMethod: bidData.procurementMethod,
              bidType: bidData.bidType || bidData.procurementType,
              type: bidData.type || bidData.procurementType,
              sourcingMethod: bidData.sourcingMethod,
              title: bidData.title,
              requirementNumber: bidData.bidNumber || bidData.id,
              buyerOrganization: bidData.buyerOrganization || { organizationName: bidData.buyerName },
              lastDate: bidData.endDate,
              items: [
                bidData.technicalPacket?.boqTable,
                bidData.technicalPacket?.items,
                bidData.technicalPacket?.boq,
                bidData.technicalPacket?.wizardData?.boqTable,
                bidData.technicalPacket?.wizardData?.items,
                bidData.payload?.boqTable,
                bidData.payload?.items,
                bidData.payload?.boq,
                bidData.payload?.wizardData?.boqTable,
                bidData.payload?.wizardData?.items,
                bidData.boqTable,
                bidData.items,
              ].reduce((best: any[], cand: any) => (Array.isArray(cand) && cand.length > best.length ? cand : best), []),
              documents: bidData.documents || [],
              payload: bidData.technicalPacket || bidData.payload,
              requiredDocuments: bidData.requiredDocuments,
              estimatedValue: bidData.estimatedValue,
              quantity: bidData.quantity,
              unit: bidData.unit,
              status: bidData.status,
              description: bidData.description,
            },
            ownResponse: ownResponseData,
          };
        }
      } catch (e) {
        // Ignore fallback error
      }

      // 4. Quote Request Flow
      let quoteRequestResult: { requirement: any; ownResponse: any } | null = null;
      try {
        const quoteData = await getApi<any>(`/api/quote-requests/${requirementId}`);
        if (quoteData && (quoteData.id || quoteData.subject)) {
          const myResponse = Array.isArray(quoteData.quoteResponses)
            ? (quoteData.quoteResponses.find((r: any) => r.sellerId === Number(user?.id)) || quoteData.quoteResponses[0])
            : null;
          const parsedItems = parseQuoteRequestItems(quoteData.subject, quoteData.message);
          quoteRequestResult = {
            requirement: {
              id: quoteData.id,
              isQuoteRequestEntity: true,
              title: quoteData.subject,
              subject: quoteData.subject,
              description: quoteData.message,
              estimatedValue: quoteData.estimatedValue,
              buyerOrganization: quoteData.buyer?.buyerProfile?.organizationName ? { organizationName: quoteData.buyer.buyerProfile.organizationName } : { organizationName: quoteData.buyer?.name || 'Buyer' },
              items: parsedItems.length > 0 ? parsedItems : [{
                itemName: cleanItemName(quoteData.subject) || 'Requested Product/Service',
                quantity: 1,
                unitOfMeasure: 'Nos',
                description: quoteData.message || ''
              }],
              requiredDocuments: ['GST Certificate', 'Detailed Price Breakup'],
              documents: quoteData.requestDocAsset ? [quoteData.requestDocAsset] : []
            },
            ownResponse: myResponse ? normalizeOwnResponse({
              id: myResponse.id,
              status: myResponse.status,
              offeredPrice: myResponse.totalAmount,
              deliveryTimeline: myResponse.deliveryDays ? `${myResponse.deliveryDays} Days` : '',
              terms: myResponse.notes || '',
              message: myResponse.notes || '',
              attachmentUrl: myResponse.documentUrl
            }) : null
          };
        }
      } catch (err) {
        // Ignore fallback error
      }

      if (marketplaceResult || bidResult || quoteRequestResult) {
        return {
          requirement: marketplaceResult?.requirement || bidResult?.requirement || quoteRequestResult?.requirement,
          ownResponse: chooseOwnResponse(marketplaceResult?.ownResponse, chooseOwnResponse(bidResult?.ownResponse, quoteRequestResult?.ownResponse)),
        };
      }
      return null;
    },
    enabled: (isMarketplaceQuoteFlow && !!conversationId) || (!isMarketplaceQuoteFlow && !!requirementId),
  });

  const rfqData: any = queryData?.requirement
    ? {
        id: queryData.requirement.id,
        conversationId: queryData.requirement.conversationId,
        quoteRequestId: queryData.requirement.quoteRequestId,
        isMarketplaceQuote: queryData.requirement.isMarketplaceQuote,
        isQuoteRequestEntity: queryData.requirement.isQuoteRequestEntity,
        procurementType: queryData.requirement.procurementType || queryData.requirement.bidType,
        procurementMethod: queryData.requirement.procurementMethod,
        bidType: queryData.requirement.bidType,
        type: queryData.requirement.type,
        sourcingMethod: queryData.requirement.sourcingMethod,
        title: queryData.requirement.title || queryData.requirement.subject || (queryData.requirement.description && queryData.requirement.description.length < 80 && !queryData.requirement.description.includes('Sourcing Method:') ? queryData.requirement.description : undefined) || 'Sourcing Requirement',
        requirementNumber: queryData.requirement.requirementNumber,
        buyerOrganization: queryData.requirement.buyerOrganization,
        deadlineDate: queryData.requirement.lastDate,
        items: queryData.requirement.items || queryData.requirement.boqTable || queryData.requirement.payload?.items || queryData.requirement.payload?.boqTable || queryData.requirement.technicalPacket?.items || queryData.requirement.technicalPacket?.boqTable,
        boqTable: queryData.requirement.boqTable || queryData.requirement.payload?.boqTable || queryData.requirement.technicalPacket?.boqTable,
        documents: queryData.requirement.documents,
        payload: queryData.requirement.payload,
        technicalPacket: queryData.requirement.technicalPacket || queryData.requirement.payload?.technicalPacket,
        requiredDocuments: queryData.requirement.requiredDocuments,
        estimatedValue: queryData.requirement.estimatedValue || queryData.requirement.budgetMax,
        quantity: queryData.requirement.quantity,
        unit: queryData.requirement.unit,
        status: queryData.requirement.status,
        description: queryData.requirement.description,
      }
    : null;

  const ownResponse = React.useMemo(() => normalizeOwnResponse(queryData?.ownResponse), [queryData?.ownResponse]);

  const targetReqId = rfqData?.id || requirementId;

  const { data: emdRes, refetch: refetchEmd, isLoading: emdLoading } = useQuery({
    queryKey: ['emd-status', targetReqId, user?.id],
    queryFn: async () => {
      const r = await getApi<any>(`/api/emd/status?requirementId=${targetReqId ?? ''}`);
      return r?.data ?? r;
    },
    enabled: user?.role === 'seller' && !!targetReqId,
  });

  const emdInfo: EmdInfo | null = React.useMemo(() => {
    const payloadEmd = rfqData?.payload?.emd || rfqData?.payload?.technicalPacket?.emd || {};
    const isEmdReq = emdRes?.isEmdRequired ?? rfqData?.isEmdRequired ?? payloadEmd?.isEmdRequired ?? payloadEmd?.required ?? false;
    const amt = emdRes?.emdAmount ?? rfqData?.emdAmount ?? payloadEmd?.amount ?? payloadEmd?.emdAmount ?? 0;

    if (!isEmdReq || Number(amt) <= 0) return null;

    return {
      isEmdRequired: isEmdReq,
      emdAmount: Number(amt),
      paymentMethod: emdRes?.paymentMethod || payloadEmd?.paymentMethod || 'Online Escrow',
      paymentDeadline: emdRes?.paymentDeadline || payloadEmd?.deadline,
      refundPolicy: emdRes?.refundPolicy || payloadEmd?.refundPolicy || 'Refundable upon completion of evaluation',
      instructions: emdRes?.instructions || payloadEmd?.instructions || '',
      status: emdRes?.status || (emdRes?.payment ? 'PAID' : 'PENDING'),
      payment: emdRes?.payment || null,
    };
  }, [emdRes, rfqData]);

  const rawMethodStr = String(
    rfqData?.procurementType ||
    rfqData?.procurementMethod ||
    rfqData?.bidType ||
    rfqData?.type ||
    rfqData?.sourcingMethod ||
    rfqData?.payload?.basics?.procurementMethod ||
    rfqData?.payload?.basics?.sourcingMethod ||
    rfqData?.payload?.sourcingMethod ||
    queryData?.requirement?.procurementType ||
    queryData?.requirement?.procurementMethod ||
    queryData?.requirement?.bidType ||
    queryData?.requirement?.type ||
    ''
  ).toUpperCase();

  const isRateContract =
    rawMethodStr.includes('RATE_CONTRACT') ||
    rawMethodStr.includes('RATE-CONTRACT') ||
    rawMethodStr === 'RATE CONTRACT' ||
    rawMethodStr.includes('RATE') ||
    rfqData?.title?.toLowerCase().includes('rate contract') ||
    rfqData?.title?.toLowerCase().includes('rate') ||
    (typeof window !== 'undefined' && window.location.pathname.includes('rate-contract'));

  const isLimitedTender = !isRateContract && (rawMethodStr.includes('LIMITED') || rawMethodStr === 'LIMITED_TENDER');

  const isRfp = !isLimitedTender && !isRateContract && (
    rawMethodStr.includes('RFP') ||
    rawMethodStr.includes('PROPOSAL') ||
    rfqData?.title?.toLowerCase().includes('rfp') ||
    (typeof window !== 'undefined' && (window.location.pathname.includes('rfp') || window.location.pathname.includes('participate')) && !rawMethodStr)
  );

  const isOpenTender = !isLimitedTender && !isRateContract && !isRfp && (
    rawMethodStr.includes('TENDER') ||
    rawMethodStr.includes('OPEN') ||
    rawMethodStr.includes('BID')
  );

  const procurementType = isRateContract ? 'RATE_CONTRACT'
    : isLimitedTender ? 'LIMITED_TENDER'
    : isOpenTender ? 'OPEN_TENDER'
    : isRfp ? 'RFP'
    : 'RFQ';

  const isEmdActive = isEmdApplicable(procurementType, emdInfo?.isEmdRequired, emdInfo?.emdAmount);
  const isEmdPaid = !isEmdActive || emdInfo?.status === 'PAID' || emdInfo?.status === 'VERIFIED';

  // Restore quotation details from ownResponse on load (whether DRAFT or SUBMITTED)
  const restoredResponseIdRef = useRef<any>(null);
  React.useEffect(() => {
    if (!ownResponse) return;
    const ownRespId = ownResponse.id || ownResponse.submittedAt || ownResponse.updatedAt || ownResponse.createdAt;
    if (restoredResponseIdRef.current === ownRespId) return;
    restoredResponseIdRef.current = ownRespId;
    
    const targetPrice = ownResponse.offeredPrice ?? ownResponse.responseData?.offeredPrice;
    const targetQty = ownResponse.offeredQuantity ?? ownResponse.responseData?.offeredQuantity;
    const targetTimeline = ownResponse.deliveryTimeline || ownResponse.responseData?.deliveryTimeline;
    const targetTerms = ownResponse.terms || ownResponse.responseData?.terms;
    const targetMessage = ownResponse.message || ownResponse.responseData?.message || ownResponse.coverNote || ownResponse.responseData?.coverNote;
    const targetAttachment = ownResponse.attachmentUrl || ownResponse.responseData?.attachmentUrl;

    setOfferedPrice(targetPrice != null ? String(targetPrice) : '');
    setOfferedQuantity(targetQty != null ? String(targetQty) : '');
    setDeliveryTimeline(targetTimeline != null ? String(targetTimeline) : '');
    setTerms(targetTerms != null ? String(targetTerms) : '');
    setMessage(targetMessage != null ? String(targetMessage) : '');
    if (targetAttachment) {
      setUploadState({
        fileName: ownResponse.attachmentFileName || fileNameFromUrl(String(targetAttachment)) || 'Attachment',
        fileSize: ownResponse.attachmentFileSize,
        progress: 100,
        status: 'done',
        url: targetAttachment
      });
    } else {
      setUploadState(null);
    }
    
    const savedAt = ownResponse.submittedAt || ownResponse.updatedAt || ownResponse.createdAt;
    if (savedAt) {
      const savedTime = new Date(savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setLastSaved(savedTime);
    }

    const keysToCheck = Array.from(new Set([requirementId, targetReqId, searchParams?.get('requestId'), searchParams?.get('id'), searchParams?.get('requirementId')].filter(Boolean)));
    const hasLocalSubmission = typeof window !== 'undefined' && keysToCheck.some(k => Boolean(localStorage.getItem(`rfq_submitted_${k}`)));

    if (isFinalSubmittedResponse(ownResponse) || hasLocalSubmission) {
      setSubmitted(true);
      setDeclared(true);
      toast.info('Loaded your submitted quotation from the server.');
    } else if (submittedStatus(ownResponse) === 'DRAFT') {
      setSubmitted(false);
      toast.info('Restored your draft quotation from the server.');
    }
  }, [ownResponse, requirementId, targetReqId, searchParams]);

  // Use the canonical token from fetched data; RFQ bid numbers are resolved server-side.
  const resolvedId = isMarketplaceQuoteFlow ? (conversationId || rfqData?.conversationId) : (rfqData?.id || requirementId);

  // Save draft to database
  const saveDraft = useCallback(async () => {
    if (!resolvedId || isMarketplaceQuoteFlow) return;
    try {
      const payload: any = {
        offeredPrice: offeredPrice ? Number(offeredPrice) : undefined,
        offeredQuantity: offeredQuantity ? Number(offeredQuantity) : undefined,
        deliveryTimeline: deliveryTimeline.trim() || undefined,
        message: message.trim() || 'Draft quotation response', // default placeholder
        terms: terms.trim() || undefined,
        status: 'DRAFT'
      };
      if (uploadState?.url) {
        payload.attachmentUrl = uploadState.url;
      }
      const responseData = buildResponseData();
      if (responseData) payload.responseData = responseData;

      await postApi(`/api/marketplace/requirements/${resolvedId}/responses`, payload);
      
      const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSaved(now);
      setDraftSaved(true);
      toast.success('Draft saved successfully');
      setTimeout(() => setDraftSaved(false), 2000);
    } catch (err: any) {
      console.warn('Failed to save draft to server', err);
      toast.error(err?.message || 'Failed to save draft to server');
    }
  }, [resolvedId, isMarketplaceQuoteFlow, offeredPrice, offeredQuantity, deliveryTimeline, terms, message, uploadState, docUploads, lineQuotes]);

  const isSubmittedQuote = submitted || isFinalSubmittedResponse(ownResponse);
  const isClosed = ['AWARDED', 'CLOSED', 'CANCELLED'].includes(rfqData?.status);
  const isDeadlinePassed = !isMarketplaceQuoteFlow && !!rfqData?.deadlineDate && new Date(rfqData.deadlineDate).getTime() < Date.now();
  const isReadOnly = isClosed || isDeadlinePassed || isSubmittedQuote;

  const procurementTypeBadgeLabel = isMarketplaceQuoteFlow ? 'Product Quotation'
    : isLimitedTender ? 'Limited Tender'
    : isOpenTender ? 'Open Tender'
    : isRateContract ? 'Rate Contract'
    : isRfp ? 'RFP'
    : 'RFQ';

  const procurementTypePluralLabel = isMarketplaceQuoteFlow ? 'Messages & Quotes'
    : isLimitedTender ? 'Limited Tenders'
    : isOpenTender ? 'Open Tenders'
    : isRateContract ? 'Rate Contracts'
    : isRfp ? 'RFPs'
    : 'RFQs';

  const procurementBackRoute = isMarketplaceQuoteFlow ? `/seller/messages?conversationId=${conversationId}`
    : isLimitedTender ? '/seller/opportunities/invitations'
    : isOpenTender ? '/seller/opportunities/open-tenders'
    : isRateContract ? '/seller/opportunities/rate-contracts'
    : isRfp ? '/seller/opportunities/rfps'
    : '/seller/opportunities/rfqs';

  const submitActionHeaderLabel = isSubmittedQuote
    ? (isMarketplaceQuoteFlow ? 'Submitted Product Quotation' : isRfp ? 'Submitted Proposal' : isRateContract ? 'Submitted Rate Quotation' : isOpenTender ? 'Submitted Quotation' : 'Submitted Quotation')
    : (isMarketplaceQuoteFlow ? 'Submit Product Quotation' : isRfp ? 'Submit Proposal' : isRateContract ? 'Submit Rate Quotation' : isOpenTender ? 'Submit Quotation' : 'Submit Quotation');

  const backButtonLabelText = isMarketplaceQuoteFlow ? 'Back to Conversation'
    : isRfp ? 'Back to RFP'
    : isRateContract ? 'Back to Rate Contract'
    : isOpenTender ? 'Back to Open Tender'
    : isLimitedTender ? 'Back to Limited Tender'
    : 'Back to RFQ';

  // Auto-save on field changes (debounced at 5 seconds)
  React.useEffect(() => {
    if (!resolvedId || isReadOnly || !rfqData) return;
    const hasDynamicInput = docUploads.some(doc => doc.status === 'done') || lineQuotes.some(line => line.unitPrice !== '');
    if (!offeredPrice && !offeredQuantity && !deliveryTimeline && !terms && !message && !uploadState && !hasDynamicInput) {
      return;
    }

    const timer = setTimeout(() => {
      saveDraft();
    }, 5000);
    return () => clearTimeout(timer);
  }, [offeredPrice, offeredQuantity, deliveryTimeline, terms, message, uploadState, docUploads, lineQuotes, resolvedId, rfqData, saveDraft, ownResponse]);

  const orgName = rfqData?.buyerOrganization?.organizationName || 'Buyer';
  const subject = rfqData?.title || 'Sourcing Requirement';
  const rfqNumber = formatRefId('REQ', requirementId || rfqData?.id, rfqData?.requirementNumber);
  const deadline = rfqData?.deadlineDate ? formatDate(rfqData.deadlineDate) : '—';

  const itemsList: Array<{
    itemName: string;
    quantity: number | string;
    unitOfMeasure: string;
    description?: string;
  }> = React.useMemo(() => {
    const candidateArrays = [
      rfqData?.payload?.boqTable,
      rfqData?.payload?.items,
      rfqData?.payload?.boq,
      rfqData?.payload?.itemsList,
      rfqData?.payload?.lineItems,
      rfqData?.payload?.products,
      rfqData?.payload?.wizardData?.boqTable,
      rfqData?.payload?.wizardData?.items,
      rfqData?.payload?.rateContractConfig?.itemRateSchedule,
      rfqData?.payload?.technicalPacket?.boqTable,
      rfqData?.payload?.technicalPacket?.items,
      rfqData?.payload?.technicalPacket?.wizardData?.boqTable,
      rfqData?.payload?.technicalPacket?.wizardData?.items,
      rfqData?.payload?.technicalPacket?.rateContractConfig?.itemRateSchedule,
      rfqData?.technicalPacket?.boqTable,
      rfqData?.technicalPacket?.items,
      rfqData?.technicalPacket?.boq,
      rfqData?.technicalPacket?.wizardData?.boqTable,
      rfqData?.technicalPacket?.wizardData?.items,
      rfqData?.boqTable,
      rfqData?.items,
      rfqData?.lineItems,
      rfqData?.products,
      queryData?.requirement?.items,
      queryData?.requirement?.boqTable,
      queryData?.requirement?.payload?.items,
      queryData?.requirement?.payload?.boqTable,
      queryData?.requirement?.technicalPacket?.items,
      queryData?.requirement?.technicalPacket?.boqTable,
    ];

    let rawItems: any[] = [];
    for (const cand of candidateArrays) {
      if (Array.isArray(cand) && cand.length > rawItems.length) {
        rawItems = cand;
      }
    }

    const stripAutoDesc = (desc?: string): string => {
      if (!desc) return '';
      const str = String(desc).trim();
      if (str.includes('Sourcing Method:') && str.includes('Urgency:')) return '';
      return str;
    };

    const isGenericName = (val?: any): boolean => {
      if (!val) return true;
      const s = String(val).trim().toLowerCase();
      if (!s || s === 'n/a' || s === '—' || s === 'none' || s === 'null' || s === 'undefined') return true;
      if (s === 'general' || s === 'general procurement' || s === 'general sub-category' || s === 'default' || s === 'uncategorized' || s === 'item' || s === 'product' || s === 'requirement item' || s === 'sourcing requirement' || s === 'procurement item' || s === 'procurement product') return true;
      if (s.startsWith('item #') || s.startsWith('item-') || s.startsWith('product #') || s.startsWith('procurement #') || s.startsWith('procurement bid #') || s.startsWith('untitled procurement')) return true;
      return false;
    };

    let parsedList: any[] = [];
    if (rawItems.length > 0) {
      parsedList = rawItems.map((item: any, idx: number) => {
        if (typeof item === 'string' && item.trim() !== '') {
          return {
            itemName: item.trim(),
            quantity: rfqData?.quantity || 1,
            unitOfMeasure: rfqData?.unit || 'Nos',
            description: '',
          };
        }

        const specs = (item && typeof item === 'object' && item.specifications && typeof item.specifications === 'object') ? item.specifications : {};
        const cleanedDesc = stripAutoDesc(
          item?.description || item?.specification || specs?.description || item?.details || item?.remarks
        );

        // Explicit line item candidates (excluding category)
        const candidateNames = [
          item?.itemName,
          item?.name,
          item?.title,
          item?.productName,
          item?.itemDescription,
          specs?.itemName,
          specs?.name,
          specs?.title,
          item?.description,
          item?.specification,
          specs?.description,
          item?.details,
          item?.workDescription,
          item?.serviceName,
          item?.materialName,
          item?.boqItem,
          item?.particulars,
        ];

        let finalName = '';
        for (const cand of candidateNames) {
          if (cand && typeof cand === 'string' && cand.trim() !== '') {
            const trimmed = cleanItemName(cand.trim());
            if (trimmed && !isGenericName(trimmed) && !trimmed.includes('Sourcing Method:')) {
              finalName = trimmed;
              break;
            }
          }
        }

        // If line item didn't yield a non-generic product name, try the buyer's procurement title/subject
        if (!finalName) {
          const buyerTitles = [
            rfqData?.title,
            rfqData?.subject,
            queryData?.requirement?.title,
            queryData?.requirement?.subject,
            queryData?.requirement?.payload?.basics?.title,
            queryData?.requirement?.payload?.title,
            queryData?.requirement?.payload?.basics?.contractTitle,
            queryData?.requirement?.payload?.rateContractConfig?.contractTitle,
            queryData?.requirement?.technicalPacket?.basics?.title,
            queryData?.requirement?.technicalPacket?.title,
            rfqData?.payload?.basics?.title,
            rfqData?.payload?.title,
            rfqData?.technicalPacket?.basics?.title,
          ];

          for (const titleCand of buyerTitles) {
            if (titleCand && typeof titleCand === 'string' && titleCand.trim() !== '') {
              const trimmedTitle = cleanItemName(titleCand.trim());
              if (trimmedTitle && !isGenericName(trimmedTitle) && !trimmedTitle.includes('Sourcing Method:')) {
                finalName = rawItems.length > 1 ? `${trimmedTitle} (Item #${idx + 1})` : trimmedTitle;
                break;
              }
            }
          }
        }

        // If still no valid name, check category/subcategory if non-generic
        if (!finalName) {
          const catCandidates = [
            item?.category,
            rfqData?.category,
            queryData?.requirement?.category,
            rfqData?.subCategory,
            queryData?.requirement?.subCategory,
          ];
          for (const catCand of catCandidates) {
            const catStr = typeof catCand === 'string' ? catCand : catCand?.name;
            if (catStr && typeof catStr === 'string' && catStr.trim() !== '') {
              const trimmedCat = catStr.trim();
              if (!isGenericName(trimmedCat) && !trimmedCat.includes('Sourcing Method:')) {
                finalName = rawItems.length > 1 ? `${trimmedCat} (Item #${idx + 1})` : trimmedCat;
                break;
              }
            }
          }
        }

        // Last resort fallback
        if (!finalName) {
          finalName = `Item #${idx + 1}`;
        }

        return {
          itemName: finalName,
          quantity: item?.quantity || item?.qty || item?.count || item?.estimatedAnnualQuantity || item?.annualQuantity || item?.estimatedRateQuantity || rfqData?.quantity || 1,
          unitOfMeasure: item?.unitOfMeasure || item?.unit || item?.uom || item?.unitType || item?.uomName || specs?.unit || rfqData?.unit || 'Nos',
          description: cleanedDesc !== finalName ? cleanedDesc : '',
        };
      });
    } else if (rfqData || queryData?.requirement) {
      const cleanedReqDesc = stripAutoDesc(rfqData?.description || queryData?.requirement?.description);
      const titleCandidates = [
        rfqData?.title,
        rfqData?.subject,
        queryData?.requirement?.title,
        queryData?.requirement?.subject,
        queryData?.requirement?.payload?.basics?.title,
        queryData?.requirement?.payload?.title,
        queryData?.requirement?.payload?.basics?.contractTitle,
        queryData?.requirement?.technicalPacket?.basics?.title,
      ];

      let finalTitle = '';
      for (const t of titleCandidates) {
        if (t && typeof t === 'string' && t.trim() !== '') {
          const trimmed = t.trim();
          if (!isGenericName(trimmed) && !trimmed.includes('Sourcing Method:')) {
            finalTitle = trimmed;
            break;
          }
        }
      }

      if (!finalTitle && cleanedReqDesc && !isGenericName(cleanedReqDesc)) {
        finalTitle = cleanedReqDesc;
      }

      if (!finalTitle) {
        finalTitle = 'Requirement Item';
      }

      parsedList = [
        {
          itemName: finalTitle,
          quantity: rfqData?.quantity || queryData?.requirement?.quantity || 1,
          unitOfMeasure: rfqData?.unit || queryData?.requirement?.unit || 'Nos',
          description: cleanedReqDesc !== finalTitle ? cleanedReqDesc : '',
        }
      ];
    }

    // Deduplicate items by name, description, quantity, and unit
    const seen = new Set<string>();
    const result: any[] = [];
    for (const item of parsedList) {
      const key = `${String(item.itemName).trim().toLowerCase()}_${String(item.description || '').trim().toLowerCase()}_${item.quantity}_${String(item.unitOfMeasure).trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }, [rfqData, queryData]);

  const maxQuantity = itemsList.length > 0
    ? Math.max(...itemsList.map((i: any) => Number(i.quantity) || 0))
    : 0;

  const documents = Array.isArray(rfqData?.documents) ? rfqData?.documents : [];

  // Buyer-requested documents come from three shapes depending on how the procurement was
  // created: wizard payload.documents ({name, required}), marketplace requiredDocuments
  // (string[]), or attached requirement documents. Merge + dedupe by name.
  const requestedDocs = React.useMemo(() => {
    const out: Array<{ name: string; required: boolean }> = [];
    const seen = new Set<string>();
    const push = (name: unknown, required: boolean) => {
      const label = String(name || '').trim();
      const key = label.toLowerCase();
      if (!label || seen.has(key)) return;
      seen.add(key);
      out.push({ name: label, required });
    };
    const payloadDocs = rfqData?.payload?.documents || rfqData?.payload?.documentsRequested || rfqData?.payload?.technicalPacket?.documents;
    if (Array.isArray(payloadDocs)) payloadDocs.forEach((d: any) => push(typeof d === 'string' ? d : d?.name || d?.documentType || d?.documentName, typeof d === 'object' ? d?.required !== false : true));
    if (Array.isArray(rfqData?.requiredDocuments)) rfqData.requiredDocuments.forEach((d: any) => push(typeof d === 'string' ? d : d?.name, true));
    if (Array.isArray(rfqData?.requestedDocuments)) rfqData.requestedDocuments.forEach((d: any) => push(typeof d === 'string' ? d : d?.name, true));
    documents.forEach((d: any) => push(typeof d === 'string' ? d : d?.documentType || d?.name || d?.documentName, typeof d === 'object' ? d?.required === true : false));

    // Default standard requested documents if none explicitly provided
    if (out.length === 0 && rfqData) {
      push('GST Certificate', true);
      push('PAN Card', true);
      push('Bank Details', true);
      push('Technical Compliance Sheet', true);
      push('Detailed Price Breakup', true);
      push('Aadhar Card', true);
    }

    return out;
  }, [rfqData, documents]);

  // Initialise upload slots per requested document and quote rows per buyer line item
  const restoredLineQuotesKeyRef = useRef<any>(null);
  React.useEffect(() => {
    const currentId = rfqData?.id || requirementId;
    if (!rfqData || !currentId) return;

    const ownRespId = ownResponse?.id || (ownResponse ? 'present' : 'none');
    const restoreKey = `${currentId}_${ownRespId}`;
    if (restoredLineQuotesKeyRef.current === restoreKey) return;
    restoredLineQuotesKeyRef.current = restoreKey;

    const saved = ownResponse?.responseData || ownResponse || {};
    const savedDocs: any[] = Array.isArray(saved.documents)
      ? saved.documents
      : Array.isArray(saved.requestedDocuments)
      ? saved.requestedDocuments
      : Array.isArray(ownResponse?.documents)
      ? ownResponse.documents
      : Array.isArray(ownResponse?.responseData?.documents)
      ? ownResponse.responseData.documents
      : [];

    const savedLines: any[] = Array.isArray(saved.lineQuotes)
      ? saved.lineQuotes
      : Array.isArray(saved.lineItems)
      ? saved.lineItems
      : Array.isArray(ownResponse?.responseData?.lineQuotes)
      ? ownResponse.responseData.lineQuotes
      : Array.isArray(ownResponse?.responseData?.lineItems)
      ? ownResponse.responseData.lineItems
      : Array.isArray(ownResponse?.lineQuotes)
      ? ownResponse.lineQuotes
      : Array.isArray(ownResponse?.lineItems)
      ? ownResponse.lineItems
      : [];

    const restoreSaved = !!ownResponse;

    setDocUploads(requestedDocs.map((doc, idx) => {
      const match = restoreSaved
        ? (savedDocs.find(d => String(d?.name || d?.documentType || '').toLowerCase().trim() === doc.name.toLowerCase().trim()) || savedDocs[idx])
        : null;
      return match?.fileAssetId || match?.fileUrl || match?.url
        ? { ...doc, fileAssetId: match.fileAssetId || match.id, fileName: match.fileName || match.name || doc.name, fileUrl: match.fileUrl || match.url || '', status: 'done', progress: 100 }
        : { ...doc, status: 'empty', progress: 0 };
    }));

    setLineQuotes(itemsList.map((item, idx) => {
      const match = restoreSaved
        ? (savedLines.find(l => String(l?.itemName || l?.name || '').toLowerCase().trim() === String(item.itemName).toLowerCase().trim()) || savedLines[idx])
        : null;
      return {
        itemName: item.itemName,
        quantity: Number(item.quantity) || 0,
        unitOfMeasure: item.unitOfMeasure || 'Nos',
        unitPrice: match?.unitPrice != null ? String(match.unitPrice) : '',
        gstPercent: match?.gstPercent != null ? String(match.gstPercent) : '18',
        makeBrand: match?.makeBrand || match?.brand || '',
        remarks: match?.remarks || ''
      };
    }));
  }, [rfqData, ownResponse, requestedDocs, itemsList, requirementId]);

  // Line-quote totals: when the seller prices per line, keep the headline offered price/qty in sync.
  const lineTotals = React.useMemo(() => {
    let total = 0;
    let qty = 0;
    let priced = 0;
    lineQuotes.forEach(line => {
      const price = Number(line.unitPrice);
      const lineQty = Number(line.quantity) || 0;
      if (line.unitPrice !== '' && Number.isFinite(price) && price >= 0) {
        priced += 1;
        const gst = Number(line.gstPercent) || 0;
        total += price * lineQty * (1 + gst / 100);
        qty += lineQty;
      }
    });
    return { total: Math.round(total * 100) / 100, qty, priced };
  }, [lineQuotes]);

  React.useEffect(() => {
    if (isSubmittedQuote || lineTotals.priced === 0 || lineTotals.priced < lineQuotes.length) return;
    setOfferedPrice(String(lineTotals.total));
    setOfferedQuantity(String(lineTotals.qty));
  }, [isSubmittedQuote, lineTotals, lineQuotes.length]);

  // Assemble the structured submission payload persisted as RequirementResponse.responseData.
  // Function declaration (hoisted) so saveDraft, defined earlier in the component, can call it.
  function buildResponseData() {
    const docs = docUploads
      .filter(doc => doc.status === 'done' && (doc.fileAssetId || doc.fileUrl))
      .map(doc => {
        const item: any = { name: doc.name };
        if (doc.fileAssetId && !isNaN(Number(doc.fileAssetId)) && Number(doc.fileAssetId) > 0) {
          item.fileAssetId = Number(doc.fileAssetId);
        }
        if (doc.fileName) item.fileName = doc.fileName;
        if (doc.fileUrl) item.fileUrl = doc.fileUrl;
        return item;
      });
    const lines = lineQuotes
      .filter(line => line.unitPrice !== '' && Number.isFinite(Number(line.unitPrice)))
      .map(line => {
        const qty = Number(line.quantity) || 1;
        const unitPrice = Number(line.unitPrice);
        const gstPercent = line.gstPercent !== '' && Number.isFinite(Number(line.gstPercent)) ? Number(line.gstPercent) : 0;
        const lineTotal = unitPrice * qty * (1 + gstPercent / 100);
        return {
          itemName: line.itemName,
          quantity: qty,
          unitOfMeasure: line.unitOfMeasure || 'Nos',
          unitPrice,
          unitRate: unitPrice,
          gstPercent,
          makeBrand: line.makeBrand.trim() || null,
          remarks: line.remarks.trim() || null,
          lineTotal: Math.round(lineTotal * 100) / 100,
          totalAmount: Math.round(lineTotal * 100) / 100,
        };
      });
    if (!docs.length && !lines.length) return undefined;
    return { documents: docs, lineItems: lines };
  }

  const handleUploadFiles = useCallback(async (files: FileList | File[]) => {
    if (isReadOnly) return;
    const fileList = Array.from(files);
    for (const file of fileList) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10 MB limit`);
        continue;
      }
      const fileNameLower = file.name.toLowerCase();
      let autoTag = '';
      for (const req of requestedDocs) {
        const reqLower = req.name.toLowerCase();
        if (fileNameLower.includes(reqLower) || (reqLower.includes('pan') && fileNameLower.includes('pan')) || (reqLower.includes('gst') && fileNameLower.includes('gst')) || (reqLower.includes('bank') && fileNameLower.includes('bank'))) {
          const alreadyTagged = docUploads.some(d => d.status === 'done' && (d.taggedAs || d.name)?.toLowerCase() === reqLower);
          if (!alreadyTagged) {
            autoTag = req.name;
            break;
          }
        }
      }

      const tempId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setDocUploads(prev => [
        ...prev.filter(d => d.status !== 'empty'),
        {
          name: autoTag || file.name,
          required: false,
          fileName: file.name,
          fileSize: file.size,
          status: 'uploading',
          progress: 0,
          taggedAs: autoTag,
          id: tempId
        } as any
      ]);

      try {
        const result = await uploadFile(file, percent => {
          setDocUploads(prev => prev.map((item: any) => item.id === tempId ? { ...item, progress: percent } : item));
        });
        setDocUploads(prev => prev.map((item: any) => item.id === tempId ? {
          ...item,
          status: 'done',
          progress: 100,
          fileAssetId: result.id || null,
          fileUrl: result.url || '',
          url: result.url || ''
        } : item));
        setErrors(prev => { const n = { ...prev }; delete n.requestedDocs; return n; });
        toast.success(`${file.name} uploaded`);
      } catch (err: any) {
        setDocUploads(prev => prev.map((item: any) => item.id === tempId ? {
          ...item,
          status: 'error',
          error: err?.message || 'Upload failed'
        } : item));
        toast.error(`Failed to upload ${file.name}`);
      }
    }
  }, [isReadOnly, requestedDocs, docUploads]);

  const handleTagDocument = (index: number, taggedName: string) => {
    if (isReadOnly) return;
    setDocUploads(prev => prev.map((item, i) => i === index ? { ...item, taggedAs: taggedName, name: taggedName || item.fileName || item.name } : item));
    setErrors(prev => { const n = { ...prev }; delete n.requestedDocs; return n; });
  };

  const handleRemoveDocument = (index: number) => {
    if (isReadOnly) return;
    setDocUploads(prev => prev.filter((_, i) => i !== index));
  };

  const updateLineQuote = (index: number, patch: Partial<LineQuote>) => {
    if (isReadOnly) return;
    setLineQuotes(prev => prev.map((line, i) => i === index ? { ...line, ...patch } : line));
  };

  const handlePreviewDocument = (item: any) => {
    const url = item.fileUrl || item.url || '';
    if (!url) return;
    setPreviewDocument({
      label: item.fileName || item.name || 'Document Preview',
      url,
      mode: getDocumentPreviewMode(url, '', (item.fileName || item.name || '').split('.').pop() || '')
    });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    const price = Number(offeredPrice);
    if (!offeredPrice || isNaN(price) || price <= 0) errs.offeredPrice = 'Valid offered price required';
    const qty = Number(offeredQuantity);
    if (!offeredQuantity || isNaN(qty) || qty <= 0) errs.offeredQuantity = 'Valid offered quantity required';
    if (!deliveryTimeline.trim()) errs.deliveryTimeline = 'Delivery timeline required';
    if (!message.trim()) errs.message = 'Quotation message is required';
    if (message.length > 3000) errs.message = 'Message cannot exceed 3000 characters';
    
    const coveredNames = new Set(
      docUploads
        .filter(d => d.status === 'done' && (d.taggedAs || d.name))
        .map(d => String(d.taggedAs || d.name).trim().toLowerCase())
    );
    const missingDocs = requestedDocs.filter(doc => doc.required && !coveredNames.has(doc.name.trim().toLowerCase()));
    if (missingDocs.length > 0) {
      errs.requestedDocs = `Tag each uploaded file with the required document it satisfies. Missing: ${missingDocs.map(d => d.name).join(', ')}`;
    }
    if (!declared) errs.declared = 'You must declare the information is accurate';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileSelect = useCallback((files: FileList | File[]) => {
    if (isReadOnly) return;
    const file = files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10 MB');
      return;
    }
    setUploadState({ file, progress: 0, status: 'pending' });
    setErrors(prev => {
      const next = { ...prev };
      delete next.attachment;
      return next;
    });
  }, [isReadOnly]);

  const handleUpload = useCallback(async () => {
    if (isReadOnly || !uploadState || !uploadState.file || uploadState.status === 'done') return;
    setUploadState(prev => prev ? { ...prev, status: 'uploading', progress: 0 } : prev);
    try {
      const result = await uploadFile(uploadState.file, (percent) => {
        setUploadState(prev => prev ? { ...prev, progress: percent } : prev);
      });
      setUploadState(prev => prev ? { ...prev, status: 'done', progress: 100, url: result.url } : prev);
      toast.success('Document uploaded');
    } catch (err: any) {
      setUploadState(prev => prev ? { ...prev, status: 'error', error: err?.message || 'Upload failed' } : prev);
      toast.error(err?.message || 'Upload failed');
    }
  }, [isReadOnly, uploadState]);

  React.useEffect(() => {
    if (uploadState?.status === 'pending') {
      handleUpload();
    }
  }, [uploadState?.status, handleUpload]);

  const removeFile = () => {
    if (isReadOnly) return;
    setUploadState(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (isSubmittedQuote) {
      toast.error('You have already submitted your quotation for this procurement.');
      return;
    }
    // EMD check commented out as requested
    // if (isEmdActive && !isEmdPaid) {
    //   toast.error('This procurement requires an Earnest Money Deposit (EMD). Please complete the EMD payment before submitting your response.');
    //   return;
    // }
    if (!validate()) return;
    const resolvedId = isMarketplaceQuoteFlow ? (conversationId || rfqData?.conversationId) : (rfqData?.id || requirementId);
    if (!resolvedId) {
      toast.error('Invalid requirement');
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        offeredPrice: Number(offeredPrice),
        offeredQuantity: Number(offeredQuantity),
        deliveryTimeline: deliveryTimeline.trim(),
        message: message.trim(),
        terms: terms.trim() || undefined,
        status: 'SUBMITTED',
      };
      if (uploadState?.url) {
        payload.attachmentUrl = uploadState.url;
      }
      const responseData = buildResponseData();
      if (responseData) payload.responseData = responseData;

      if (isMarketplaceQuoteFlow || rfqData?.isMarketplaceQuote) {
        const targetConvId = conversationId || rfqData?.conversationId;
        await postApi(`/api/conversations/${targetConvId}/quotation`, payload);
      } else if (rfqData?.isQuoteRequestEntity) {
        await postApi(`/api/quote-requests/${resolvedId}/responses`, payload);
      } else {
        try {
          await postApi(`/api/marketplace/requirements/${resolvedId}/responses`, payload);
        } catch (mErr: any) {
          if (mErr?.status === 404 || mErr?.message?.includes('not found')) {
            await postApi(`/api/quote-requests/${resolvedId}/responses`, payload);
          } else {
            throw mErr;
          }
        }
      }
      localStorage.removeItem(`rfq_draft_${requirementId || conversationId}`);
      if (typeof window !== 'undefined') {
        const submitCache = {
          status: 'SUBMITTED',
          submittedAt: new Date().toISOString(),
          offeredPrice: payload.offeredPrice,
          offeredQuantity: payload.offeredQuantity,
          deliveryTimeline: payload.deliveryTimeline,
          message: payload.message,
          terms: payload.terms,
          attachmentUrl: payload.attachmentUrl,
          responseData: payload.responseData,
        };
        const keysToCache = Array.from(new Set([resolvedId, requirementId, conversationId, searchParams?.get('requestId'), searchParams?.get('id'), searchParams?.get('requirementId')].filter(Boolean)));
        keysToCache.forEach(k => {
          try { localStorage.setItem(`rfq_submitted_${k}`, JSON.stringify(submitCache)); } catch {}
        });
      }
      setSubmitted(true);
      toast.success('Your quotation has been submitted successfully.');
    } catch (err: any) {
      if (err?.message?.includes('already submitted') || err?.code === 'REQUIREMENT_RESPONSE_EXISTS' || err?.status === 409) {
        setSubmitted(true);
        if (typeof window !== 'undefined' && resolvedId) {
          try { localStorage.setItem(`rfq_submitted_${resolvedId}`, JSON.stringify({ status: 'SUBMITTED', submittedAt: new Date().toISOString() })); } catch {}
        }
        toast.info('You have already submitted your quotation for this procurement.');
      } else {
        toast.error(err?.message || 'Failed to submit quotation');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToRfq = () => {
    if (isMarketplaceQuoteFlow || rfqData?.isMarketplaceQuote) {
      const targetConvId = conversationId || rfqData?.conversationId;
      window.location.href = `/seller/messages?conversationId=${targetConvId}`;
      return;
    }
    if (isRfp) {
      window.location.href = `/seller/procurement/rfp/${requirementId}`;
    } else if (isRateContract) {
      window.location.href = `/seller/procurement/rate-contract/${requirementId}`;
    } else {
      window.location.href = `/seller/procurement/rfq/${requirementId}`;
    }
  };

  if (!requirementId && !conversationId) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-lg font-black text-red-800">Invalid Quotation Request</h2>
          <p className="mt-2 text-sm text-red-600">No requirement or conversation ID provided.</p>
          <Button onClick={() => window.location.href = '/seller/opportunities'} className="mt-4 bg-[#12335f] text-white">
            Back to Opportunities
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <p className="text-sm font-bold text-slate-500">Loading requirement details...</p>
      </div>
    );
  }

  if (error || !rfqData) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-12">
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h2 className="mt-4 text-lg font-black text-red-800">Failed to Load</h2>
          <p className="mt-2 text-sm text-red-600">Could not load requirement details. Please try again.</p>
          <Button onClick={handleBackToRfq} className="mt-4 bg-indigo-600 text-white">
            Go Back
          </Button>
        </div>
      </div>
    );
  }


  const fieldError = (field: string) => {
    if (!errors[field]) return null;
    return <p className="mt-1 text-[10px] font-bold text-red-600">{errors[field]}</p>;
  };

  const submittedAtValue = ownResponse?.submittedAt || ownResponse?.updatedAt || ownResponse?.createdAt;
  const submittedAtDisplay = submittedAtValue
    ? new Date(submittedAtValue).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-8 pb-12">
      {isSubmittedQuote && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-emerald-800">You have already submitted your quotation for this procurement.</h3>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                Your submitted quotation details are displayed below in read-only mode.
              </p>
            </div>
          </div>
          <Button onClick={handleBackToRfq} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-9 text-xs font-black uppercase shadow-sm shrink-0">
            Back to Requirement
          </Button>
        </div>
      )}
      {!isSubmittedQuote && isClosed && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-slate-500" />
            <div>
              <h3 className="text-sm font-black text-slate-800">Requirement {rfqData?.status}</h3>
              <p className="text-xs font-semibold text-slate-500">This requirement is no longer accepting new quotations.</p>
            </div>
          </div>
          <Button onClick={handleBackToRfq} className="bg-slate-600 hover:bg-slate-700 text-white rounded-xl h-9 text-xs font-black uppercase shadow-sm">
            Back to Requirement
          </Button>
        </div>
      )}

      {/* Navigation & Breadcrumb */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (typeof window !== 'undefined' && window.history.length > 1) {
              router.back();
            } else {
              handleBackToRfq();
            }
          }}
          className="h-8 gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-100 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
          <span>Back</span>
        </Button>

        <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 bg-white border border-slate-200/80 rounded-xl px-4 py-1.5 shadow-2xs">
          <span className="hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => window.location.href = '/seller/opportunities'}>
            Opportunities
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => window.location.href = procurementBackRoute}>
            {procurementTypePluralLabel}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="hover:text-indigo-600 cursor-pointer transition-colors font-mono font-semibold text-slate-700" onClick={handleBackToRfq}>
            {rfqNumber}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="text-indigo-600 font-bold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded text-[10px] border border-indigo-100">
            {submitActionHeaderLabel}
          </span>
        </nav>
      </div>

      {/* Header Card */}
      <section className="relative overflow-hidden border border-slate-200/90 rounded-2xl bg-white p-6 md:p-7 shadow-xs">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between pt-1">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                {submitActionHeaderLabel}
              </h1>
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold tracking-wider text-indigo-700 border border-indigo-200">
                {procurementTypeBadgeLabel}
              </span>
            </div>
            <p className="text-xs md:text-sm font-medium text-slate-500 flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs border border-slate-200">{rfqNumber}</span>
              <span className="text-slate-300">•</span>
              <span className="font-semibold text-slate-800">{subject}</span>
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-0.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800">{orgName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold text-slate-800">Deadline: {deadline}</span>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleBackToRfq}
            className="h-9 rounded-lg border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-all flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> {backButtonLabelText}
          </Button>
        </div>
      </section>

      {/* ── Submitted Quotation Banner ── */}
      {isSubmittedQuote && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-emerald-950">Quotation Submitted</h3>
                <span className="rounded-full bg-emerald-200/80 px-2.5 py-0.5 text-[10px] font-black uppercase text-emerald-850">
                  {submittedStatus(ownResponse) || 'SUBMITTED'}
                </span>
              </div>
              <p className="text-xs font-medium text-emerald-800 mt-0.5">
                You have already submitted your quotation for this procurement. Your response is locked and currently under review by the buyer.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleBackToRfq}
            className="h-9 px-4 text-xs font-bold bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100/60 rounded-lg shrink-0 shadow-2xs"
          >
            {backButtonLabelText}
          </Button>
        </div>
      )}

      {/* ── Navigation Tabs Bar ── */}
      <div className="sticky top-4 z-40 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-xl px-3 py-2 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => scrollToSection('quotation-details')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all whitespace-nowrap"
          >
            <IndianRupee className="h-3.5 w-3.5 text-emerald-500" /> Quotation Details
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('message-documents')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all whitespace-nowrap"
          >
            <FileText className="h-3.5 w-3.5 text-indigo-500" /> Message & Documents
          </button>
          {lineQuotes.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('item-wise-pricing')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all whitespace-nowrap"
            >
              <Package className="h-3.5 w-3.5 text-amber-500" /> Item-Wise Quotation
            </button>
          )}
          {docUploads.length > 0 && (
            <button
              type="button"
              onClick={() => scrollToSection('requested-documents')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all whitespace-nowrap"
            >
              <Paperclip className="h-3.5 w-3.5 text-purple-500" /> Requested Documents
            </button>
          )}
          <button
            type="button"
            onClick={() => scrollToSection('submit-action')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-all whitespace-nowrap"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-500" /> {isSubmittedQuote ? 'Submission Status' : 'Declaration & Submit'}
          </button>
        </div>
      </div>

      {/* Main Two-Column Form */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">

        {/* Left Column — Quotation Details */}
        <section id="quotation-details" className="scroll-mt-24 border border-slate-200/90 rounded-xl bg-white p-5 shadow-xs space-y-5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
            {isRfp ? 'Proposal Details' : 'Quotation Details'}
          </h2>

          {/* Offered Price */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              Offered Price (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.01"
                value={offeredPrice}
                onChange={e => { setOfferedPrice(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.offeredPrice; return n; }); }}
                disabled={isReadOnly || (lineQuotes.length > 0)}
                placeholder="e.g. 150000"
                className={cn(
                  "peer h-10 w-full rounded-lg border pl-9 pr-16 text-xs font-bold text-slate-900 outline-none transition disabled:bg-slate-50 disabled:text-slate-500",
                  errors.offeredPrice ? "border-red-300 focus:ring-red-200 bg-red-50/30" : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                )}
              />
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <IndianRupee className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <div className={cn(
                "absolute inset-y-0 right-0 flex items-center rounded-r-lg border border-l-0 px-3 transition-colors",
                errors.offeredPrice ? "border-red-300 bg-red-50/50 text-red-500" : "border-slate-200 bg-slate-50 text-slate-500 peer-focus:border-indigo-600"
              )}>
                <span className="text-[10px] font-bold uppercase tracking-wider">INR</span>
              </div>
            </div>
            {fieldError('offeredPrice')}
          </div>

          {/* Offered Quantity */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              Offered Quantity <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Package className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={offeredQuantity}
                onChange={e => { setOfferedQuantity(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.offeredQuantity; return n; }); }}
                disabled={isReadOnly || (lineQuotes.length > 0)}
                placeholder={`e.g. ${maxQuantity || 100}`}
                className={cn(
                  "w-full rounded-lg border h-10 pl-9 pr-4 text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-500",
                  errors.offeredQuantity ? "border-red-300 focus:ring-red-200 bg-red-50/30" : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                )}
              />
            </div>
            <p className="mt-1 text-[10px] text-slate-400 font-medium">
              {itemsList.length > 0 ? `Requirement includes ${itemsList.length} item(s). Specify total quantity you can supply.` : ''}
            </p>
            {fieldError('offeredQuantity')}
          </div>

          {/* Delivery Timeline */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              Delivery Timeline <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
              </div>
              <input
                type="text"
                value={deliveryTimeline}
                onChange={e => { setDeliveryTimeline(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.deliveryTimeline; return n; }); }}
                disabled={isReadOnly}
                placeholder="e.g. 15 days, 30 days, 4 weeks"
                className={cn(
                  "w-full rounded-lg border h-10 pl-9 pr-4 text-xs font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-500",
                  errors.deliveryTimeline ? "border-red-300 focus:ring-red-200 bg-red-50/30" : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                )}
              />
            </div>
            {fieldError('deliveryTimeline')}
          </div>

          {/* Terms & Conditions */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              Terms & Conditions
            </label>
            <textarea
              value={terms}
              onChange={e => setTerms(e.target.value)}
              disabled={isReadOnly}
              placeholder="Any additional terms, warranty, payment terms, etc."
              rows={4}
              className="w-full rounded-lg border border-slate-200 p-3 text-xs font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition resize-y disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
        </section>

        {/* Right Column — Message & Documents */}
        <section id="message-documents" className="scroll-mt-24 border border-slate-200/90 rounded-xl bg-white p-5 shadow-xs space-y-5">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider pb-3 border-b border-slate-100">
            {isRfp ? 'Proposal Message & Documents' : 'Message & Documents'}
          </h2>

          {/* Quotation Message / Cover Note */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1.5">
              {isRfp ? 'Proposal Message / Cover Note' : 'Quotation Message / Cover Note'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={e => { setMessage(e.target.value); setErrors(prev => { const n = { ...prev }; delete n.message; return n; }); }}
              placeholder={isRfp ? 'Write a cover note for your proposal...' : 'Write a cover note for your quotation...'}
              disabled={isReadOnly}
              rows={5}
              className={cn(
                "w-full rounded-lg border p-3 text-xs font-semibold text-slate-700 placeholder:text-slate-300 focus:outline-none transition resize-y disabled:bg-slate-50 disabled:text-slate-500",
                errors.message ? "border-red-300 focus:ring-red-200 bg-red-50/30" : "border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
              )}
            />
            <div className="flex items-center justify-between mt-1">
              {fieldError('message')}
              <span className={cn(
                "ml-auto text-[10px] font-medium",
                message.length > 3000 ? "text-red-500" : "text-slate-400"
              )}>
                {message.length}/3000
              </span>
            </div>
          </div>

          {/* Upload Supporting Documents */}
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-1">
              Upload Supporting Documents
            </label>
            <p className="text-[10px] text-slate-400 font-medium mb-2.5">
              Upload price schedule, catalogues, or any supporting documents (PDF, DOC, JPG, PNG — max 10 MB)
            </p>

            {uploadState ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">
                      {uploadState.file?.name || uploadState.fileName || 'Attachment'}
                    </p>
                    {(uploadState.file?.size || uploadState.fileSize) && (
                      <p className="text-[10px] font-medium text-slate-500">
                        {(((uploadState.file?.size || uploadState.fileSize || 0) / 1024)).toFixed(1)} KB
                      </p>
                    )}
                    {uploadState.status === 'uploading' && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${uploadState.progress}%` }}
                        />
                      </div>
                    )}
                    {uploadState.status === 'done' && (
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-700">Uploaded</span>
                      </div>
                    )}
                    {uploadState.status === 'error' && (
                      <p className="text-[10px] font-bold text-red-600 mt-1">{uploadState.error || 'Upload failed'}</p>
                    )}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={removeFile}
                        className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : isReadOnly ? (
              <div className="flex min-h-20 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                <span className="text-xs font-semibold text-slate-400">No supporting document attached</span>
              </div>
            ) : (
              <label
                onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-indigo-500', 'bg-indigo-50/20'); }}
                onDragLeave={e => { e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50/20'); }}
                onDrop={e => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-indigo-500', 'bg-indigo-50/20');
                  if (e.dataTransfer.files.length) handleFileSelect(e.dataTransfer.files);
                }}
                className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 text-center transition hover:border-indigo-400 hover:bg-slate-50"
              >
                <FileUp className="h-6 w-6 text-slate-400" />
                <span className="mt-1.5 text-xs font-bold text-slate-600">Drag & drop files here</span>
                <span className="mt-0.5 text-[10px] text-slate-400 font-medium">or click to browse</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png"
                  onChange={e => e.target.files && handleFileSelect(e.target.files)}
                  className="hidden"
                />
              </label>
            )}
            {fieldError('attachment')}
          </div>

          {/* Required Documents List */}
          {documents.length > 0 && (
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                <Paperclip className="inline h-3 w-3 mr-1 text-indigo-500" />
                Required Documents from Requirement
              </label>
              <div className="space-y-1.5">
                {documents.map((doc: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2"
                  >
                    <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-700">{doc.fileName || doc.documentType || 'Document'}</span>
                    {doc.required && (
                      <span className="rounded px-1.5 py-0.5 text-[8px] font-bold uppercase border border-rose-200 bg-rose-50 text-rose-700 shrink-0 ml-auto">
                        Required
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Per-line-item quote — seller prices each buyer line; totals feed the headline offer */}
      {lineQuotes.length > 0 && (
        <section id="item-wise-pricing" className="scroll-mt-24 border border-slate-200/90 rounded-xl bg-white p-5 shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Item-Wise Quotation</h2>
            <p className="text-[11px] font-medium text-slate-400">
              Price every line — the totals auto-fill your offered price and quantity above.
            </p>
          </div>
          <div className="mt-4 overflow-x-auto border border-slate-200/80 rounded-lg bg-white">
            <div className="overflow-x-auto w-full rounded-xl border border-slate-200 bg-white mb-6 shadow-sm">
<table data-ux-wrapped="true" className="min-w-[860px] w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider">ITEM</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider text-right">QTY / UNIT</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider text-right w-36">UNIT PRICE (₹)</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider text-right w-24">GST %</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider w-36">MAKE / BRAND</th>
                  <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider text-right w-32">LINE TOTAL (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lineQuotes.map((line, idx) => {
                  const price = Number(line.unitPrice);
                  const hasPrice = line.unitPrice !== '' && Number.isFinite(price) && price >= 0;
                  const lineTotal = hasPrice ? price * (Number(line.quantity) || 0) * (1 + (Number(line.gstPercent) || 0) / 100) : 0;
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs font-bold text-slate-900">
                        {line.itemName}
                        {itemsList[idx]?.description && (
                          <p className="mt-0.5 text-[10px] font-medium text-slate-500 line-clamp-1">{itemsList[idx].description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-slate-800 text-right tabular-nums whitespace-nowrap">
                        <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px] border border-slate-200">
                          {line.quantity} <span className="text-[9px] font-semibold text-slate-500 uppercase">{line.unitOfMeasure}</span>
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unitPrice}
                          onChange={e => updateLineQuote(idx, { unitPrice: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="0.00"
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-right text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="px-4 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={line.gstPercent}
                          onChange={e => updateLineQuote(idx, { gstPercent: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="18"
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-right text-xs font-bold text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={line.makeBrand}
                          onChange={e => updateLineQuote(idx, { makeBrand: e.target.value })}
                          disabled={isReadOnly}
                          placeholder="Optional"
                          className="h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 outline-none transition focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-xs font-extrabold text-slate-900 text-right tabular-nums">
                        {hasPrice ? `₹${lineTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {lineTotals.priced > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-600 text-right">
                      Total ({lineTotals.priced}/{lineQuotes.length} items priced, incl. GST)
                    </td>
                    <td className="px-4 py-3 text-sm font-extrabold text-indigo-700 text-right tabular-nums">
                      ₹{lineTotals.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
</div>
          </div>
        </section>
      )}

      {/* Buyer-requested documents — Screenshot 2 design */}
      <section id="requested-documents" className="scroll-mt-24 space-y-4">
        {/* Card 1: BUYER-REQUIRED DOCUMENTS CHECKLIST */}
        {requestedDocs.length > 0 && (() => {
          const coveredDocNames = new Set(
            docUploads
              .filter(d => d.status === 'done' && (d.taggedAs || d.name))
              .map(d => String(d.taggedAs || d.name).trim().toLowerCase())
          );
          const missingReqList = requestedDocs.filter(req => !coveredDocNames.has(req.name.trim().toLowerCase()));

          return (
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                BUYER-REQUIRED DOCUMENTS CHECKLIST
              </p>
              <div className="space-y-2">
                {requestedDocs.map(doc => {
                  const isCovered = coveredDocNames.has(doc.name.trim().toLowerCase());
                  return (
                    <div key={doc.name} className="flex items-center gap-2.5 text-xs font-semibold">
                      {isCovered ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                      )}
                      <span className={isCovered ? 'text-slate-800 font-bold' : 'text-slate-600 font-medium'}>
                        {doc.name}
                      </span>
                    </div>
                  );
                })}
              </div>

              {missingReqList.length > 0 && (
                <p className="mt-3.5 text-xs font-bold text-[#c2410c] leading-relaxed">
                  Tag each uploaded file with the required document it satisfies. Missing: {missingReqList.map(d => d.name).join(', ')}
                </p>
              )}
            </div>
          );
        })()}

        {/* Card 2: Drag and drop files upload zone */}
        {!isReadOnly && (
          <div
            className="relative rounded-xl border-2 border-dashed border-slate-200/90 bg-slate-50/50 p-8 text-center transition hover:border-indigo-300 hover:bg-indigo-50/20 cursor-pointer"
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              if (e.dataTransfer.files?.length) handleUploadFiles(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp"
              className="absolute inset-0 z-10 opacity-0 cursor-pointer"
              onChange={e => {
                if (e.target.files?.length) handleUploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <div className="flex flex-col items-center justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white border border-slate-200/80 shadow-xs mb-2.5 text-slate-500">
                <FileUp className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-700">Drag and drop files here</p>
              <p className="mt-1 text-[11px] font-medium text-slate-400">
                PDF, DOC, DOCX, XLS, XLSX, CSV, JPG, PNG up to 10 MB
              </p>
            </div>
          </div>
        )}

        {/* Card 3: Uploaded Files List with Dropdown Tagging */}
        {docUploads.filter(d => d.status !== 'empty').length > 0 && (
          <div className="space-y-2.5">
            {docUploads.filter(d => d.status !== 'empty').map((item: any, idx: number) => (
              <div
                key={item.id || idx}
                className="rounded-xl border border-slate-200/90 bg-white p-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-2xs transition hover:shadow-xs"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {item.fileName || item.name}
                    </p>
                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                      {item.fileSize ? `${formatBytes(item.fileSize)} - ` : ''}
                      {item.status === 'done' ? (
                        <span className="text-slate-500 font-semibold">ready</span>
                      ) : item.status === 'uploading' ? (
                        <span className="text-indigo-600 font-semibold">Uploading {item.progress}%</span>
                      ) : (
                        <span className="text-red-600 font-semibold">{item.error || 'Upload error'}</span>
                      )}
                    </p>
                    {item.status === 'uploading' && (
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Tag dropdown select */}
                  {!isReadOnly && item.status !== 'uploading' && (
                    <select
                      value={item.taggedAs || ''}
                      onChange={e => handleTagDocument(idx, e.target.value)}
                      className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition focus:border-indigo-500 focus:outline-hidden"
                      title="Tag as required document..."
                    >
                      <option value="">Tag as required document...</option>
                      {requestedDocs.map(req => (
                        <option key={req.name} value={req.name}>{req.name}</option>
                      ))}
                      <option value="Other">Other / Optional Document</option>
                    </select>
                  )}

                  {/* Action Buttons: Preview & Remove */}
                  {(item.fileUrl || item.url) && (
                    <button
                      type="button"
                      onClick={() => handlePreviewDocument(item)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>
                  )}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(idx)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 hover:bg-red-50 shadow-2xs transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Earnest Money Deposit (EMD) Section — Commented out as requested */}
      {/* {isEmdActive && (
        <section id="emd-payment-section" className="scroll-mt-24">
          <EmdCard
            emdInfo={emdInfo}
            loading={emdLoading}
            onPayClick={() => setIsEmdModalOpen(true)}
            procurementType={procurementType}
          />
        </section>
      )} */}

      {/* Declaration & Submit */}
      <section id="submit-action" className="scroll-mt-24 border border-slate-200/90 rounded-xl bg-white p-5 shadow-xs space-y-4">
        {!isSubmittedQuote && (
          <>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="declaration"
                checked={declared}
                disabled={isReadOnly}
                onChange={e => { setDeclared(e.target.checked); setErrors(prev => { const n = { ...prev }; delete n.declared; return n; }); }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/20 focus:ring-2 disabled:opacity-50"
              />
              <label htmlFor="declaration" className="text-xs font-medium text-slate-600 leading-relaxed">
                I declare that the information provided in this quotation is accurate and complete. I understand that any false
                or misleading information may result in disqualification.
              </label>
            </div>
            {fieldError('declared')}
          </>
        )}

        {/* {isEmdActive && !isEmdPaid && !isSubmittedQuote && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 flex items-start gap-2.5 text-xs text-amber-900 font-medium">
            <AlertCircle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              This procurement requires an Earnest Money Deposit (EMD). Please complete the EMD payment before submitting your response.
            </span>
          </div>
        )} */}

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-100 w-full">
          {isSubmittedQuote ? (
            <>
              <div className="flex w-full items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left sm:flex-1">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-wider text-emerald-800">Quotation Submitted</h2>
                  <p className="mt-1 text-xs font-semibold text-slate-600">
                    This quotation is locked and shown exactly as submitted{submittedAtDisplay ? ` on ${submittedAtDisplay}` : ''}.
                  </p>
                </div>
              </div>
              <Button
                disabled
                type="button"
                className="hidden"
              >
                <CheckCircle2 className="h-4 w-4 text-white" /> Quotation Submitted ✓
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToRfq}
                className="rounded-lg border-slate-200 h-10 text-xs font-bold uppercase tracking-wider text-slate-700 hover:bg-slate-50 w-full sm:w-auto"
              >
                Back to Requirement
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || isReadOnly || (isEmdActive && !isEmdPaid)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-6 h-10 text-xs font-bold uppercase tracking-wider shadow-xs transition flex items-center gap-2 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> {isSubmittedQuote ? (isRfp ? 'Proposal Submitted' : 'Quotation Submitted') : isRfp ? 'Submit Proposal' : isRateContract ? 'Submit Rate Quotation' : 'Submit Quotation'}
                  </>
                )}
              </Button>
              <Button
                type="button"
                onClick={saveDraft}
                disabled={submitting || isReadOnly}
                variant="outline"
                className="rounded-lg border-slate-200 h-10 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 w-full sm:w-auto"
              >
                Save Draft
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToRfq}
                disabled={submitting}
                className="rounded-lg border-slate-200 h-10 text-xs font-bold uppercase tracking-wider text-slate-600 w-full sm:w-auto"
              >
                Cancel
              </Button>
            </>
          )}
          
          <div className="text-right sm:ml-auto shrink-0 mt-2 sm:mt-0 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isSubmittedQuote ? (
              <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Submitted quotation locked
              </span>
            ) : draftSaved ? (
              <span className="text-emerald-600 font-extrabold flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Draft Saved Successfully
              </span>
            ) : lastSaved ? (
              <span>Last saved draft: {lastSaved}</span>
            ) : (
              <span>Draft not saved yet</span>
            )}
          </div>
        </div>
      </section>

      {/* EMD Payment Gateway Modal (Commented out as requested) */}
      {/* <EmdPaymentModal
        isOpen={isEmdModalOpen}
        onClose={() => setIsEmdModalOpen(false)}
        requirementId={targetReqId}
        rfqTitle={subject}
        rfqNumber={rfqNumber}
        emdAmount={emdInfo?.emdAmount || 0}
        onSuccess={() => {
          setIsEmdModalOpen(false);
          refetchEmd();
          toast.success("EMD Payment verified successfully!");
        }}
      /> */}

      <DocumentPreviewModal previewDocument={previewDocument} onClose={() => setPreviewDocument(null)} />
    </div>
  );
}
