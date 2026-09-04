import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Building2,
  Factory,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Wrench,
} from 'lucide-react';

export type BidStatus = 'Open' | 'Closing Soon' | 'Under Evaluation' | 'Awarded' | 'Closed';
export type BidType = 'Product' | 'Service' | 'Works' | 'Rate Contract';
export type BuyerType = 'Large Industry' | 'MSME Buyer' | 'Government Buyer' | 'Private Enterprise' | 'PSU Buyer';
export type EvaluationStatus = 'Pending' | 'Technical Evaluation' | 'Financial Evaluation' | 'Qualified' | 'Disqualified' | 'Awarded';
export type ClarificationStatus = 'Pending' | 'Responded' | 'Completed' | 'Reopened' | 'Rejected' | 'None';

export interface ClarificationRecord {
  requestNumber: string;
  requestedAt: string;
  type: string;
  description: string;
  sellerResponse: string;
  buyerResponse: string;
  status: ClarificationStatus;
  uploadedDocument: string;
}

export interface BidResultRow {
  participationId?: number;
  sellerName: string;
  sellerType: string;
  offeredItem: string;
  makeBrand: string;
  model: string;
  technicalStatus: 'Qualified' | 'Disqualified' | 'Pending' | 'Under Review' | 'Clarification Required';
  financialStatus: 'Opened' | 'Pending' | 'Rejected';
  totalPrice: number;
  finalRank: 'L1' | 'L2' | 'L3' | 'L4' | 'NA';
  resultStatus: 'Awarded' | 'Responsive' | 'Under Review' | 'Rejected';
  contactPerson?: string;
  details?: Record<string, any>;
  documents?: any[];
  submittedAt?: string;
  sellerEmail?: string;
  sellerMobile?: string;
  seller?: Record<string, any>;
}

export interface ProcurementBid {
  id: string;
  sourceModel?: 'PROCUREMENT_BID' | 'TENDER' | string;
  sourceId?: number;
  buyerId?: number;
  title: string;
  itemName: string;
  buyerName: string;
  buyerType: BuyerType;
  departmentName: string;
  bidType: BidType;
  procurementType?: string;
  canonicalMethod?: string;
  method?: string;
  category: string;
  location: string;
  deliveryLocation: string;
  quantity: string;
  estimatedValue: number;
  startDate: string;
  endDate: string;
  status: BidStatus;
  approvalStatus?: string;
  lifecycleStage?: string;
  participantsCount?: number;
  rejectedReason?: string;
  technicalStatus: EvaluationStatus;
  clarificationStatus: ClarificationStatus;
  participated: boolean;
  description: string;
  eligibility: string[];
  requiredDocuments: string[];
  importantDates: Array<{ label: string; date: string }>;
  terms: string[];
  lifecycle: EvaluationStatus[];
  currentStage: EvaluationStatus;
  clarifications: ClarificationRecord[];
  results: BidResultRow[];
  bidDocuments?: Array<{ id: number | string; name: string; meta: string; fileAssetId?: number | null }>;
  participations?: ProcurementBidParticipation[];
  awards?: ProcurementBidAward[];
  technicalPacket?: any;
  documents?: any[];
  consigneeDetails?: any;
  emdAmount?: number;
  isEmdRequired?: boolean;
  evaluationMethod?: string;
  allowClarification?: boolean;
  allowReverseAuction?: boolean;
  packetType?: string;
  version?: number;
  buyer?: any;
  buyerOrganization?: any;
  invitations?: any[];
  invitedCount?: number;
  invitationsCount?: number;
  invitedSellers?: any[];
}

export interface ProcurementBidDocument {
  id: number | string;
  documentCategory?: string;
  documentName?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  documentStatus?: string;
  uploadedAt?: string;
  fileAssetId?: number | null;
}

export interface ProcurementClarification {
  id?: number;
  requestNumber?: string;
  clarificationType?: string;
  question?: string;
  response?: string;
  status?: string;
  dueDate?: string;
  requestedAt?: string;
}

export interface ProcurementEvaluation {
  id?: number;
  status?: string;
  remarks?: string;
  score?: number;
  createdAt?: string;
}

export interface ProcurementBidAward {
  id?: number;
  participationId?: number;
  status?: string;
  remarks?: string;
  createdAt?: string;
}

export interface ProcurementBidParticipation {
  id: number;
  bidId?: number;
  sellerId?: number;
  seller?: { id?: number; name?: string; role?: string; onboardingStatus?: string };
  participationNumber?: string;
  technicalStatus?: string;
  financialStatus?: string;
  finalStatus?: string;
  rank?: number | null;
  quotedAmount?: number;
  gstPercentage?: number;
  totalAmount?: number;
  makeBrand?: string;
  model?: string;
  offeredItemDescription?: string;
  submissionStatus?: string;
  submittedAt?: string;
  technicalSubmittedAt?: string;
  financialSubmittedAt?: string;
  isWithdrawn?: boolean;
  rejectionReason?: string;
  documents?: ProcurementBidDocument[];
  clarifications?: ProcurementClarification[];
  evaluations?: ProcurementEvaluation[];
  awards?: ProcurementBidAward[];
  averageRating?: {
    rating: number;
    qualityScore: number;
    deliveryScore: number;
    communicationScore: number;
    documentationScore: number;
    count: number;
  };
}

export const buyerNetwork: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: Factory, title: 'Large Scale Industries', description: 'Enterprise plants and high-volume procurement teams.' },
  { icon: Building2, title: 'MSME Buyers', description: 'Growing manufacturers and service buyers sourcing locally.' },
  { icon: Landmark, title: 'Government Buyers', description: 'Departments, institutions, utilities, and public offices.' },
  { icon: ShieldCheck, title: 'PSU Buyers', description: 'Public sector units with structured vendor requirements.' },
  { icon: Users, title: 'Corporate Procurement Teams', description: 'Private enterprises managing approved supplier panels.' },
];

export const supplierNetwork: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: Store, title: 'MSME Suppliers', description: 'Registered micro, small, and medium sellers.' },
  { icon: Factory, title: 'Manufacturers', description: 'OEMs and production units with verified capability.' },
  { icon: Wrench, title: 'Service Providers', description: 'Maintenance, IT, civil, facility, and professional services.' },
  { icon: BadgeCheck, title: 'Verified Sellers', description: 'GST, Udyam, and portal-approved suppliers.' },
  { icon: Truck, title: 'Logistics Partners', description: 'Local and regional delivery support providers.' },
];

export const procurementBids: ProcurementBid[] = [];

export const publishBidFields = [
  'Bid title',
  'Buyer organization',
  'Buyer type',
  'Department name',
  'Product/service category',
  'Requirement description',
  'Quantity',
  'Estimated budget',
  'Delivery location',
  'Last date',
  'Required documents',
  'Eligibility criteria',
  'Terms and conditions',
  'Upload bid document',
];

export const lifecycleLabels = ['Bid Published', 'Seller Participated', 'Technical Evaluation', 'Financial Evaluation', 'L1 Selection', 'Awarded'];

export const adminActions = [
  'Approve bids',
  'Reject bids',
  'View participating sellers',
  'Monitor clarification requests',
  'View technical evaluation',
  'View financial evaluation',
  'View L1/L2/L3 results',
  'Export reports',
];

export const participationSteps = [
  'View bid',
  'Check eligibility',
  'Upload technical documents',
  'Upload financial quote',
  'Review submission',
  'Submit bid',
  'Track status',
];

export function findBid(id?: string) {
  return procurementBids.find(bid => bid.id === id) || procurementBids[0];
}

export function money(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const sampleBidDocuments: Array<{ icon: LucideIcon; name: string; meta: string }> = [];
