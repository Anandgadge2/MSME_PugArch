'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  ClipboardCheck,
  Gavel,
  ShoppingCart,
  FileText,
  CheckSquare,
  Package,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';

const CARDS = [
  {
    title: 'Buy from Marketplace',
    description: 'For Direct Purchase and L1 Purchase from available seller catalog.',
    href: '/buyer/marketplace',
    cta: 'Open Marketplace',
    icon: ShoppingCart,
  },
  {
    title: 'Cart Checkout',
    description: 'Review cart and select Direct Purchase, L1, Bid/RA, or PAC.',
    href: '/cart',
    cta: 'Open Cart',
    icon: Package,
  },
  {
    title: 'Create Bid / Tender',
    description: 'Product Bid, Service Bid, Custom Bid, BOQ Bid, Two Packet Bid.',
    href: '/buyer/create-bid',
    cta: 'Create Bid',
    icon: Gavel,
  },
  {
    title: 'Create Reverse Auction',
    description: 'Use RA for competitive price discovery.',
    href: '/reverse-auctions/create',
    cta: 'Create RA',
    icon: Gavel,
  },
  {
    title: 'PAC Procurement',
    description: 'Proprietary/OEM-specific procurement with justification.',
    href: '/buyer/create-bid?type=PAC',
    cta: 'Create PAC',
    icon: FileText,
  },
];

const QUICK_LINKS = [
  { label: 'Procurement Drafts', href: '/buyer/procurement/drafts' },
  { label: 'Approvals', href: '/buyer/procurement/approvals' },
  { label: 'Direct Purchase Orders', href: '/buyer/direct-purchase/orders' },
  { label: 'My Orders', href: '/orders' },
];

export default function BuyerProcurementHub() {
  const searchParams = useSearchParams();
  const notice = searchParams.get('notice') || searchParams.get('from');

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#12335f]">Procurement · Buying Dashboard</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">Buyer Procurement Hub</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">
          Start all catalogue purchases from Marketplace → Cart. Formal bids, reverse auctions, and PAC use dedicated creation paths below.
        </p>
      </div>

      {(notice === 'direct-purchase-migrated' || notice === 'legacy-direct-purchase') && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Direct Purchase is now available through <strong>Marketplace → Cart → Procurement Method</strong>.
            Use Cart Checkout to select Direct Purchase, L1, Bid/RA, or PAC based on value and rules.
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {CARDS.map(card => (
          <Card key={card.title} className="border-slate-200/80 shadow-sm transition hover:border-[#12335f]/30">
            <CardContent className="flex h-full flex-col p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[#12335f]/10 text-[#12335f]">
                <card.icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-black text-slate-950">{card.title}</h2>
              <p className="mt-1 flex-1 text-xs text-slate-600">{card.description}</p>
              <Link
                href={card.href}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-[#12335f] px-4 text-sm font-semibold text-white hover:bg-[#0e2a4f]"
              >
                {card.cta} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200/80">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#12335f]" />
            <h2 className="text-sm font-black uppercase tracking-wide text-slate-800">Drafts · Approvals · Orders</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
