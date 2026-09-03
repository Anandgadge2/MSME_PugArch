'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  HelpCircle,
  Mail,
  MessageSquare,
  Phone,
  ShieldCheck,
  Search,
  ChevronDown,
  Copy,
  Check,
  Clock,
  Headphones,
  Scale,
  Building2,
  Store,
  Users,
  AlertTriangle,
  ArrowRight,
  Eye,
  Sparkles,
  X,
  ShoppingCart,
  ClipboardCheck,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { isShgUser } from '../lib/shg';
import { DocumentPreviewModal } from '../components/DocumentPreviewModal';
import type { DocumentPreview } from '../lib/files';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

type RoleCategory = 'buyer' | 'seller' | 'shg' | 'admin';

interface SopStep {
  title: string;
  description: string;
  prerequisites: string[];
  actionLabel?: string;
  actionHref?: string;
}

interface SopWorkflow {
  id: RoleCategory;
  name: string;
  badgeLabel: string;
  roleIcon: React.ComponentType<{ className?: string }>;
  overview: string;
  steps: SopStep[];
}

const SOP_WORKFLOWS: SopWorkflow[] = [
  {
    id: 'buyer',
    name: 'Buyer Procurement Flow',
    badgeLabel: 'Buyer / Procurer',
    roleIcon: Building2,
    overview: 'Stepwise guide for institutional, enterprise, and government buyers to initiate, evaluate, award, and clear procurement orders.',
    steps: [
      {
        title: 'Organization Registration & Verification',
        description: 'Create an institutional account, complete your entity profile, upload GSTIN, PAN, and authorized signatory mandates, and receive District Administration clearance.',
        prerequisites: ['Valid GSTIN Certificate', 'Entity PAN', 'Authorised Signatory Mandate', 'Official Email'],
        actionLabel: 'Buyer Profile',
        actionHref: '/buyer/profile'
      },
      {
        title: 'Procurement Creation & BOQ Specifications',
        description: 'Define item categories, quantity, measurable technical specifications, delivery schedule, payment terms, and upload tender schedules (RFQ, RFP, or Reverse Auction).',
        prerequisites: ['Detailed Item Specifications', 'Approved Budget Allocation', 'Delivery Location / Address Book'],
        actionLabel: 'Create Procurement',
        actionHref: '/buyer/procurement/create'
      },
      {
        title: 'Supplier Response & Clarifications',
        description: 'Receive quotations and bids from verified district sellers. Use in-platform messaging for transparent, auditable technical clarifications.',
        prerequisites: ['Active Bid Listing', 'Portal In-App Messaging'],
        actionLabel: 'View Responses',
        actionHref: '/buyer/procurement/responses'
      },
      {
        title: 'Evaluation, Approval & Contract Award',
        description: 'Evaluate technical conformity and commercial bids against L1 benchmarks. Record internal approval remarks and issue digital Purchase Orders (PO).',
        prerequisites: ['Comparative Statement', 'Approval Trail Matrix', 'Final Pricing Confirmation'],
        actionLabel: 'Purchase Orders',
        actionHref: '/orders'
      },
      {
        title: 'Goods Receipt Note (GRN) & Physical Inspection',
        description: 'Upon physical delivery, conduct verification against PO specifications and generate a Goods Receipt Note (GRN) within 48 hours to validate vendor invoices.',
        prerequisites: ['Delivery Challan', 'Physical Inspection Checklist', 'E-Way Bill'],
        actionLabel: 'Manage GRN',
        actionHref: '/grn'
      },
      {
        title: 'Invoice Clearance, Escrow & Statutory Timelines',
        description: 'Release milestone or escrow payments in compliance with the MSME Act 45-day statutory guideline. Close the transaction and submit supplier ratings.',
        prerequisites: ['Digitally Signed Tax Invoice', 'Approved GRN', 'Escrow Milestone Verification'],
        actionLabel: 'Payment History',
        actionHref: '/buyer/payments'
      }
    ]
  },
  {
    id: 'seller',
    name: 'Seller / MSME Participation Flow',
    badgeLabel: 'Seller / MSME',
    roleIcon: Store,
    overview: 'Guidance for local micro, small, and medium manufacturing and service enterprises to discover opportunities, submit competitive bids, and receive guaranteed settlements.',
    steps: [
      {
        title: 'MSME Onboarding & Udyam Linking',
        description: 'Register with PAN and GSTIN, link your valid Udyam Registration number, complete factory/service capacity details, and submit bank mandate for Penny-Drop verification.',
        prerequisites: ['Udyam Registration Certificate', 'Active GSTIN', 'Bank Mandate / Cancelled Cheque'],
        actionLabel: 'Seller Settings',
        actionHref: '/seller/settings'
      },
      {
        title: 'Catalogue & Capability Listing',
        description: 'Publish product and service listings with accurate HSN/SAC codes, technical data sheets, certifications (ISO, BIS, MSME), pricing, and production capacity.',
        prerequisites: ['Product Specifications', 'High-Resolution Images', 'Certifications'],
        actionLabel: 'My Catalogue',
        actionHref: '/seller/catalogue'
      },
      {
        title: 'Opportunity Radar & Bid Submission',
        description: 'Discover published tenders and quote requests matching your categories. Submit compliant technical and commercial proposals with automated EMD exemption verification.',
        prerequisites: ['Statutory Eligibility Check', 'Commercial Quotation Form', 'Compliance Declarations'],
        actionLabel: 'Browse Opportunities',
        actionHref: '/seller/opportunities'
      },
      {
        title: 'Order Acceptance & Production Dispatch',
        description: 'Receive digital Purchase Orders, accept delivery milestones, generate delivery challans, and arrange freight with verified transit tracking.',
        prerequisites: ['Signed Purchase Order Acceptance', 'Delivery Schedule', 'Dispatch Challan'],
        actionLabel: 'My Orders',
        actionHref: '/orders'
      },
      {
        title: 'Invoicing & GRN Tracking',
        description: 'Submit GST-compliant tax invoices connected to the Purchase Order. Track buyer GRN inspection status in real time through your seller console.',
        prerequisites: ['Valid Tax Invoice with IRN/QR', 'Consignment Proof of Delivery'],
        actionLabel: 'Invoices Register',
        actionHref: '/payments/invoices'
      },
      {
        title: 'Payment Settlement & Statutory Protection',
        description: 'Receive escrow disbursement or direct account credit within the statutory 45-day MSMED Act timeline. Track transaction IDs and settlement receipts.',
        prerequisites: ['Accepted GRN', 'Bank Account Verification'],
        actionLabel: 'Payment Status',
        actionHref: '/payments/transactions'
      }
    ]
  },
  {
    id: 'shg',
    name: 'Self Help Group (SHG) Producer Flow',
    badgeLabel: 'SHG Producer Federation',
    roleIcon: Users,
    overview: 'Simplified workflows for women Self Help Groups and artisan federations to access reserved public procurement quotas, showcase handicrafts, and receive timely payouts.',
    steps: [
      {
        title: 'SHG Federation Verification',
        description: 'Register under District NRLM / OLM affiliation, submit group registration details, and receive facilitated nodal assistance from the District Industry Centre.',
        prerequisites: ['SHG Resolution / Bank Passbook', 'NRLM / OLM Affiliation ID', 'President/Secretary KYC'],
        actionLabel: 'SHG Dashboard',
        actionHref: '/shg/dashboard'
      },
      {
        title: 'Cluster Storefront & Product Showcase',
        description: 'List local handloom, handicraft, food processing, and eco-friendly products with simplified descriptions, batch sizes, and lead times.',
        prerequisites: ['Product Details', 'Cluster Origin Tag', 'Sample Images'],
        actionLabel: 'Products Catalogue',
        actionHref: '/seller/catalogue'
      },
      {
        title: 'Preferential Procurement Participation',
        description: 'Access tenders with statutory SHG preference, relaxed turnover criteria, and 100% EMD fee waiver. Submit bids with guidance from community animators.',
        prerequisites: ['SHG Standing Certificate', 'Price Bid Submission'],
        actionLabel: 'SHG Opportunities',
        actionHref: '/shg/opportunities'
      },
      {
        title: 'Cluster Fulfilment & Consolidated Dispatch',
        description: 'Fulfill collective orders, package with quality standard markings, and coordinate institutional delivery to local schools, hospitals, or government offices.',
        prerequisites: ['Cluster Packaging Slip', 'Inspection Sign-Off'],
        actionLabel: 'My Orders',
        actionHref: '/orders'
      },
      {
        title: 'Direct Bank Transfer & Escrow Protection',
        description: 'Receive verified payments directly into the designated SHG collective savings bank account with automated transaction SMS and digital receipts.',
        prerequisites: ['Verified Direct Beneficiary Account', 'Approved GRN'],
        actionLabel: 'Bank Transactions',
        actionHref: '/payments/transactions'
      }
    ]
  },
  {
    id: 'admin',
    name: 'District Administrator & Operator Flow',
    badgeLabel: 'Admin / District Nodal Officer',
    roleIcon: ShieldCheck,
    overview: 'Operational controls for District Industry Centre (DIC) officers and administrators to vet stakeholders, oversee tenders, arbitrate disputes, and monitor district MIS metrics.',
    steps: [
      {
        title: 'Entity Due Diligence & Stakeholder Approval',
        description: 'Scrutinize onboarding applications from buyers, sellers, and SHGs. Validate GSTIN, PAN, and Udyam authenticity, check blacklists, and approve or reject with audit notes.',
        prerequisites: ['Uploaded KYC Documents', 'Tax Registration Validation Check', 'District Scoping'],
        actionLabel: 'Stakeholder Approvals',
        actionHref: '/admin/onboarding'
      },
      {
        title: 'Tender Governance & Fair-Price Oversight',
        description: 'Monitor published tenders, verify technical criteria for anti-competitive restrictions, and approve major procurement notices before public broadcasting.',
        prerequisites: ['Tender Vetting Rules', 'Category Classification Check'],
        actionLabel: 'Tender Approvals',
        actionHref: '/admin/bids'
      },
      {
        title: 'Monitoring Delivery, GRN & Payment Timelines',
        description: 'Track district-wide order fulfillment, identify overdue deliveries, inspect flagged GRN discrepancies, and ensure MSME payment timelines are adhered to.',
        prerequisites: ['Real-Time Order Telemetry', 'GRN Tracking Queue'],
        actionLabel: 'Delivery Oversight',
        actionHref: '/admin/delivery'
      },
      {
        title: 'Dispute Mediation & Escrow Arbitration',
        description: 'Arbitrate formal contract disputes, convene grievance conciliation with evidence, issue binding determinations, and manage escrow hold or release directives.',
        prerequisites: ['Dispute Evidence Dossier', 'In-App Audit Trail', 'Statutory Powers'],
        actionLabel: 'Disputes Desk',
        actionHref: '/admin/disputes'
      },
      {
        title: 'District MIS Reporting & Statutory Audits',
        description: 'Generate compliance reports, track procurement spend percentages from local MSMEs and SHGs, and export auditable transaction registers for administrative review.',
        prerequisites: ['Date Range Filters', 'Role-Based Audit Logs'],
        actionLabel: 'MIS Reports',
        actionHref: '/admin/reports'
      }
    ]
  }
];

const DOCUMENTATION_STANDARDS = [
  {
    title: 'Technical Specifications & BOQ',
    category: 'Item Clarity',
    icon: CheckSquare,
    items: [
      'Provide precise parameters, measurable metrics, approved IS/BIS/ISO benchmarks, and technical drawings.',
      'Specify exact delivery point (FOR Destination), unloading terms, and expected milestone schedules.',
      'Avoid proprietary brand lock-in unless officially justified with district proprietary clearance.'
    ]
  },
  {
    title: 'Commercial & Statutory Terms',
    category: 'Pricing Integrity',
    icon: Scale,
    items: [
      'Quote all prices inclusive of basic rate, applicable HSN/SAC code, and itemized GST rate breakdown.',
      'Qualified MSMEs with active Udyam certificates and SHGs receive statutory EMD and PBG exemptions.',
      'Strict adherence to the 45-day statutory payment maximum under Section 15 of the MSMED Act 2006.'
    ]
  },
  {
    title: 'Audit & In-Platform Messaging',
    category: 'Traceability',
    icon: MessageSquare,
    items: [
      '100% of pre-bid clarifications, quote adjustments, and contract discussions must remain inside Portal Messages.',
      'External phone, WhatsApp, or personal email communications are strictly inadmissible in dispute hearings.',
      'All user actions (login, edits, status updates) are cryptographically time-stamped and audit-logged.'
    ]
  },
  {
    title: 'Data Privacy & PII Protection',
    category: 'Security Compliance',
    icon: ShieldCheck,
    items: [
      'All Aadhaar numbers are permanently masked; only the final 4 digits may ever be displayed or stored.',
      'Never disclose portal passwords, two-factor OTPs, or banking PINs via chat, attachments, or phone.',
      'Ensure registered entity name on PAN, GSTIN, and Udyam match identically to prevent automated freeze.'
    ]
  }
];

const OFFICIAL_DOCUMENTS = [
  {
    name: 'Terms & Conditions',
    category: 'Portal Governance',
    description: 'Master platform operating terms, stakeholder rights, obligations, and legal framework.',
    path: '/docs/Terms and Conditions.pdf'
  },
  {
    name: 'Privacy Policy',
    category: 'Data Protection',
    description: 'Statutory guidelines on personal data handling, encryption, and institutional privacy.',
    path: '/docs/Privacy Policy - JSG Smile.pdf'
  },
  {
    name: 'MSME & Supplier Agreement',
    category: 'Vendor Participation',
    description: 'Code of conduct, performance guarantees, and statutory protections for MSME suppliers.',
    path: '/docs/MSME Registration & Supplier Participation Agreement.pdf'
  },
  {
    name: 'Data Sharing Consent',
    category: 'Consent & KYC',
    description: 'Consent charter authorizing validation with GSTN, Udyam, PAN, and banking APIs.',
    path: '/docs/Data Sharing Consent Agreement.pdf'
  },
  {
    name: 'Vendor Verification Policy',
    category: 'Compliance Audit',
    description: 'Criteria, document matrices, and due diligence checks required for seller approval.',
    path: '/docs/Vendor Verification Policy.pdf'
  },
  {
    name: 'Procurement Policy',
    category: 'Procurement Rules',
    description: 'Standards for purchase order issuance, fair pricing, and preferential procurement.',
    path: '/docs/Order Placement & Procurement Facilitation Policy.pdf'
  },
  {
    name: 'Refund & Cancellation Policy',
    category: 'Commercial Rules',
    description: 'Rules governing contract withdrawal, order cancellation penalties, and escrow refunding.',
    path: '/docs/Order Cancellation, Withdrawal & Refund Policy.pdf'
  },
  {
    name: 'Registration Pre-Requisites',
    category: 'Checklist Guide',
    description: 'Mandatory checklist of certificates and credentials needed prior to account registration.',
    path: '/MSME_Registration_Pre_Requisites_PugArch.pdf'
  }
];

const FAQS = [
  {
    question: 'What is the statutory payment deadline for MSME suppliers under the MSMED Act?',
    answer: 'Under Section 15 of the Micro, Small and Medium Enterprises Development (MSMED) Act, buyers must make payment on or before the agreed date, which cannot exceed 45 days from the date of acceptance (or deemed acceptance) of goods/services. If payment is delayed beyond 45 days, the buyer is legally liable to pay compound interest with monthly rests at 3 times the Bank Rate notified by the RBI.'
  },
  {
    question: 'Why was my organization onboarding verification returned or delayed?',
    answer: 'The primary cause of verification delay is discrepancy between the legal name or address recorded on the PAN card, GSTIN portal, and the Udyam Registration Certificate. Please ensure your entity name, authorized signatory, and registered address match across all official documents before submitting.'
  },
  {
    question: 'Are MSME suppliers and SHGs exempt from Earnest Money Deposit (EMD) and tender fees?',
    answer: 'Yes. In accordance with the Public Procurement Policy for MSEs, all registered Micro and Small Enterprises holding a valid Udyam Registration Certificate and verified Self Help Groups (SHGs) are 100% exempt from payment of tender fees and Earnest Money Deposit (EMD) across all district procurement tenders.'
  },
  {
    question: 'How does the Goods Receipt Note (GRN) protect both buyers and suppliers?',
    answer: 'When a consignment arrives, the buyer inspects the goods against the Purchase Order specifications and generates a digital Goods Receipt Note (GRN) on the portal within 48 hours. Generating the GRN serves as statutory proof of delivery and automatically validates the supplier’s invoice for milestone or escrow release.'
  },
  {
    question: 'How do Self Help Groups (SHGs) participate in reserved public procurement?',
    answer: 'SHGs verified under District NRLM/OLM credentials can publish handcrafted, agricultural, or processed goods in the SHG Catalogue. Government departments and institutional buyers can award reserved procurement contracts directly or via quota-restricted tenders with relaxed turnover and prior experience criteria.'
  },
  {
    question: 'What should I do if a dispute arises regarding quality, delivery, or payments?',
    answer: 'Go to "Disputes" in your portal navigation and file a formal dispute ticket referencing the Purchase Order ID, along with supporting documents and photos. The District Nodal Officer will review the tamper-proof portal audit trail and schedule an arbitration hearing within 7 working days.'
  }
];

export default function HelpPage() {
  const { user } = useAuth();
  const isShg = isShgUser(user);

  // Determine active default workflow tab based on user's current role
  const defaultTab: RoleCategory = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'master_admin') return 'admin';
    if (user?.role === 'shg' || isShg) return 'shg';
    if (user?.role === 'seller') return 'seller';
    return 'buyer';
  }, [user?.role, isShg]);

  const [activeTab, setActiveTab] = useState<RoleCategory>(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentPreview | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Copy helper with feedback
  const handleCopy = useCallback((text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`${label} copied to clipboard`);
    setTimeout(() => setCopiedKey(null), 2500);
  }, []);

  // Quick Action cards tailored to current logged in role
  const quickCards = useMemo(() => {
    if (user?.role === 'admin' || user?.role === 'master_admin') {
      return [
        {
          icon: ShieldCheck,
          title: 'Stakeholder Approvals',
          href: '/admin/onboarding',
          text: 'Review pending buyer, seller, and SHG registrations, verify KYC documents, and approve compliant accounts.',
          badge: 'Admin Desk'
        },
        {
          icon: ClipboardCheck,
          title: 'Tender & Bid Governance',
          href: '/admin/bids',
          text: 'Vetting active procurements, bid evaluations, and authorizing procurement order awards.',
          badge: 'Procurement Oversight'
        },
        {
          icon: AlertTriangle,
          title: 'Disputes & Escrow Holds',
          href: '/admin/disputes',
          text: 'Arbitrate formal contract disputes, investigate vendor grievances, and manage escrow settlements.',
          badge: 'Grievance Desk'
        },
        {
          icon: BookOpen,
          title: 'Official User Guide',
          href: '/user-guide',
          text: 'Explore comprehensive platform manuals, role permission matrices, and stepwise operational notes.',
          badge: 'Documentation'
        }
      ];
    }

    if (user?.role === 'seller') {
      return [
        {
          icon: ClipboardList,
          title: 'Live Opportunities',
          href: '/seller/opportunities',
          text: 'Discover published RFQs, RFPs, tenders, and reverse auctions matching your registered business categories.',
          badge: 'Opportunities'
        },
        {
          icon: FileText,
          title: 'My Bids & Quotations',
          href: '/seller/bids',
          text: 'Submit competitive technical and financial bids and track real-time evaluation and award outcomes.',
          badge: 'Bidding Desk'
        },
        {
          icon: Store,
          title: 'Catalogue & Products',
          href: '/seller/catalogue',
          text: 'Manage product specifications, pricing, HSN codes, manufacturing capacities, and stock availability.',
          badge: 'My Catalogue'
        },
        {
          icon: BookOpen,
          title: 'Official User Guide',
          href: '/user-guide',
          text: 'Operational manual on tender bidding, GRN dispatch, invoicing, and statutory MSME Act rights.',
          badge: 'Documentation'
        }
      ];
    }

    if (user?.role === 'shg' || isShg) {
      return [
        {
          icon: ClipboardList,
          title: 'SHG Opportunities',
          href: '/shg/opportunities',
          text: 'Explore district public procurement tenders featuring special SHG reservations and preferential quotas.',
          badge: 'Preferential Quota'
        },
        {
          icon: Store,
          title: 'SHG Products Catalogue',
          href: '/seller/catalogue',
          text: 'Showcase handcrafted goods, organic agricultural produce, and cluster goods to verified buyers.',
          badge: 'Storefront'
        },
        {
          icon: CheckCircle2,
          title: 'My Bids & Orders',
          href: '/seller/bids',
          text: 'Track quotation submissions, delivery dispatch milestones, and direct beneficiary bank credits.',
          badge: 'Order Tracking'
        },
        {
          icon: BookOpen,
          title: 'Official User Guide',
          href: '/user-guide',
          text: 'Simplified visual guidelines and steps for Self Help Groups and district cluster animators.',
          badge: 'Documentation'
        }
      ];
    }

    if (user?.role === 'buyer') {
      return [
        {
          icon: ClipboardList,
          title: 'Create Procurement',
          href: '/buyer/procurement/create',
          text: 'Publish procurement with item specifications, quantity, budget, delivery terms, and tender schedules.',
          badge: 'Procurement Wizard'
        },
        {
          icon: ShoppingCart,
          title: 'Purchase Orders & GRN',
          href: '/orders',
          text: 'Issue contracts, monitor consignment dispatches, and generate inspection Goods Receipt Notes (GRN).',
          badge: 'Orders Desk'
        },
        {
          icon: MessageSquare,
          title: 'Secure Messages',
          href: '/buyer/messages',
          text: 'Exchange auditable pre-bid technical clarifications and quote negotiations directly with suppliers.',
          badge: 'In-Platform Chat'
        },
        {
          icon: BookOpen,
          title: 'Official User Guide',
          href: '/user-guide',
          text: 'Detailed portal manual covering buyer procurement rules, evaluation workflows, and payment release.',
          badge: 'Documentation'
        }
      ];
    }

    // Guest / Public User
    return [
      {
        icon: Building2,
        title: 'Register as Buyer',
        href: '/buyer/register',
        text: 'Onboard your enterprise or government department for streamlined institutional and tender buying.',
        badge: 'Buyer Onboarding'
      },
      {
        icon: Store,
        title: 'Register as Seller / MSME',
        href: '/seller/register',
        text: 'Register your micro or small manufacturing unit with Udyam, GSTIN, and PAN to access buyer orders.',
        badge: 'Seller Onboarding'
      },
      {
        icon: ShoppingCart,
        title: 'Explore Marketplace',
        href: '/marketplace/products',
        text: 'Browse verified local MSME and SHG products and industrial supplies manufactured in Jharsuguda.',
        badge: 'Marketplace'
      },
      {
        icon: BookOpen,
        title: 'Official User Guide',
        href: '/user-guide',
        text: 'Read detailed registration prerequisites, required statutory documents, and operating policies.',
        badge: 'Documentation'
      }
    ];
  }, [user?.role, isShg]);

  // Current SOP workflow
  const currentWorkflow = useMemo(() => {
    return SOP_WORKFLOWS.find(w => w.id === activeTab) || SOP_WORKFLOWS[0];
  }, [activeTab]);

  // Search filter
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredSteps = useMemo(() => {
    if (!normalizedQuery) return currentWorkflow.steps;
    return currentWorkflow.steps.filter(step =>
      step.title.toLowerCase().includes(normalizedQuery) ||
      step.description.toLowerCase().includes(normalizedQuery) ||
      step.prerequisites.some(p => p.toLowerCase().includes(normalizedQuery))
    );
  }, [currentWorkflow.steps, normalizedQuery]);

  const filteredDocs = useMemo(() => {
    if (!normalizedQuery) return OFFICIAL_DOCUMENTS;
    return OFFICIAL_DOCUMENTS.filter(doc =>
      doc.name.toLowerCase().includes(normalizedQuery) ||
      doc.category.toLowerCase().includes(normalizedQuery) ||
      doc.description.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const filteredFaqs = useMemo(() => {
    if (!normalizedQuery) return FAQS;
    return FAQS.filter(faq =>
      faq.question.toLowerCase().includes(normalizedQuery) ||
      faq.answer.toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery]);

  const toggleFaq = (index: number) => {
    setExpandedFaqIndex(prev => (prev === index ? null : index));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* 1. Hero Banner: JSG SMILE Brand Identity & Direct Contact */}
      <section
        aria-labelledby="help-desk-heading"
        className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-white via-blue-50/50 to-amber-50/30 p-6 sm:p-8 shadow-sm"
      >
        {/* Decorative ambient background */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-blue-100/50 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
          
            <h1 id="help-desk-heading" className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#0b2447]">
              Help, Standard Procedure and User Support
            </h1>
            <p className="max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
              Official operating guidance for buyers, sellers, MSMEs, SHG producers, and administrators to complete portal workflows with full documentation, statutory auditability, and grievance support.
            </p>
          </div>

          {/* Contact Badges */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center lg:flex-col lg:items-end">
            <div className="flex flex-wrap gap-2">
              <div className="group relative inline-flex items-center rounded-xl bg-[#0b2447] p-1 text-white shadow-sm transition hover:bg-[#12335f]">
                <a
                  href="tel:18001234567"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold tracking-wide uppercase focus-visible:outline-none"
                  aria-label="Call Toll-Free Helpline at 1800-123-4567"
                >
                  <Phone className="h-3.5 w-3.5 text-[#c8a45c]" />
                  <span>1800-123-4567</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('1800-123-4567', 'phone', 'Helpline number')}
                  className="rounded-lg p-1.5 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none"
                  title="Copy Phone Number"
                  aria-label="Copy helpline phone number"
                >
                  {copiedKey === 'phone' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-300" />
                  )}
                </button>
              </div>

              <div className="group relative inline-flex items-center rounded-xl border border-slate-200 bg-white p-1 text-[#0b2447] shadow-2xs transition hover:bg-slate-50">
                <a
                  href="mailto:support@jsgsmile.in"
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wide focus-visible:outline-none"
                  aria-label="Send email to support@jsgsmile.in"
                >
                  <Mail className="h-3.5 w-3.5 text-[#0b2447]" />
                  <span>support@jsgsmile.in</span>
                </a>
                <button
                  type="button"
                  onClick={() => handleCopy('support@jsgsmile.in', 'email', 'Support email')}
                  className="rounded-lg p-1.5 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:outline-none"
                  title="Copy Email Address"
                  aria-label="Copy support email address"
                >
                  {copiedKey === 'email' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
              <Clock className="h-3.5 w-3.5 text-[#c8a45c]" />
              <span>District Desk: Mon–Sat, 9:30 AM – 6:00 PM IST</span>
            </div>
          </div>
        </div>

        {/* Real-time topic search bar */}
        <div className="relative mt-6 z-10">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search procedures, documentation rules, legal policies, or FAQs (e.g. Udyam, 45-day payment, GRN, tender)..."
              className="w-full rounded-2xl border border-slate-200/90 bg-white py-3 pl-10 pr-10 text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-xs focus:border-[#0b2447] focus:outline-none focus:ring-2 focus:ring-[#0b2447]/20"
              aria-label="Search procedures and support topics"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:outline-none"
                aria-label="Clear search input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-xs font-medium text-slate-500" aria-live="polite">
              Filtering results for <span className="font-bold text-slate-800">"{searchQuery}"</span>
            </p>
          )}
        </div>
      </section>

      {/* 2. Role-Aware Dynamic Quick Action Cards */}
      <section aria-labelledby="quick-actions-heading" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="quick-actions-heading" className="text-base font-black text-[#0b2447] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#c8a45c]" />
            Quick Access Actions
            {user?.role && (
              <span className="ml-2 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0b2447] border border-blue-100">
                {user.role === 'admin' || user.role === 'master_admin' ? 'Admin Mode' : isShg ? 'SHG Mode' : `${user.role} Mode`}
              </span>
            )}
          </h2>
          <Link
            href="/user-guide"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#0b2447] hover:text-[#12335f] hover:underline"
          >
            Full Documentation Manual <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.title}
                href={card.href}
                className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:outline-none"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#0b2447] transition group-hover:bg-[#0b2447] group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 group-hover:bg-amber-100 group-hover:text-amber-900 transition">
                      {card.badge}
                    </span>
                  </div>
                  <h3 className="mt-3 text-sm font-black text-slate-900 group-hover:text-[#0b2447]">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-600 line-clamp-3">
                    {card.text}
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-xs font-bold text-[#0b2447] group-hover:translate-x-1 transition-transform duration-200">
                  <span>Open Screen</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Multi-Role Standard Operating Procedure (SOP) & Documentation Standards */}
      <section aria-labelledby="sop-heading" className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        {/* Left Column: Standard Operating Procedures with Tabs */}
        <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#0b2447]" />
                <h2 id="sop-heading" className="text-lg font-black text-[#0b2447]">
                  Standard Operating Procedures (SOP)
                </h2>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                Sequential statutory workflows configured for each stakeholder group.
              </p>
            </div>

            {/* Role Switcher Tabs */}
            <div
              role="tablist"
              aria-label="Stakeholder workflow selector"
              className="flex flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1 border border-slate-200/60"
            >
              {SOP_WORKFLOWS.map((wf) => (
                <button
                  key={wf.id}
                  role="tab"
                  id={`tab-${wf.id}`}
                  aria-selected={activeTab === wf.id}
                  aria-controls={`tabpanel-${wf.id}`}
                  tabIndex={activeTab === wf.id ? 0 : -1}
                  type="button"
                  onClick={() => setActiveTab(wf.id)}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-xs font-bold transition focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:outline-none',
                    activeTab === wf.id
                      ? 'bg-[#0b2447] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  )}
                >
                  {wf.badgeLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Active Tab Description */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-xs font-medium leading-relaxed text-[#0b2447]">
            <span className="font-bold">{currentWorkflow.name}: </span>
            {currentWorkflow.overview}
          </div>

          {/* Sequential Step Cards */}
          <div
            id={`tabpanel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
            className="space-y-3"
          >
            {filteredSteps.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm font-medium text-slate-500">
                No procedures match the search term "{searchQuery}".
              </div>
            ) : (
              filteredSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="grid gap-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:bg-white hover:shadow-sm sm:grid-cols-[44px_1fr]"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-black text-[#0b2447] shadow-xs border border-slate-200/80">
                    {index + 1}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-black text-slate-900">{step.title}</h3>
                      {step.actionHref && (
                        <Link
                          href={step.actionHref}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b2447] hover:underline"
                        >
                          {step.actionLabel || 'Go to page'} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <p className="text-xs font-medium leading-5 text-slate-600">{step.description}</p>
                    {step.prerequisites.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Prerequisites:
                        </span>
                        {step.prerequisites.map((req) => (
                          <span
                            key={req}
                            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                          >
                            {req}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Documentation Standards & Support Escalation */}
        <div className="space-y-6">
          {/* Documentation Standards */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <ShieldCheck className="h-5 w-5 text-[#0b2447]" />
              <div>
                <h2 className="text-base font-black text-[#0b2447]">Documentation Standards</h2>
                <p className="text-[11px] font-medium text-slate-500">Statutory benchmarks for all uploads.</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {DOCUMENTATION_STANDARDS.map((group) => {
                const Icon = group.icon;
                return (
                  <div key={group.title} className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5 text-[#c8a45c]" />
                        {group.title}
                      </h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {group.category}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {group.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-xs font-medium leading-relaxed text-slate-600">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3-Tier Escalation Matrix */}
          <div className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-[#0b2447]" />
                <h2 className="text-base font-black text-[#0b2447]">Support Escalation Matrix</h2>
              </div>
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-900 border border-amber-200">
                SLA Tracked
              </span>
            </div>

            <div className="space-y-3">
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#0b2447]">
                    Level 1 • Portal Technical Helpdesk
                  </span>
                  <span className="text-[10px] font-bold text-slate-600">24-Hr SLA</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  Account login, 2FA, document uploads, cart navigation, and quotation assistance.
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Helpline: 1800-123-4567 • support@jsgsmile.in
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-700">
                    Level 2 • District Industry Centre (DIC) Desk
                  </span>
                  <span className="text-[10px] font-bold text-slate-600">48-Hr SLA</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  Entity onboarding reviews, GST/Udyam discrepancies, tender exceptions, and category clearance.
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Managed by District Nodal Verification Officers.
                </p>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-900">
                    Level 3 • Grievance & Arbitration Committee
                  </span>
                  <span className="text-[10px] font-bold text-amber-800">7-Day SLA</span>
                </div>
                <p className="text-xs font-semibold text-slate-800">
                  Contract disputes, quality defaults, delayed payments beyond MSME 45-day statutory limit, and escrow holds.
                </p>
                <div className="pt-1">
                  <Link
                    href={user?.role === 'admin' ? '/admin/disputes' : '/buyer/disputes'}
                    className="inline-flex items-center gap-1 rounded-md bg-[#0b2447] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#12335f]"
                  >
                    File Formal Grievance / Dispute <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Official Policy & Legal Documents (With In-App PDF Preview) */}
      <section
        aria-labelledby="official-docs-heading"
        className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm space-y-5"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-6 w-6 text-[#0b2447]" />
            <div>
              <h2 id="official-docs-heading" className="text-lg font-black text-[#0b2447]">
                Official Policy & Legal Agreements
              </h2>
              <p className="text-xs font-medium text-slate-500">
                Download or inspect official portal agreements, procurement policies, and statutory compliance frameworks.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-500">
            {filteredDocs.length} Documents Available
          </span>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {filteredDocs.map((doc) => (
            <div
              key={doc.name}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:bg-white hover:shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#0b2447] border border-blue-100">
                    {doc.category}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">PDF</span>
                </div>
                <h3 className="mt-2.5 text-xs font-bold text-slate-900">{doc.name}</h3>
                <p className="mt-1 text-[11px] font-medium leading-relaxed text-slate-500 line-clamp-2">
                  {doc.description}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setPreviewDoc({
                      label: doc.name,
                      url: doc.path,
                      mode: 'pdf'
                    })
                  }
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b2447] hover:underline focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:outline-none"
                  aria-label={`Preview ${doc.name}`}
                >
                  <Eye className="h-3 w-3" /> Preview
                </button>
                <span className="text-slate-300">|</span>
                <a
                  href={doc.path}
                  download
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                  aria-label={`Download ${doc.name}`}
                >
                  <Download className="h-3 w-3" /> Download
                </a>
                <span className="text-slate-300">|</span>
                <a
                  href={doc.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-[11px] font-bold text-slate-400 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                  title="Open in new window"
                  aria-label={`Open ${doc.name} in new window`}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Interactive Frequently Asked Questions (FAQ) Accordion */}
      <section
        aria-labelledby="faq-heading"
        className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <HelpCircle className="h-5 w-5 text-[#0b2447]" />
          <div>
            <h2 id="faq-heading" className="text-lg font-black text-[#0b2447]">
              Frequently Asked Questions (FAQ)
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Clear answers to recurring procedural and statutory questions across the portal.
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {filteredFaqs.map((faq, index) => {
            const isExpanded = expandedFaqIndex === index;
            return (
              <div key={faq.question} className="py-3.5 first:pt-1 last:pb-1">
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="flex w-full items-start justify-between gap-4 text-left font-bold text-slate-900 hover:text-[#0b2447] focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:outline-none rounded-lg p-1"
                  aria-expanded={isExpanded}
                  aria-controls={`faq-answer-${index}`}
                >
                  <span className="text-sm">{faq.question}</span>
                  <ChevronDown
                    className={cn(
                      'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                      isExpanded && 'rotate-180 text-[#0b2447]'
                    )}
                  />
                </button>
                {isExpanded && (
                  <div
                    id={`faq-answer-${index}`}
                    className="mt-2 text-xs font-medium leading-6 text-slate-600 pl-1 pr-4"
                  >
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Modal Preview for PDF Documents */}
      {previewDoc && (
        <DocumentPreviewModal
          previewDocument={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
