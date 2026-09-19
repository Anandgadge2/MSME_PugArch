'use client';

import React, { useMemo, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Copyright,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Headphones,
  HelpCircle,
  Home,
  Info,
  Link2,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Store,
  Ticket,
  Users,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { cn } from '../../../lib/utils';
import { postApi, getApi } from '../../shared/apiClient';
import {
  GtcContent,
  PrivacyPolicyContent,
  SupplierAgreementContent,
  VerificationPolicyContent,
  OrderPlacementPolicyContent,
  OrderCancellationPolicyContent,
  ConsentPolicyContent,
} from '../../../components/registration/LegalDocumentsText';

type PageKey =
  | 'terms'
  | 'privacy'
  | 'verification'
  | 'order-placement'
  | 'cancellation'
  | 'supplier-agreement'
  | 'consent'
  | 'copyright'
  | 'hyperlinks'
  | 'disclaimer'
  | 'caution'
  | 'contact'
  | 'feedback'
  | 'faqs'
  | 'sitemap';

const routeToPage: Record<string, PageKey> = {
  '/contact-us': 'contact',
  '/feedback': 'feedback',
  '/grievance': 'feedback',
  '/sitemap': 'sitemap',
  '/faqs': 'faqs',
  '/faq': 'faqs',
  '/terms-of-use': 'terms',
  '/terms-and-conditions': 'terms',
  '/website-policies': 'privacy',
  '/privacy-policy': 'privacy',
  '/vendor-verification-policy': 'verification',
  '/verification-policy': 'verification',
  '/order-placement-policy': 'order-placement',
  '/procurement-policy': 'order-placement',
  '/refund-cancellation-policy': 'cancellation',
  '/cancellation-policy': 'cancellation',
  '/supplier-agreement': 'supplier-agreement',
  '/registration-agreement': 'supplier-agreement',
  '/data-sharing-consent': 'consent',
  '/consent-policy': 'consent',
  '/copyright': 'copyright',
  '/copyrights': 'copyright',
  '/copyright-policy': 'copyright',
  '/hyperlinks': 'hyperlinks',
  '/hyperlinking-policy': 'hyperlinks',
  '/disclaimer': 'disclaimer',
  '/caution-notice': 'caution',
  '/caution-notices': 'caution',
};

interface OfficialDocumentMeta {
  key: PageKey;
  title: string;
  shortTitle: string;
  badge: string;
  category: string;
  refNo: string;
  effectiveDate: string;
  pdfFilename: string;
  pdfHref: string;
  fileSize: string;
  description: string;
}

const OFFICIAL_DOCS: Record<string, OfficialDocumentMeta> = {
  terms: {
    key: 'terms',
    title: 'Terms & Conditions of Portal Usage (General Terms & Conditions - GTC)',
    shortTitle: 'Terms & Conditions',
    badge: 'Master Agreement',
    category: 'Portal Governance',
    refNo: 'JSG-DIC-GTC-2026/01',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Terms_and_Conditions.pdf',
    pdfHref: '/docs/Terms_and_Conditions.pdf',
    fileSize: '122 KB',
    description: 'Master platform operating terms, stakeholder rights, obligations, and legal framework governing buyers, sellers, and MSMEs.',
  },
  privacy: {
    key: 'privacy',
    title: 'Official Privacy Policy & Data Protection Charter',
    shortTitle: 'Privacy Policy',
    badge: 'Statutory Charter',
    category: 'Data Protection & Security',
    refNo: 'JSG-DIC-PRV-2026/02',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Privacy_Policy_JSG_Smile.pdf',
    pdfHref: '/docs/Privacy_Policy_JSG_Smile.pdf',
    fileSize: '119 KB',
    description: 'Statutory guidelines on personal data handling, encryption, PCI-DSS compliance, and zero-compromise institutional privacy.',
  },
  verification: {
    key: 'verification',
    title: 'Vendor Verification, Empanelment & Approval Policy',
    shortTitle: 'Vendor Verification',
    badge: 'Compliance Standard',
    category: 'Vendor Audit & Screening',
    refNo: 'JSG-DIC-VER-2026/03',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Vendor_Verification_Policy.pdf',
    pdfHref: '/docs/Vendor_Verification_Policy.pdf',
    fileSize: '121 KB',
    description: 'Multi-stage verification protocols, document matrices, desk reviews, field inspections, and due diligence checks for seller approval.',
  },
  'order-placement': {
    key: 'order-placement',
    title: 'Order Placement & Procurement Facilitation Policy',
    shortTitle: 'Order Placement Policy',
    badge: 'Procurement Protocol',
    category: 'Procurement Workflow',
    refNo: 'JSG-DIC-ORD-2026/04',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Order_Placement_Procurement_Policy.pdf',
    pdfHref: '/docs/Order_Placement_Procurement_Policy.pdf',
    fileSize: '115 KB',
    description: 'Official 10-stage procurement lifecycle governing RFQ issuance, quotation submission, evaluation, purchase orders, and settlements.',
  },
  cancellation: {
    key: 'cancellation',
    title: 'Order Cancellation, Withdrawal & Refund Policy',
    shortTitle: 'Cancellation & Refund',
    badge: 'Commercial Terms',
    category: 'Orders & Financial Settlements',
    refNo: 'JSG-DIC-REF-2026/05',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Order_Cancellation_Refund_Policy.pdf',
    pdfHref: '/docs/Order_Cancellation_Refund_Policy.pdf',
    fileSize: '118 KB',
    description: 'Transparent 6-stage framework governing contract withdrawal, order cancellation penalties, return verification, and escrow refunding.',
  },
  'supplier-agreement': {
    key: 'supplier-agreement',
    title: 'MSME Registration & Supplier Participation Agreement',
    shortTitle: 'Supplier Agreement',
    badge: 'MSME Contract',
    category: 'Seller & SHG Onboarding',
    refNo: 'JSG-DIC-SPA-2026/06',
    effectiveDate: '30 July 2026',
    pdfFilename: 'MSME_Registration_Supplier_Participation_Agreement.pdf',
    pdfHref: '/docs/MSME_Registration_Supplier_Participation_Agreement.pdf',
    fileSize: '117 KB',
    description: 'Statutory rights, code of conduct, manufacturing disclosures, and performance standards for registered MSME suppliers in Jharsuguda.',
  },
  consent: {
    key: 'consent',
    title: 'Data Sharing Consent & User Authorization Agreement',
    shortTitle: 'Data Sharing Consent',
    badge: 'Statutory Consent',
    category: 'Regulatory Verification',
    refNo: 'JSG-DIC-DSC-2026/07',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Data_Sharing_Consent_Agreement.pdf',
    pdfHref: '/docs/Data_Sharing_Consent_Agreement.pdf',
    fileSize: '119 KB',
    description: 'Formal user authorization charter empowering validation with GSTN, Udyam, PAN, and scheduled commercial banking APIs.',
  },
  disclaimer: {
    key: 'disclaimer',
    title: 'Public Procurement & Institutional Disclaimer',
    shortTitle: 'Disclaimer',
    badge: 'Statutory Disclaimer',
    category: 'Legal Notice',
    refNo: 'JSG-DIC-DIS-2026/08',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Terms_and_Conditions.pdf',
    pdfHref: '/docs/Terms_and_Conditions.pdf',
    fileSize: '122 KB',
    description: 'Demarcation of administrative facilitation vs commercial buyer-seller contract, technical uptime, and limitation of liability.',
  },
  copyright: {
    key: 'copyright',
    title: 'Intellectual Property, Trademark & Copyright Policy',
    shortTitle: 'Copyright Policy',
    badge: 'IP Policy',
    category: 'Intellectual Property',
    refNo: 'JSG-DIC-CPY-2026/09',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Terms_and_Conditions.pdf',
    pdfHref: '/docs/Terms_and_Conditions.pdf',
    fileSize: '122 KB',
    description: 'Ownership of portal design, trademarks, logos, document schemas, and fair use guidelines for government and public data.',
  },
  hyperlinks: {
    key: 'hyperlinks',
    title: 'Hyperlinking & Third-Party Integration Policy (GIGW Compliant)',
    shortTitle: 'Hyperlinking Policy',
    badge: 'Web Standard',
    category: 'Technical Compliance',
    refNo: 'JSG-DIC-HYP-2026/10',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Terms_and_Conditions.pdf',
    pdfHref: '/docs/Terms_and_Conditions.pdf',
    fileSize: '122 KB',
    description: 'Guidelines on external links, inbound deep-linking, framing restrictions, and security under Indian Government Web Standards.',
  },
  caution: {
    key: 'caution',
    title: 'Caution Notice Against Fraud, Phishing & Fake Solicitations',
    shortTitle: 'Caution Notice',
    badge: 'Public Advisory',
    category: 'Anti-Fraud Alert',
    refNo: 'JSG-DIC-CAU-2026/11',
    effectiveDate: '30 July 2026',
    pdfFilename: 'Terms_and_Conditions.pdf',
    pdfHref: '/docs/Terms_and_Conditions.pdf',
    fileSize: '122 KB',
    description: 'Statutory advisory cautioning stakeholders against fraudulent websites, unofficial payment links, and fake procurement awards.',
  },
};

const LEGAL_TABS = [
  { key: 'terms' as const, label: 'Terms of Use', href: '/terms-of-use' },
  { key: 'privacy' as const, label: 'Privacy Policy', href: '/privacy-policy' },
  { key: 'verification' as const, label: 'Vendor Verification', href: '/vendor-verification-policy' },
  { key: 'order-placement' as const, label: 'Order Placement', href: '/order-placement-policy' },
  { key: 'cancellation' as const, label: 'Cancellation & Refund', href: '/refund-cancellation-policy' },
  { key: 'supplier-agreement' as const, label: 'Supplier Agreement', href: '/supplier-agreement' },
  { key: 'consent' as const, label: 'Data Sharing Consent', href: '/data-sharing-consent' },
  { key: 'disclaimer' as const, label: 'Disclaimer', href: '/disclaimer' },
  { key: 'copyright' as const, label: 'Copyright', href: '/copyright' },
  { key: 'hyperlinks' as const, label: 'Hyperlinking', href: '/hyperlinking-policy' },
  { key: 'caution' as const, label: 'Caution Notice', href: '/caution-notice' },
];

export default function PublicInfoPage() {
  const pathname = usePathname() || '/terms-of-use';
  const page = routeToPage[pathname] || 'terms';
  const isLegalDoc = Object.keys(OFFICIAL_DOCS).includes(page);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-[#0b2447] selection:text-white">
      {/* Institutional Top Hero Banner */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#030d1c] via-[#071d3a] to-[#0a2540] text-white border-b border-slate-800">
        {/* Glow ambient effects */}
        <div className="absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-blue-500/10 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 h-80 w-80 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />

        <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:py-10 2xl:px-8 relative z-10">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-400">
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span>Portal Home</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <Link href="/terms-of-use" className="hover:text-white transition-colors">
              <span>Governance & Legal</span>
            </Link>
            <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
            <span className="text-sky-400 font-bold" aria-current="page">
              {isLegalDoc ? OFFICIAL_DOCS[page]?.shortTitle : page === 'contact' ? 'Contact Secretariat' : page === 'feedback' ? 'Grievance Redressal' : page === 'faqs' ? 'Knowledge Base (FAQs)' : 'Portal Sitemap'}
            </span>
          </nav>

          {/* Heading & Institutional Credentials */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black text-sky-300 border border-blue-400/30">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>GOVERNMENT OF ODISHA • DISTRICT INDUSTRIES CENTRE, JHARSUGUDA</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                {isLegalDoc
                  ? OFFICIAL_DOCS[page]?.title
                  : page === 'contact'
                  ? 'District Secretariat & MSME Facilitation Cell'
                  : page === 'feedback'
                  ? 'Grievance Redressal & Citizen Feedback System'
                  : page === 'faqs'
                  ? 'Frequently Asked Questions & Support Directory'
                  : 'JSG SMILE Enterprise Portal Sitemap'}
              </h1>
              <p className="max-w-4xl text-xs sm:text-sm font-medium leading-relaxed text-slate-300">
                {isLegalDoc
                  ? OFFICIAL_DOCS[page]?.description
                  : page === 'contact'
                  ? 'Official contact directory for the District Administration, DIC Jharsuguda, MSME facilitation desk, vendor empanelment team, and statutory legal cell.'
                  : page === 'feedback'
                  ? 'Statutory redressal portal for MSMEs, large industry buyers, and SHGs. Lodged issues are reviewed by the District MSME Cell under the Odisha Right to Public Services Act (ORTPSA).'
                  : page === 'faqs'
                  ? 'Comprehensive operational, procedural, and compliance guidance covering onboarding, procurement modes, reverse auctions, GRN, and statutory MSME payments.'
                  : 'Complete architectural directory and deep links to all marketplace, procurement, onboarding, compliance, and governance portals.'}
              </p>
            </div>

            {/* Header Right Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
              {isLegalDoc && (
                <>
                  <a
                    href={OFFICIAL_DOCS[page]?.pdfHref}
                    download={OFFICIAL_DOCS[page]?.pdfFilename}
                    className="inline-flex items-center gap-2 rounded-xl bg-white text-slate-900 px-4 py-2.5 text-xs font-black hover:bg-slate-100 shadow-md transition-all active:scale-95"
                    title="Download Verified Government PDF"
                  >
                    <Download className="h-4 w-4 text-emerald-600" />
                    <span>Download PDF ({OFFICIAL_DOCS[page]?.fileSize})</span>
                  </a>
                  <a
                    href={OFFICIAL_DOCS[page]?.pdfHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600/20 border border-blue-400/30 text-sky-200 px-4 py-2.5 text-xs font-bold hover:bg-blue-600/30 transition-all"
                  >
                    <ExternalLink className="h-4 w-4 text-sky-400" />
                    <span>Open in New Tab</span>
                  </a>
                </>
              )}
              <Link
                href="/contact-us"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 px-4 py-2.5 text-xs font-bold hover:bg-slate-800 hover:text-white transition-all"
              >
                <Phone className="h-4 w-4 text-emerald-400" />
                <span>Helpline: 1800-345-7111</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Legal Horizontal Tab Switcher (Visible on all legal/policy pages) */}
        {isLegalDoc && (
          <div className="border-t border-slate-800/90 bg-black/30 backdrop-blur-md">
            <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8">
              <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 scrollbar-none">
                {LEGAL_TABS.map((tab) => {
                  const isActive = page === tab.key;
                  return (
                    <Link
                      key={tab.key}
                      href={tab.href}
                      className={cn(
                        'shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all',
                        isActive
                          ? 'bg-[#12335f] text-white shadow-sm ring-1 ring-blue-400/40'
                          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                      )}
                    >
                      {tab.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Main Content Area */}
      <div className="mx-auto max-w-[1680px] px-4 py-8 sm:px-6 lg:py-10 2xl:px-8">
        {isLegalDoc && <LegalDocumentReader activeKey={page} />}
        {page === 'contact' && <ContactUsView />}
        {page === 'feedback' && <GrievanceFeedbackView />}
        {page === 'faqs' && <KnowledgeBaseFaqView />}
        {page === 'sitemap' && <EnterpriseSitemapView />}
      </div>

      {/* Official Footer Strip */}
      <MarketplaceFooter />
    </div>
  );
}

/* =========================================================================
   1. LEGAL & POLICY DOCUMENT READER COMPONENT
   ========================================================================= */

function LegalDocumentReader({ activeKey }: { activeKey: PageKey }) {
  const doc = OFFICIAL_DOCS[activeKey] || OFFICIAL_DOCS.terms;
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success('Document URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr] xl:grid-cols-[340px_1fr]">
      {/* Left Sidebar: Document Metadata & Quick Actions */}
      <aside className="space-y-6">
        {/* Document Status Box */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">Document Dossier</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> Statutory Enacted
            </span>
          </div>

          <div className="space-y-2.5 text-xs font-semibold text-slate-700">
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Issuing Authority</p>
              <p className="text-slate-900 font-bold">District Industries Centre (DIC), Jharsuguda</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Jurisdiction & Scope</p>
              <p className="text-slate-900">District Jharsuguda, Government of Odisha</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Statutory Reference No.</p>
              <code className="text-[11px] font-mono font-bold text-[#0b2447] bg-slate-100 px-1.5 py-0.5 rounded">
                {doc.refNo}
              </code>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Effective Since</p>
              <p className="text-slate-900">{doc.effectiveDate}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-slate-400">Current Revision</p>
              <p className="text-slate-900">v2.4 (Statutory Review 2026)</p>
            </div>
          </div>

          {/* Quick PDF Action */}
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <a
              href={doc.pdfHref}
              download={doc.pdfFilename}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#0b2447] text-white py-2.5 text-xs font-bold hover:bg-[#12335f] transition-all"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Download PDF ({doc.fileSize})</span>
            </a>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              <Printer className="h-3.5 w-3.5 text-slate-500" />
              <span>Print / Save Copy</span>
            </button>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copied ? 'Link Copied' : 'Share Document URL'}</span>
            </button>
          </div>
        </div>

        {/* Pre-Requisites Checklist Download Cards */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <FileCheck2 className="h-4 w-4 text-[#0b2447]" />
            Onboarding Pre-Requisites
          </h3>
          <p className="text-[11px] font-medium text-slate-500 leading-relaxed">
            Official checklists detailing mandatory documents, resolutions, and declarations required for verified registration.
          </p>
          <ul className="space-y-2 pt-1">
            {[
              {
                label: 'Buyer Onboarding Guide',
                href: '/docs/Buyer_Onboarding_Pre_Requisites.pdf',
                file: 'Buyer_Onboarding_Pre_Requisites.pdf',
              },
              {
                label: 'MSME Seller Checklist',
                href: '/docs/Seller_Onboarding_Pre_Requisites.pdf',
                file: 'Seller_Onboarding_Pre_Requisites.pdf',
              },
              {
                label: 'Women SHG Registration Guide',
                href: '/docs/SHG_Onboarding_Pre_Requisites.pdf',
                file: 'SHG_Onboarding_Pre_Requisites.pdf',
              },
              {
                label: 'MSME Registration Pre-Requisites',
                href: '/MSME_Registration_Pre_Requisites_PugArch.pdf',
                file: 'MSME_Registration_Pre_Requisites_PugArch.pdf',
              },
            ].map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  download={item.file}
                  className="group flex items-center justify-between rounded-xl bg-slate-50 p-2.5 text-xs font-bold text-slate-700 hover:bg-blue-50 hover:text-[#0b2447] border border-slate-200/80 transition-all"
                >
                  <span className="truncate pr-2">{item.label}</span>
                  <Download className="h-3.5 w-3.5 text-slate-400 group-hover:text-[#0b2447] shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Institutional Contact Badge */}
        <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-[#0b2447]">
            <Headphones className="h-4 w-4 text-blue-600" />
            <span>Need Legal / Policy Clarification?</span>
          </div>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            Write to the District Information Manager at{' '}
            <a href="mailto:legal@jsgsmile.in" className="font-bold text-[#0b2447] underline">
              legal@jsgsmile.in
            </a>{' '}
            or call toll free at{' '}
            <a href="tel:18003457111" className="font-bold text-[#0b2447]">
              1800-345-7111
            </a>
            .
          </p>
        </div>
      </aside>

      {/* Right Column: High-Contrast Official Legal Reader */}
      <main className="space-y-6">
        {/* Document In-Page Search Bar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm flex items-center gap-3">
          <Search className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search within ${doc.shortTitle} (e.g. payment, 45 days, inspection, refund)...`}
            className="w-full text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none bg-transparent"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2 shrink-0"
            >
              Clear
            </button>
          )}
        </div>

        {/* Paper-Style Reader Card */}
        <div
          ref={contentRef}
          className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm relative overflow-hidden"
        >
          {/* Official Emblem & Header Stamp */}
          <div className="border-b-2 border-slate-900 pb-6 mb-8 text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#0b2447]">
              <span>Government of Odisha</span>
              <span>•</span>
              <span>District Industries Centre (DIC), Jharsuguda</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
              {doc.title}
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-500 pt-1">
              <span>Portal: www.jsgsmile.in</span>
              <span>•</span>
              <span>Ref No: {doc.refNo}</span>
              <span>•</span>
              <span>Effective Date: {doc.effectiveDate}</span>
            </div>
          </div>

          {/* Actual Official Legal Text Rendering */}
          <div className="legal-document-body">
            {activeKey === 'terms' && <GtcContent />}
            {activeKey === 'privacy' && <PrivacyPolicyContent />}
            {activeKey === 'verification' && <VerificationPolicyContent />}
            {activeKey === 'order-placement' && <OrderPlacementPolicyContent />}
            {activeKey === 'cancellation' && <OrderCancellationPolicyContent />}
            {activeKey === 'supplier-agreement' && <SupplierAgreementContent />}
            {activeKey === 'consent' && <ConsentPolicyContent />}
            {activeKey === 'disclaimer' && <DisclaimerPolicyText />}
            {activeKey === 'copyright' && <CopyrightPolicyText />}
            {activeKey === 'hyperlinks' && <HyperlinkPolicyText />}
            {activeKey === 'caution' && <CautionNoticeText />}
          </div>

          {/* Official Seal & Authentication Block */}
          <div className="mt-12 pt-8 border-t border-slate-200 bg-slate-50/80 -mx-6 sm:-mx-10 -mb-6 sm:-mb-10 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-left">
              <div className="h-10 w-10 rounded-xl bg-[#0b2447] text-white flex items-center justify-center font-black text-sm shrink-0">
                DIC
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 uppercase">
                  Certified Authentic Statutory Document
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Issued under the authority of District Industries Centre, Jharsuguda, Government of Odisha.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <a
                href={doc.pdfHref}
                download={doc.pdfFilename}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b2447] hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Signed PDF</span>
              </a>
              <span className="text-slate-300">•</span>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print Copy</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================================
   2. ADDITIONAL OFFICIAL POLICY TEXTS (Disclaimer, Copyright, Hyperlink, Caution)
   ========================================================================= */

function DisclaimerPolicyText() {
  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">
      <h3 className="text-sm font-black text-[#0b2447] mt-4 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        1. NATURE OF THE FACILITATION PLATFORM
      </h3>
      <p>
        The JSG SMILE Portal (www.jsgsmile.in) is an institutional procurement facilitation platform established under the guidance of the District Industries Centre (DIC), Jharsuguda, Government of Odisha. The Portal is developed to bridge Micro, Small and Medium Enterprises (MSMEs) and Self-Help Groups (SHGs) with institutional and large enterprise buyers operating within and around Jharsuguda District.
      </p>
      <p>
        All marketplace entries, catalogue specifications, pricing quotations, and commercial terms are published directly by the concerned registered buyers, sellers, or contractors. While the District Administration and Technology Partner enforce multi-tier identity audits (Udyam, GSTIN, PAN, and banking verification), the District Administration does not act as an insurer, guarantor, buyer, or seller in individual commercial transactions.
      </p>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        2. INDEPENDENT BUYER &amp; SELLER RESPONSIBILITY
      </h3>
      <ul className="space-y-1.5 pl-2 my-2">
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span><strong>Quality &amp; Specifications:</strong> Buyers must inspect physical goods and issue a formal Goods Receipt Note (GRN) upon verified delivery. The Portal is not liable for latent defects or specification deviations.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span><strong>Statutory MSME Payments:</strong> In accordance with Section 15 of the MSMED Act 2006, payment settlements must be executed by buyers within 45 days. Delayed payment penal interest remains the legal liability of the defaulting buyer.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span><strong>Commercial Contracts:</strong> Purchase orders, work orders, and rate contracts executed through the Portal constitute binding bilateral agreements between the concerned buyer and seller.</span>
        </li>
      </ul>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        3. LIMITATION OF LIABILITY
      </h3>
      <p>
        The District Collectorate Jharsuguda, District Industries Centre, Government of Odisha, and the Portal Technology Operator shall not be held liable for any indirect, incidental, or consequential losses, business interruptions, telecommunication failures, or cyber incidents beyond reasonable institutional control.
      </p>
    </div>
  );
}

function CopyrightPolicyText() {
  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">
      <h3 className="text-sm font-black text-[#0b2447] mt-4 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        1. INTELLECTUAL PROPERTY RIGHTS
      </h3>
      <p>
        All content, structural database schemas, software algorithms, graphic designs, logos, statutory document templates, workflows, and visual interfaces appearing on the JSG SMILE Portal are the exclusive intellectual property of the District Administration Jharsuguda / District Industries Centre, Government of Odisha, or licensed under valid authorisations.
      </p>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        2. PERMITTED FAIR USE &amp; ACKNOWLEDGEMENT
      </h3>
      <p>
        Materials published on this Portal may be reproduced, cited, or downloaded without formal royalty fees solely for lawful personal, educational, statutory, or internal enterprise procurement evaluation, provided that:
      </p>
      <ul className="space-y-1.5 pl-2 my-2">
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span>The material is reproduced accurately and not used in a misleading or derogatory context.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span>The source is prominently acknowledged as <em>"JSG SMILE — District Industries Centre, Jharsuguda, Government of Odisha"</em>.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span>Seller product catalogues, trademarks, and technical drawings remain the property of the respective uploading enterprise.</span>
        </li>
      </ul>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        3. RESTRICTIONS
      </h3>
      <p>
        Commercial re-packaging, systematic automated scraping, unauthorized mirroring, or white-label redistribution of the Portal database, seller rosters, or procurement records without prior written consent from the General Manager, DIC Jharsuguda, is strictly prohibited and subject to legal prosecution under the Indian Copyright Act, 1957 and Information Technology Act, 2000.
      </p>
    </div>
  );
}

function HyperlinkPolicyText() {
  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">
      <h3 className="text-sm font-black text-[#0b2447] mt-4 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        1. LINKS TO JSG SMILE FROM THIRD-PARTY SITES
      </h3>
      <p>
        We welcome hyperlinks to the public pages of the JSG SMILE Portal (www.jsgsmile.in) from state government portals, educational institutes, industrial chambers (FICCI, CII, UCCI), and registered enterprises. Prior permission is not required to link to the public homepage or category catalogues, provided:
      </p>
      <ul className="space-y-1.5 pl-2 my-2">
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span>The link must open in a complete, full-screen browser window (no framing or masking).</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span>The linking context must not misrepresent affiliation, official sponsorship, or commercial endorsement by the District Administration without explicit sanction.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-[#0b2447] font-bold shrink-0">•</span>
          <span>Deep links directly to login gates or authenticated action endpoints are strictly restricted.</span>
        </li>
      </ul>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        2. EXTERNAL LINKS FROM JSG SMILE
      </h3>
      <p>
        Throughout the Portal, external hyperlinks are provided for user convenience to portals such as Udyam Registration (udyamregistration.gov.in), GST Portal (gst.gov.in), GeM (gem.gov.in), Samadhaan, and State Department portals. The District Administration Jharsuguda does not guarantee continuous availability, data integrity, or privacy policies of external third-party destinations.
      </p>
    </div>
  );
}

function CautionNoticeText() {
  return (
    <div className="space-y-4 font-sans text-xs sm:text-sm text-slate-700 leading-relaxed">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-amber-900">
          <p className="font-bold">PUBLIC STATUTORY ADVISORY</p>
          <p className="leading-relaxed">
            Stakeholders must exercise utmost vigilance against fraudulent agents, imitation websites, and spurious letters demanding unofficial fees in the name of DIC Jharsuguda or JSG SMILE.
          </p>
        </div>
      </div>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        1. ZERO UNSECURED CASH / PERSONAL UPI PAYMENTS
      </h3>
      <p>
        The JSG SMILE Portal and District Industries Centre (DIC) Jharsuguda <strong>NEVER</strong> demand cash payments, personal GooglePay/PhonePe transfers, or WhatsApp-based fee collections for vendor registration, verification, or procurement awards.
      </p>
      <ul className="space-y-1.5 pl-2 my-2">
        <li className="flex items-start gap-2">
          <span className="text-red-600 font-bold shrink-0">✕</span>
          <span><strong>Registration is 100% Free:</strong> No fee is charged for MSME or SHG registration on the Portal.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-600 font-bold shrink-0">✕</span>
          <span><strong>Never Disclose OTPs or PINs:</strong> District officials will never call asking for SMS OTPs, passwords, or net banking credentials.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="text-red-600 font-bold shrink-0">✕</span>
          <span><strong>Fake Tender Awards:</strong> Any purchase order or award letter issued outside the authentic logged-in portal dashboard is fraudulent and null/void.</span>
        </li>
      </ul>

      <h3 className="text-sm font-black text-[#0b2447] mt-6 mb-2 border-l-4 border-[#0b2447] pl-3 uppercase tracking-wide">
        2. REPORTING SUSPECTED FRAUD
      </h3>
      <p>
        If you encounter any suspicious caller, fraudulent domain, or forged award letter claiming to represent JSG SMILE, report it immediately to:
      </p>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs font-semibold text-slate-800">
        <p>• <strong>District MSME Cell Hotline:</strong> 1800-345-7111 / +91 (06645) 272-100</p>
        <p>• <strong>Official Email:</strong> support@jsgsmile.in / legal@jsgsmile.in</p>
        <p>• <strong>National Cyber Crime Reporting Helpline:</strong> 1930 (cybercrime.gov.in)</p>
      </div>
    </div>
  );
}

/* =========================================================================
   3. CONTACT US VIEW
   ========================================================================= */

function ContactUsView() {
  const [inquirySent, setInquirySent] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    entity: '',
    role: 'seller',
    subject: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInquirySent(true);
    toast.success('Your inquiry has been submitted. Our MSME Cell will contact you within 24 business hours.');
  };

  return (
    <div className="space-y-10">
      {/* Top Directory Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card 1: District Secretariat */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-[#0b2447] border border-blue-100">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">District Secretariat</h3>
              <p className="text-[11px] text-slate-500 font-medium">District Collectorate, Jharsuguda</p>
            </div>
          </div>
          <div className="space-y-2 text-xs text-slate-600 font-medium leading-relaxed">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span>Collectorate Campus, Jharsuguda, Odisha — 768201</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <span>+91 (06645) 272-100 / 1800-345-7111</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <a href="mailto:support@jsgsmile.in" className="text-[#0b2447] font-bold hover:underline">
                support@jsgsmile.in
              </a>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <strong>Timings:</strong> 9:00 AM – 6:00 PM (Mon–Sat)
          </div>
        </div>

        {/* Card 2: DIC Facilitation Cell */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">MSME Facilitation Desk</h3>
              <p className="text-[11px] text-slate-500 font-medium">District Industries Centre (DIC)</p>
            </div>
          </div>
          <div className="space-y-2 text-xs text-slate-600 font-medium leading-relaxed">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span>DIC Office, Industrial Estate, Jharsuguda — 768203</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <span>1800-345-7111 (Ext. 201)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <a href="mailto:verification@jsgsmile.in" className="text-emerald-700 font-bold hover:underline">
                verification@jsgsmile.in
              </a>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <strong>Services:</strong> Udyam onboarding, desk audits &amp; catalogue support.
          </div>
        </div>

        {/* Card 3: Women SHG & HerSHG Cell */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-700 border border-violet-100">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">HerSHG Enterprise Desk</h3>
              <p className="text-[11px] text-slate-500 font-medium">Mission Shakti &amp; WSHG Linkages</p>
            </div>
          </div>
          <div className="space-y-2 text-xs text-slate-600 font-medium leading-relaxed">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
              <span>DRDA Building, Collectorate Complex, Jharsuguda</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <span>1800-345-7111 (Ext. 305)</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <a href="mailto:shg-support@jsgsmile.in" className="text-violet-700 font-bold hover:underline">
                shg-support@jsgsmile.in
              </a>
            </div>
          </div>
          <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500">
            <strong>Support:</strong> Artisan onboarding, canteen tenders &amp; bulk supply.
          </div>
        </div>
      </div>

      {/* Inquiry Form & Map Section */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Contact Form */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tight">
              Request Direct Facilitation / Assistance
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Submit your inquiry and the District MSME Cell will connect with your authorized representative.
            </p>
          </div>

          {inquirySent ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
              <h3 className="text-base font-black text-emerald-900">Inquiry Received Successfully</h3>
              <p className="text-xs font-semibold text-emerald-700 max-w-md mx-auto">
                Thank you, {formData.name}. Your inquiry has been forwarded to the District Industries Centre, Jharsuguda. An officer will review your request and get back to {formData.email} shortly.
              </p>
              <button
                type="button"
                onClick={() => {
                  setInquirySent(false);
                  setFormData({ name: '', email: '', phone: '', entity: '', role: 'seller', subject: '', message: '' });
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#0b2447] text-white px-5 py-2 text-xs font-bold hover:bg-[#12335f]"
              >
                Submit Another Request
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="inquiry-name" className="block text-xs font-bold text-slate-700 mb-1">
                    Your Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="inquiry-name"
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="inquiry-phone" className="block text-xs font-bold text-slate-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="inquiry-phone"
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="inquiry-email" className="block text-xs font-bold text-slate-700 mb-1">
                    Official Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="inquiry-email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="name@company.com"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="inquiry-role" className="block text-xs font-bold text-slate-700 mb-1">
                    Stakeholder Role <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="inquiry-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none bg-white"
                  >
                    <option value="seller">MSME Supplier / Manufacturer</option>
                    <option value="buyer">Enterprise / Institutional Buyer</option>
                    <option value="shg">Self-Help Group (SHG)</option>
                    <option value="public">General Public / Citizen</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="inquiry-subject" className="block text-xs font-bold text-slate-700 mb-1">
                  Subject / Topic of Assistance <span className="text-red-500">*</span>
                </label>
                <input
                  id="inquiry-subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Udyam document verification status or RFQ assistance"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>

              <div>
                <label htmlFor="inquiry-message" className="block text-xs font-bold text-slate-700 mb-1">
                  Detailed Inquiry / Requirements <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="inquiry-message"
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Please describe your requirements, enterprise details, or issue..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0b2447] text-white px-6 py-2.5 text-xs font-bold hover:bg-[#12335f] transition-all shadow-sm"
                >
                  <span>Submit Inquiry to DIC Cell</span>
                  <Send className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Operating Protocol & Helpline Box */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 text-sky-600" />
              Operational Timings &amp; Protocols
            </h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              The District MSME Facilitation Cell operates under official Government of Odisha working schedules. All statutory verifications and procurement escalations are processed in accordance with official administrative calendars.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 text-xs">
                <span className="font-bold text-slate-700">Official Helpdesk Hours</span>
                <span className="font-black text-[#0b2447]">Monday – Saturday: 9:00 AM – 6:00 PM IST</span>
              </div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 text-xs">
                <span className="font-bold text-slate-700">Closed On</span>
                <span className="font-semibold text-slate-500">2nd &amp; 4th Saturdays, Sundays, Gazetted Holidays</span>
              </div>
              <div className="flex items-start justify-between border-b border-slate-100 pb-2.5 text-xs">
                <span className="font-bold text-slate-700">Physical Walk-in Desk</span>
                <span className="font-semibold text-slate-800">10:30 AM – 4:00 PM (Monday to Friday)</span>
              </div>
              <div className="flex items-start justify-between text-xs">
                <span className="font-bold text-slate-700">Statutory SLA Commitment</span>
                <span className="font-bold text-emerald-700">ORTPSA 24-48 Hours Initial Response</span>
              </div>
            </div>
          </div>

          {/* Emergency Helpline Glass Box */}
          <div className="rounded-2xl bg-gradient-to-br from-[#030d1c] to-[#0b2447] text-white p-6 shadow-md space-y-3 border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                Toll Free District Hotline
              </span>
              <Headphones className="h-5 w-5 text-sky-400" />
            </div>
            <a
              href="tel:18003457111"
              className="block text-2xl sm:text-3xl font-black text-white hover:text-sky-300 transition-colors tracking-tight"
            >
              1800-345-7111
            </a>
            <p className="text-xs text-slate-300 font-medium">
              Call toll free from any mobile or landline network across India for real-time onboarding, bidding, or payment assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================================
   4. GRIEVANCE REDRESSAL & CITIZEN FEEDBACK VIEW
   ========================================================================= */

function GrievanceFeedbackView() {
  const [activeTab, setActiveTab] = useState<'lodge' | 'track'>('lodge');
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [complainantEmail, setComplainantEmail] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Track State
  const [trackRef, setTrackRef] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [trackedRecord, setTrackedRecord] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    category: 'Micro, Small or Medium Enterprise (MSME)',
    type: 'Vendor Verification / Approval Delay',
    name: '',
    email: '',
    mobile: '',
    orgName: '',
    referenceNumber: '',
    priority: 'normal',
    subject: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await postApi<{ success: boolean; ticketNumber: string; message: string }>('/api/public/grievances', {
        category: formData.category,
        type: formData.type,
        name: formData.name.trim(),
        email: formData.email.trim(),
        mobile: formData.mobile.trim(),
        orgName: formData.orgName.trim(),
        referenceNumber: formData.referenceNumber.trim(),
        priority: formData.priority,
        subject: formData.subject.trim(),
        description: formData.description.trim()
      });

      const assignedNumber = res.ticketNumber;
      setTicketId(assignedNumber);
      setComplainantEmail(formData.email.trim());
      toast.success(res.message || `Grievance registered. Reference ID: ${assignedNumber}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit grievance. Please verify that all required fields are correctly completed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTrackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackRef.trim()) return;
    setIsTracking(true);
    setTrackedRecord(null);
    try {
      const res = await getApi<any>(`/api/public/grievances/track/${encodeURIComponent(trackRef.trim())}`);
      setTrackedRecord(res);
      toast.success('Grievance status record retrieved.');
    } catch (err: any) {
      toast.error(err?.message || 'No record found with this reference ID. Please check the number and retry.');
    } finally {
      setIsTracking(false);
    }
  };

  const handleCopyTicket = () => {
    if (ticketId && typeof window !== 'undefined') {
      navigator.clipboard.writeText(ticketId);
      setCopied(true);
      toast.success('Ticket ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* SLA Commitment Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-[#0b2447] tracking-wider">
          <Scale className="h-4 w-4 text-blue-600" />
          <span>Odisha Right to Public Services Act (ORTPSA) Redressal Charter</span>
        </div>
        <p className="text-xs font-medium text-slate-700 leading-relaxed">
          Grievances submitted through this portal are directly registered with the District MSME Cell, Collectorate Jharsuguda. Under statutory guidelines, complaints receive an automated tracking reference immediately, with nodal officer intervention within 24–48 hours and formal resolution target within 3 to 7 working days. All resolutions and official administrative replies are dispatched to the registered email address.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="flex items-center justify-center">
        <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1.5 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('lodge')}
            className={`rounded-xl px-6 py-2.5 text-xs font-black transition-all ${
              activeTab === 'lodge'
                ? 'bg-white text-[#0b2447] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Lodge Formal Grievance
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('track')}
            className={`rounded-xl px-6 py-2.5 text-xs font-black transition-all ${
              activeTab === 'track'
                ? 'bg-white text-[#0b2447] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Track Existing Grievance
          </button>
        </div>
      </div>

      {activeTab === 'track' ? (
        /* Track Existing Grievance View */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Track Grievance Status &amp; Administrative Reply
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Enter your official Reference ID (e.g., JSG-GRV-2026-XXXXX) to check current investigation progress, SLA status, and resolution remarks.
            </p>
          </div>

          <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={trackRef}
              onChange={(e) => setTrackRef(e.target.value)}
              placeholder="e.g. JSG-GRV-2026-12345"
              className="h-11 flex-1 rounded-xl border border-slate-300 px-4 text-xs font-mono font-bold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none uppercase"
            />
            <button
              type="submit"
              disabled={isTracking || !trackRef.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b2447] px-6 py-3 text-xs font-bold text-white hover:bg-[#12335f] transition shadow disabled:opacity-60"
            >
              {isTracking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span>Track Grievance</span>
            </button>
          </form>

          {trackedRecord && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 space-y-5 animate-in fade-in">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Ticket Reference</span>
                  <p className="font-mono text-lg font-black text-[#0b2447]">{trackedRecord.ticketNumber}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Current Status</span>
                  <div>
                    <span className="inline-block mt-0.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-black uppercase text-blue-900">
                      {trackedRecord.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">Subject</span>
                  <p className="mt-0.5 text-slate-900">{trackedRecord.subject}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">Category</span>
                  <p className="mt-0.5 text-slate-800">{trackedRecord.category}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">Lodged At</span>
                  <p className="mt-0.5 text-slate-800">{new Date(trackedRecord.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-black">Statutory SLA Target</span>
                  <p className="mt-0.5 text-slate-800">{new Date(trackedRecord.slaDueAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Official Resolution / Reply Remarks */}
              {trackedRecord.resolutionRemarks ? (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Official Administrative Resolution &amp; Reply
                    </span>
                    {trackedRecord.resolvedAt && (
                      <span className="text-[10px] font-semibold text-emerald-700">
                        {new Date(trackedRecord.resolvedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-800 font-normal leading-relaxed whitespace-pre-line">
                    {trackedRecord.resolutionRemarks}
                  </p>
                  <p className="text-[10px] font-bold text-emerald-800 pt-1">
                    ✓ A formal resolution certificate and reply copy was dispatched via registered email.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-900 font-medium">
                  <strong>Notice:</strong> This grievance is currently under examination by the designated Nodal Officer. Official findings and resolution remarks will be delivered to your registered email upon conclusion.
                </div>
              )}
            </div>
          )}
        </div>
      ) : ticketId ? (
        /* Grievance Submission Confirmation Card */
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-6 text-center animate-in zoom-in-95 duration-200">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-8 w-8" />
          </div>

          <div className="space-y-1">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              Grievance Registered Successfully
            </span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Official Tracking Reference ID
            </h2>
          </div>

          <div className="inline-flex items-center gap-3 rounded-2xl bg-slate-100 px-6 py-3 border border-slate-200">
            <code className="text-xl sm:text-2xl font-mono font-black text-[#0b2447]">{ticketId}</code>
            <button
              type="button"
              onClick={handleCopyTicket}
              className="rounded-lg bg-white p-2 text-slate-700 hover:text-slate-900 shadow-sm border border-slate-200 transition-all"
              title="Copy Reference ID"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>

          <div className="max-w-md mx-auto text-xs font-medium text-slate-700 leading-relaxed text-left bg-slate-50 p-4 rounded-xl space-y-2 border border-slate-200/80">
            <p>• <strong>Complainant:</strong> {formData.name}</p>
            <p>• <strong>Registered Email:</strong> <span className="font-mono text-blue-900 font-bold">{complainantEmail}</span></p>
            <p>• <strong>Subject:</strong> {formData.subject}</p>
            <p>• <strong>Status:</strong> <span className="text-blue-700 font-bold">Assigned to Nodal Officer, DIC</span></p>
            <div className="mt-2 rounded-lg bg-emerald-50 p-2.5 border border-emerald-200 text-emerald-900 text-[11px]">
              ✓ An automated acknowledgment email containing this Reference ID has been dispatched to <strong>{complainantEmail}</strong>. When resolved, the official reply remarks will also be transmitted directly to this email address.
            </div>
          </div>

          <div className="pt-4 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setTicketId(null);
                setFormData({
                  category: 'Micro, Small or Medium Enterprise (MSME)',
                  type: 'Vendor Verification / Approval Delay',
                  name: '',
                  email: '',
                  mobile: '',
                  orgName: '',
                  referenceNumber: '',
                  priority: 'normal',
                  subject: '',
                  description: '',
                });
              }}
              className="rounded-xl bg-[#0b2447] text-white px-6 py-2.5 text-xs font-bold hover:bg-[#12335f] transition shadow"
            >
              Lodge Another Grievance
            </button>
            <Link
              href="/"
              className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Return to Marketplace Home
            </Link>
          </div>
        </div>
      ) : (
        /* Grievance Intake Form */
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              Lodge Formal Stakeholder Grievance
            </h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Provide authentic enterprise and transaction details to ensure expeditious investigation and statutory dispute review.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="grv-category" className="block text-xs font-bold text-slate-700 mb-1">
                  Stakeholder Classification <span className="text-red-500">*</span>
                </label>
                <select
                  id="grv-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none bg-white"
                >
                  <option value="Micro, Small or Medium Enterprise (MSME)">Micro, Small or Medium Enterprise (MSME)</option>
                  <option value="Enterprise / Institutional Buyer">Enterprise / Institutional Buyer</option>
                  <option value="Women Self-Help Group (HerSHG)">Women Self-Help Group (HerSHG)</option>
                  <option value="General Public / Citizen">General Public / Citizen</option>
                </select>
              </div>

              <div>
                <label htmlFor="grv-type" className="block text-xs font-bold text-slate-700 mb-1">
                  Grievance Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="grv-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none bg-white"
                >
                  <option value="Vendor Verification / Approval Delay">Vendor Verification / Document Approval Delay</option>
                  <option value="RFQ / Tender / Reverse Auction Technical Issue">RFQ / Tender / Reverse Auction Technical Issue</option>
                  <option value="Purchase Order / Delivery Acceptance / GRN Issue">Purchase Order / Delivery Acceptance / GRN Issue</option>
                  <option value="Invoicing / Delayed Payment / Escrow Dispute">Invoicing / Delayed Payment / Escrow Dispute</option>
                  <option value="Suspected Fraud / Unofficial Solicitations">Suspected Fraud / Unofficial Solicitations</option>
                  <option value="Portal Account Access / OTP Glitch">Portal Account Access / OTP Glitch</option>
                  <option value="Policy Suggestion / General Feedback">Policy Suggestion / General Feedback</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div>
                <label htmlFor="grv-name" className="block text-xs font-bold text-slate-700 mb-1">
                  Complainant Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="grv-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Authorized Representative"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>

              <div>
                <label htmlFor="grv-email" className="block text-xs font-bold text-slate-700 mb-1">
                  Registered Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  id="grv-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@enterprise.in"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>

              <div>
                <label htmlFor="grv-mobile" className="block text-xs font-bold text-slate-700 mb-1">
                  Registered Mobile <span className="text-red-500">*</span>
                </label>
                <input
                  id="grv-mobile"
                  type="tel"
                  required
                  pattern="[0-9]{10}"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  placeholder="10-digit number"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="grv-org" className="block text-xs font-bold text-slate-700 mb-1">
                  Enterprise / Organization Name
                </label>
                <input
                  id="grv-org"
                  type="text"
                  value={formData.orgName}
                  onChange={(e) => setFormData({ ...formData, orgName: e.target.value })}
                  placeholder="Registered legal entity name"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>

              <div>
                <label htmlFor="grv-ref" className="block text-xs font-bold text-slate-700 mb-1">
                  Associated PO / Bid / Application No. (Optional)
                </label>
                <input
                  id="grv-ref"
                  type="text"
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                  placeholder="e.g. PO-2026-0041 or TND-2026-0981"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="grv-subject" className="block text-xs font-bold text-slate-700 mb-1">
                Grievance Subject <span className="text-red-500">*</span>
              </label>
              <input
                id="grv-subject"
                type="text"
                required
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Brief summary of the issue or dispute"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
              />
            </div>

            <div>
              <label htmlFor="grv-desc" className="block text-xs font-bold text-slate-700 mb-1">
                Comprehensive Narrative / Statement of Facts <span className="text-red-500">*</span>
              </label>
              <textarea
                id="grv-desc"
                required
                rows={5}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Please state chronology, relevant dates, affected order IDs, communications with counterparty, and desired relief..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none leading-relaxed"
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[11px] text-slate-600 font-medium">
              <strong className="text-slate-900">Declaration:</strong> I hereby certify that the particulars furnished above are true and verifiable to the best of my knowledge and authorized on behalf of the registered entity.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0b2447] text-white px-8 py-3 text-xs font-black hover:bg-[#12335f] shadow-md transition-all active:scale-95 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Registering with MSME Cell...</span>
                  </>
                ) : (
                  <>
                    <span>Register Grievance &amp; Generate Ticket</span>
                    <Send className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   5. KNOWLEDGE BASE & FREQUENTLY ASKED QUESTIONS VIEW
   ========================================================================= */

const FAQ_SECTIONS = [
  {
    category: 'buyers',
    label: 'Enterprise & Institutional Buyers',
    icon: Building2,
    items: [
      {
        q: 'How does an enterprise buyer register and achieve verified status on JSG SMILE?',
        a: 'Institutional and corporate buyers register through the Buyer Onboarding flow by submitting corporate CIN, GSTIN, PAN, and authorized signatory mandates. The District MSME Facilitation Cell reviews documentation within 24–48 hours before activating procurement publishing privileges.',
      },
      {
        q: 'Which procurement mode should be selected for different purchase values?',
        a: 'Under District Procurement Rules: Direct Purchase is suited for low-value catalogued items (up to ₹50,000); Request for Quotations (RFQ) is recommended for values between ₹50,000 and ₹5,00,000; formal Tender / e-Bidding is required for procurements exceeding ₹5,00,000; and Reverse Auction may be activated after technical qualification of multiple bidders to discover the most competitive rate.',
      },
      {
        q: 'How does the Goods Receipt Note (GRN) workflow protect buyer procurement fidelity?',
        a: 'Upon delivery of goods, the buyer inspection officer inspects items against Purchase Order specifications. Generating a verified digital GRN on the Portal serves as statutory acceptance and unfreezes supplier invoices for escrow settlement. If items are rejected, a partial GRN or defect notice is immediately logged in the audit trail.',
      },
      {
        q: 'What are the statutory payment terms governing orders from MSME suppliers?',
        a: 'In accordance with Section 15 of the MSMED Act 2006, payments must be cleared within 45 days of GRN delivery acceptance. Delay beyond 45 days incurs statutory compound interest with monthly rests at 3 times the RBI Bank Rate against the defaulting buyer.',
      },
    ],
  },
  {
    category: 'sellers',
    label: 'MSME Sellers & Manufacturers',
    icon: Store,
    items: [
      {
        q: 'What credentials are required for local MSME onboarding in Jharsuguda?',
        a: 'Suppliers must possess a valid Udyam Registration Certificate proving Micro, Small, or Medium classification, active GSTIN, entity PAN, operational business address within Jharsuguda District, active bank account with cancelled cheque, and authorization letter for the primary user.',
      },
      {
        q: 'Are MSME suppliers exempt from Earnest Money Deposit (EMD) and tender fees?',
        a: 'Yes. In strict accordance with the Public Procurement Policy for MSEs, all registered Micro and Small Enterprises holding a valid Udyam certificate are 100% exempt from payment of tender fees and Earnest Money Deposit (EMD) across all district public procurements.',
      },
      {
        q: 'How are seller products and services listed in the public marketplace catalogue?',
        a: 'Once verified by the DIC, suppliers access the Catalogue Management module in their dashboard to publish products and industrial services, complete with technical specifications, standard lead times, pricing tiers, and compliance certificates.',
      },
      {
        q: 'How does a supplier participate in public bidding or reverse auctions?',
        a: 'Suppliers receive automated notifications when new RFQs or Tenders matching their registered NIC / category codes are published. Bids and quotations can be submitted directly through the portal with cryptographic timestamping before the closing deadline.',
      },
    ],
  },
  {
    category: 'shg',
    label: 'Women Self-Help Groups (HerSHG)',
    icon: Users,
    items: [
      {
        q: 'What is the HerSHG initiative on the JSG SMILE Portal?',
        a: 'HerSHG is a dedicated district inclusion portal empowering Women Self-Help Groups (WSHGs) and Mission Shakti federations to supply catering, housekeeping, uniform manufacturing, organic produce, handlooms, and facility management services directly to district industries and government offices.',
      },
      {
        q: 'What documents are required for SHG registration?',
        a: 'WSHGs need their Mission Shakti / NRLM Group ID, bank passbook front page, group resolution letter signed by the President and Secretary, and Aadhaar verification of the authorized representative.',
      },
      {
        q: 'Are experience and turnover criteria relaxed for SHG suppliers?',
        a: 'Yes. For designated procurement packages reserved for women cooperatives and SHGs, previous turnover and prior tender experience criteria are relaxed under district preferential procurement rules.',
      },
    ],
  },
  {
    category: 'compliance',
    label: 'Verification, Payments & Security',
    icon: ShieldCheck,
    items: [
      {
        q: 'How does the Vendor Verification and Empanelment tier system work?',
        a: 'The Vendor Verification Policy categorizes sellers into Bronze, Silver, and Gold tiers based on document completeness, physical factory inspection by DIC field officers, and past delivery performance ratings.',
      },
      {
        q: 'Does the portal store credit card, net banking, or UPI PIN credentials?',
        a: 'No. The Portal strictly tokenizes payment references and integrates only with RBI-authorized payment gateways and scheduled commercial banks. No debit card, CVV, or banking PINs are ever stored on JSG SMILE servers.',
      },
      {
        q: 'What should a user do if they suspect fraudulent solicitation or phishing?',
        a: 'Stop the transaction immediately. JSG SMILE officials never ask for OTPs or personal UPI transfers. Lodge a report via the Grievance Redressal Portal or call the toll-free hotline at 1800-345-7111.',
      },
    ],
  },
];

function KnowledgeBaseFaqView() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    return FAQ_SECTIONS.map((section) => {
      if (activeCategory !== 'all' && section.category !== activeCategory) {
        return { ...section, items: [] };
      }
      if (!searchQuery.trim()) {
        return section;
      }
      const qLower = searchQuery.toLowerCase();
      const matchedItems = section.items.filter(
        (item) => item.q.toLowerCase().includes(qLower) || item.a.toLowerCase().includes(qLower)
      );
      return { ...section, items: matchedItems };
    }).filter((section) => section.items.length > 0);
  }, [activeCategory, searchQuery]);

  const toggleAccordion = (key: string) => {
    setExpandedIndex(expandedIndex === key ? null : key);
  };

  return (
    <div className="space-y-8">
      {/* Search & Category Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search questions (e.g. 45 days, EMD exemption, GRN, reverse auction, Udyam)..."
            className="w-full rounded-xl border border-slate-300 pl-12 pr-4 py-3 text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] focus:ring-1 focus:ring-[#0b2447] outline-none"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold transition-all',
              activeCategory === 'all'
                ? 'bg-[#0b2447] text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            )}
          >
            All Categories
          </button>
          {FAQ_SECTIONS.map((sec) => (
            <button
              key={sec.category}
              type="button"
              onClick={() => setActiveCategory(sec.category)}
              className={cn(
                'rounded-xl px-4 py-2 text-xs font-bold transition-all flex items-center gap-1.5',
                activeCategory === sec.category
                  ? 'bg-[#0b2447] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              )}
            >
              <sec.icon className="h-3.5 w-3.5" />
              <span>{sec.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accordions List */}
      <div className="space-y-6">
        {filteredSections.map((section) => (
          <div key={section.category} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <section.icon className="h-5 w-5 text-[#0b2447]" />
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                {section.label}
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {section.items.map((item, idx) => {
                const itemKey = `${section.category}-${idx}`;
                const isOpen = expandedIndex === itemKey;
                return (
                  <div key={item.q} className="py-3.5 first:pt-1 last:pb-1">
                    <button
                      type="button"
                      onClick={() => toggleAccordion(itemKey)}
                      aria-expanded={isOpen}
                      aria-controls={`faq-body-${itemKey}`}
                      className="flex w-full items-start justify-between gap-4 text-left font-bold text-slate-900 hover:text-[#0b2447] focus-visible:ring-2 focus-visible:ring-[#0b2447] rounded-lg p-1 transition-colors"
                    >
                      <span className="text-xs sm:text-sm">{item.q}</span>
                      <ChevronDown
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200',
                          isOpen && 'rotate-180 text-[#0b2447]'
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div
                        id={`faq-body-${itemKey}`}
                        className="mt-2 text-xs font-medium leading-relaxed text-slate-600 pl-1 pr-4 bg-slate-50 p-3.5 rounded-xl border border-slate-100"
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
            <HelpCircle className="mx-auto h-10 w-10 text-slate-400" />
            <p className="text-sm font-bold text-slate-700">No matching questions found</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try searching with different keywords or contact our District MSME Cell directly at 1800-345-7111.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   6. ENTERPRISE VISUAL SITEMAP VIEW
   ========================================================================= */

const SITEMAP_SECTIONS = [
  {
    title: 'Marketplace & Public Catalogues',
    icon: Store,
    links: [
      { label: 'Marketplace Home', href: '/', desc: 'Public portal storefront, highlights & live metrics' },
      { label: 'Products Catalogue', href: '/marketplace/products', desc: 'Browse verified manufactured industrial goods' },
      { label: 'Industrial Services', href: '/marketplace/services', desc: 'Machining, maintenance, calibration & fabrication' },
      { label: 'Verified Sellers Directory', href: '/marketplace/sellers', desc: 'Empaneled MSME suppliers in Jharsuguda' },
      { label: 'Large Industry Buyers', href: '/marketplace/buyers', desc: 'Anchor enterprises, corporate plants & PSUs' },
      { label: 'Platform Benefits', href: '/marketplace/benefits', desc: 'Institutional advantages for buyers, sellers & SHGs' },
      { label: 'Guest Procurement Cart', href: '/marketplace/cart', desc: 'Review direct purchases and RFQ items' },
      { label: 'Compare Products', href: '/marketplace/compare', desc: 'Side-by-side technical specification comparison' },
    ],
  },
  {
    title: 'Procurement & Bidding Engine',
    icon: Scale,
    links: [
      { label: 'Open Tenders & e-Bids', href: '/tenders', desc: 'Public procurement opportunities & schedules' },
      { label: 'Buyer Procurement Hub', href: '/buyer/procurement/create', desc: 'Draft RFQs, bids, BOQs & reverse auctions' },
      { label: 'Direct Purchase Portal', href: '/buyer/direct-purchase', desc: 'Instant order placement for catalogued items' },
      { label: 'Buyer RFQ Register', href: '/buyer/rfq', desc: 'Manage incoming quotations and vendor evaluations' },
      { label: 'Seller Opportunities', href: '/seller/opportunities', desc: 'Discover tenders, open bids & RFQ invitations' },
      { label: 'Tender Evaluation Matrix', href: '/buyer/tenders', desc: 'Technical qualification & commercial scoring' },
    ],
  },
  {
    title: 'Stakeholder Onboarding & Hubs',
    icon: Users,
    links: [
      { label: 'Stakeholder Selection', href: '/register', desc: 'Choose between Buyer, Seller, or SHG onboarding' },
      { label: 'Buyer Registration Flow', href: '/buyer/register', desc: 'Corporate CIN, GSTIN & signatory onboarding' },
      { label: 'MSME Seller Registration', href: '/seller/register', desc: 'Udyam verification, bank KYC & capacity audit' },
      { label: 'HerSHG Women Registration', href: '/hershg/register', desc: 'Mission Shakti group onboarding & artisan portal' },
      { label: 'Account Login Gate', href: '/login', desc: 'Secure stakeholder portal authentication' },
      { label: 'Forgot Password Recovery', href: '/forgot-password', desc: 'Verified OTP credential reset' },
    ],
  },
  {
    title: 'Governance & Official Policies',
    icon: ShieldCheck,
    links: [
      { label: 'Terms & Conditions (GTC)', href: '/terms-of-use', desc: 'Master platform operating terms and regulations' },
      { label: 'Official Privacy Policy', href: '/privacy-policy', desc: 'Statutory 18-section data protection charter' },
      { label: 'Vendor Verification Policy', href: '/vendor-verification-policy', desc: 'Due diligence, desk reviews & field inspections' },
      { label: 'Order Placement Policy', href: '/order-placement-policy', desc: '10-stage procurement lifecycle guidelines' },
      { label: 'Cancellation & Refund Policy', href: '/refund-cancellation-policy', desc: 'Order withdrawal, return & refund rules' },
      { label: 'MSME Supplier Agreement', href: '/supplier-agreement', desc: 'Statutory supplier rights & performance obligations' },
      { label: 'Data Sharing Consent', href: '/data-sharing-consent', desc: 'Statutory consent authorizing API verification' },
      { label: 'Procurement Disclaimer', href: '/disclaimer', desc: 'Statutory institutional non-liability demarcation' },
      { label: 'Copyright & IP Policy', href: '/copyright', desc: 'Intellectual property and open data access guidelines' },
      { label: 'Hyperlinking Policy', href: '/hyperlinking-policy', desc: 'GIGW guidelines on inbound & outbound web links' },
      { label: 'Caution Notice Against Fraud', href: '/caution-notice', desc: 'Anti-phishing and fake tender advisory' },
    ],
  },
  {
    title: 'Helpdesk, Support & Redressal',
    icon: Headphones,
    links: [
      { label: 'Help Center & Guides', href: '/help', desc: 'SOP workflows, step-by-step guides & checklists' },
      { label: 'Frequently Asked Questions', href: '/faqs', desc: 'Searchable knowledge base across all roles' },
      { label: 'District MSME Cell Contact', href: '/contact-us', desc: 'Directory of District Secretariat and DIC desks' },
      { label: 'Grievance Redressal Portal', href: '/feedback', desc: 'ORTPSA compliant formal dispute & ticket lodging' },
      { label: 'Portal User Guide', href: '/user-guide', desc: 'Detailed documentation for institutional users' },
    ],
  },
];

function EnterpriseSitemapView() {
  const [search, setSearch] = useState('');

  const filteredSections = useMemo(() => {
    if (!search.trim()) return SITEMAP_SECTIONS;
    const term = search.toLowerCase();
    return SITEMAP_SECTIONS.map((sec) => ({
      ...sec,
      links: sec.links.filter(
        (lnk) => lnk.label.toLowerCase().includes(term) || lnk.desc.toLowerCase().includes(term)
      ),
    })).filter((sec) => sec.links.length > 0);
  }, [search]);

  return (
    <div className="space-y-8">
      {/* Search Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-black text-slate-900 uppercase tracking-tight">
            Portal Directory &amp; Navigation Hierarchy
          </h2>
          <p className="text-xs font-semibold text-slate-500">
            Comprehensive index of all public endpoints, statutory documents, and stakeholder workspaces.
          </p>
        </div>
        <div className="w-full sm:w-80 relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter sitemap links..."
            className="w-full rounded-xl border border-slate-300 pl-10 pr-3 py-2 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:border-[#0b2447] outline-none"
          />
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredSections.map((sec) => (
          <div key={sec.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#0b2447]">
                <sec.icon className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                {sec.title}
              </h3>
            </div>
            <ul className="space-y-3">
              {sec.links.map((lnk) => (
                <li key={lnk.href + lnk.label}>
                  <Link
                    href={lnk.href}
                    className="group block rounded-xl p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-[#0b2447] group-hover:text-blue-700">
                      <span>{lnk.label}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-700 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium line-clamp-1 mt-0.5">
                      {lnk.desc}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
