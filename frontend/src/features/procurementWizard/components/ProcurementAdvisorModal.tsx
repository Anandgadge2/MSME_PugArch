'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  X, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  Clock, 
  TrendingDown,
  Layers,
  Building2,
  Package,
  Wrench,
  Gavel,
  FileText
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';
import { GLOSSARY_DICTIONARY } from '../../../components/common/ProcurementGlossaryTooltip';

interface ProcurementAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyMethod: (methodId: string) => void;
}

interface RecommendationResult {
  methodId: string;
  name: string;
  badge: string;
  whyFit: string;
  hindiSummary: string;
  estimatedTimeline: string;
  keyRule: string;
}

export function ProcurementAdvisorModal({
  isOpen,
  onClose,
  onApplyMethod
}: ProcurementAdvisorModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [itemType, setItemType] = useState<'goods' | 'complex_services' | 'recurring'>('goods');
  const [budgetTier, setBudgetTier] = useState<'micro' | 'medium' | 'major'>('micro');
  const [strategy, setStrategy] = useState<'fast_price' | 'two_stage' | 'live_auction' | 'limited'>('fast_price');

  if (!isOpen) return null;

  // Compute recommendation
  const computeRecommendation = (): RecommendationResult => {
    // 1. Recurring items across time -> Rate Contract
    if (itemType === 'recurring') {
      return {
        methodId: 'RATE_CONTRACT',
        name: 'Annual Rate Contract (दर अनुबंध)',
        badge: 'Best for Recurring Purchases',
        whyFit: 'Since your organization needs repeated batches over an extended timeframe, a Rate Contract fixes unit prices upfront and eliminates the need to float new tenders for every order.',
        hindiSummary: 'तय समय के लिए निश्चित दर अनुबंध। जरूरत पड़ने पर कभी भी ऑर्डर दिया जा सकता है।',
        estimatedTimeline: 'Valid for 1–2 Years',
        keyRule: 'Direct Purchase Orders can be dispatched immediately as requirements arise.'
      };
    }

    // 2. High budget + live bidding preference -> Reverse Auction
    if (strategy === 'live_auction' || (budgetTier === 'major' && strategy === 'fast_price')) {
      return {
        methodId: 'REVERSE_AUCTION',
        name: 'Dynamic Reverse Auction (रिवर्स नीलामी)',
        badge: 'Maximum Cost Savings',
        whyFit: 'For high-value or competitive goods, a Reverse Auction allows verified sellers to iteratively lower quotes in a live countdown floor, yielding the lowest true market price.',
        hindiSummary: 'लाइव नीलामी जहां विक्रेता समय सीमा के भीतर अपना रेट कम करके जीतते हैं।',
        estimatedTimeline: '2–4 Hour Live Bidding Window',
        keyRule: 'Ensure standard specifications so sellers compete solely on commercial unit rates.'
      };
    }

    // 3. Complex solutions or technical scrutinizing -> RFP / Two-Packet
    if (itemType === 'complex_services' || strategy === 'two_stage') {
      return {
        methodId: 'RFP',
        name: 'Request for Proposal — Two-Packet (तकनीकी प्रस्ताव)',
        badge: 'Quality & Governance Assured',
        whyFit: 'For complex services, software, or specialized solutions, technical credentials must be scored first. Only technically compliant bidders have their financial price packet opened.',
        hindiSummary: 'पहले तकनीकी योग्यता जांची जाती है, फिर पात्र विक्रेताओं का रेट खोला जाता है।',
        estimatedTimeline: '14–21 Days Sourcing Cycle',
        keyRule: 'Independent Technical Evaluation Committee scores credentials before price reveals.'
      };
    }

    // 4. Limited pre-approved list -> Limited Tender
    if (strategy === 'limited') {
      return {
        methodId: 'LIMITED_TENDER',
        name: 'Limited Sourcing (सीमित निविदा)',
        badge: 'Targeted & Confidential',
        whyFit: 'Best when only specific verified vendors are authorized or possess the required proprietary manufacturing capability.',
        hindiSummary: 'केवल चुने हुए या आमंत्रित विक्रेताओं के लिए निविदा।',
        estimatedTimeline: '5–10 Days Sourcing Cycle',
        keyRule: 'Statutory justification is documented on record for restricting invites.'
      };
    }

    // 5. Open public tender for large scale
    if (budgetTier === 'major') {
      return {
        methodId: 'OPEN_TENDER',
        name: 'Public Open Tender (खुली निविदा)',
        badge: 'Statutory Public Compliance',
        whyFit: 'For high-value procurement, public open tendering invites nationwide MSME participation, satisfying public procurement mandates and transparency audit compliance.',
        hindiSummary: 'सार्वजनिक निविदा जिसमें कोई भी पंजीकृत और पात्र विक्रेता भाग ले सकता है।',
        estimatedTimeline: '15–30 Days Statutory Window',
        keyRule: 'Broadest market reach with public portal advertisement.'
      };
    }

    // 6. Default: Direct RFQ (Single Packet)
    return {
      methodId: 'RFQ',
      name: 'Request for Quotation — Single Packet (मूल्य उद्धरण)',
      badge: 'Fastest & Simplest',
      whyFit: 'Ideal for standard products and services with clear commercial parameters. Bidders submit quotes directly, and the L1 (lowest compliant bidder) is determined immediately without complex evaluations.',
      hindiSummary: 'मानक सामान के लिए सीधे दाम मांगना। सबसे कम रेट वाले को तुरंत ऑर्डर मिलता है।',
      estimatedTimeline: '3–7 Days Turnaround',
      keyRule: 'Best for standard items with straightforward price comparison.'
    };
  };

  const recommendation = computeRecommendation();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Procurement Advisor: Help Me Choose"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#12335f] to-[#1e4986] p-4 sm:p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-xs">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                Procurement Advisor
              </span>
              <h2 className="text-base font-bold text-white tracking-tight">
                Help Me Choose the Right Sourcing Method
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close Advisor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-5 pt-4 pb-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-xs font-semibold text-slate-500">
          <span>Question {currentStep} of 3</span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  s === currentStep ? "w-6 bg-[#12335f]" : s < currentStep ? "w-3 bg-emerald-500" : "w-3 bg-slate-200"
                )}
              />
            ))}
          </div>
        </div>

        {/* Content body */}
        <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
          {currentStep === 1 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                1. What type of requirement are you procuring?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Choose the nature of the deliverable so the system can match the complexity and scoring requirements.
              </p>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setItemType('goods')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    itemType === 'goods'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Package className={cn("h-5 w-5 shrink-0 mt-0.5", itemType === 'goods' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Standard Commercial Goods & Supplies</span>
                    <span className="text-[11px] text-slate-500 font-medium">Off-the-shelf equipment, hardware, raw materials, office stationery with clear specs.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setItemType('complex_services')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    itemType === 'complex_services'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Wrench className={cn("h-5 w-5 shrink-0 mt-0.5", itemType === 'complex_services' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Complex Services, Software, or Specialized Solutions</span>
                    <span className="text-[11px] text-slate-500 font-medium">Consulting, customized software development, facility operations requiring technical credential verification.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setItemType('recurring')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    itemType === 'recurring'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Layers className={cn("h-5 w-5 shrink-0 mt-0.5", itemType === 'recurring' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Recurring / Continuous Demands Throughout the Year</span>
                    <span className="text-[11px] text-slate-500 font-medium">Items ordered periodically where you want pre-negotiated unit prices valid for 1-2 years.</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                2. What is the approximate estimated procurement budget?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Budget thresholds influence statutory approval rules and whether open advertising is mandated.
              </p>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setBudgetTier('micro')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    budgetTier === 'micro'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold", budgetTier === 'micro' ? "border-[#12335f] text-[#12335f]" : "border-slate-300 text-slate-400")}>₹</div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Under ₹5 Lakhs (Micro / Small Procurement)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Eligible for expedited direct RFQs or limited quotations with rapid turnaround.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBudgetTier('medium')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    budgetTier === 'medium'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold", budgetTier === 'medium' ? "border-[#12335f] text-[#12335f]" : "border-slate-300 text-slate-400")}>₹</div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">₹5 Lakhs to ₹50 Lakhs (Medium Commercial Scale)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Suitable for single-packet RFQs, open tenders, or competitive dynamic auctions.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBudgetTier('major')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    budgetTier === 'major'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <div className={cn("h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center text-[10px] font-bold", budgetTier === 'major' ? "border-[#12335f] text-[#12335f]" : "border-slate-300 text-slate-400")}>₹</div>
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Above ₹50 Lakhs (Major Public / Corporate Tender)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Requires comprehensive governance, open public transparency, or two-envelope evaluations.</span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold text-slate-900">
                3. What is your primary sourcing strategy &amp; goal?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                How should sellers compete for the final contract?
              </p>

              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setStrategy('fast_price')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    strategy === 'fast_price'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <CheckCircle2 className={cn("h-5 w-5 shrink-0 mt-0.5", strategy === 'fast_price' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Lowest price on standardized specifications (L1 Direct)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Fastest cycle. No complex technical scoring; quotes are compared directly on price.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('live_auction')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    strategy === 'live_auction'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Gavel className={cn("h-5 w-5 shrink-0 mt-0.5", strategy === 'live_auction' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Real-time price competition (Reverse Auction Floor)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Sellers compete live during a countdown window, driving down unit costs dynamically.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('two_stage')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    strategy === 'two_stage'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <ShieldCheck className={cn("h-5 w-5 shrink-0 mt-0.5", strategy === 'two_stage' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Vendor credentials &amp; technical qualification first (Two-Packet)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Strict scrutiny of certifications, experience, and methodology before price envelopes are opened.</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setStrategy('limited')}
                  className={cn(
                    "w-full text-left p-3.5 rounded-xl border text-xs transition-all flex items-start gap-3",
                    strategy === 'limited'
                      ? "border-[#12335f] bg-blue-50/50 shadow-xs"
                      : "border-slate-200 hover:bg-slate-50"
                  )}
                >
                  <Building2 className={cn("h-5 w-5 shrink-0 mt-0.5", strategy === 'limited' ? "text-[#12335f]" : "text-slate-400")} />
                  <div>
                    <span className="font-bold text-slate-900 block text-xs">Pre-approved or invited vendor list only (Limited Sourcing)</span>
                    <span className="text-[11px] text-slate-500 font-medium">Only specifically selected registered sellers can view and respond to the request.</span>
                  </div>
                </button>
              </div>

              {/* Dynamic Recommendation Preview Card */}
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-emerald-50 via-white to-blue-50 border border-emerald-300/80 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold uppercase tracking-wider">
                    Recommended Method
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800">
                    {recommendation.badge}
                  </span>
                </div>

                <h4 className="text-sm font-black text-slate-900">
                  {recommendation.name}
                </h4>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {recommendation.whyFit}
                </p>

                <div className="pt-2 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-slate-500">
                  <span className="flex items-center gap-1 text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-[#12335f]" />
                    {recommendation.estimatedTimeline}
                  </span>
                  <span className="text-emerald-700 font-bold">
                    ✓ Full statutory compliance
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="h-9 px-3 text-xs font-bold border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 px-3 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel
            </Button>
          )}

          {currentStep < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="h-9 px-4 text-xs font-bold bg-[#12335f] hover:bg-[#0b2445] text-white flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApplyMethod(recommendation.methodId);
                onClose();
              }}
              className="h-9 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Apply {recommendation.name.split(' (')[0]}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProcurementAdvisorModal;
