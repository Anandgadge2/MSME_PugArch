'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  FileText,
  Check
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

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

/* ─── Selection card ───────────────────────────────────────────────────── */
interface OptionCardProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  id: string;
}

function OptionCard({ selected, onClick, icon, title, description, id }: OptionCardProps) {
  return (
    <button
      id={id}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "group w-full text-left rounded-xl border-2 transition-all duration-150 flex items-start gap-3.5",
        "p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12335f] focus-visible:ring-offset-2",
        selected
          ? "border-[#12335f] bg-blue-50/60 shadow-md ring-1 ring-[#12335f]/20"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-sm"
      )}
    >
      {/* Radio indicator */}
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          selected
            ? "border-[#12335f] bg-[#12335f]"
            : "border-slate-300 bg-white group-hover:border-slate-400"
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
      </div>

      {/* Icon */}
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
          selected
            ? "bg-[#12335f]/10 text-[#12335f]"
            : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-500"
        )}
        aria-hidden="true"
      >
        {icon}
      </div>

      {/* Text */}
      <div className="min-w-0 flex-1">
        <span className={cn(
          "block text-[13px] font-bold leading-snug",
          selected ? "text-[#12335f]" : "text-slate-800"
        )}>
          {title}
        </span>
        <span className="block mt-0.5 text-[11px] text-slate-500 font-medium leading-relaxed">
          {description}
        </span>
      </div>
    </button>
  );
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
  const closeRef = useRef<HTMLButtonElement>(null);

  // Trap focus return on close
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  // Compute recommendation
  const computeRecommendation = (): RecommendationResult => {
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

  const stepLabels = ['Requirement Type', 'Budget Range', 'Strategy & Result'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Procurement Advisor: Help Me Choose"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#12335f] via-[#183d6e] to-[#1e4986] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-xs">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-300/90">
                Procurement Advisor
              </span>
              <h2 className="text-[15px] font-bold text-white leading-tight tracking-tight">
                Help Me Choose the Right Sourcing Method
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Close Advisor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Step Progress Bar ──────────────────────────────────────── */}
        <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-200/60">
          <div className="flex items-center justify-between mb-2">
            {stepLabels.map((label, i) => {
              const step = i + 1;
              const isActive = step === currentStep;
              const isDone = step < currentStep;
              return (
                <div key={step} className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all",
                      isActive
                        ? "bg-[#12335f] text-white shadow-sm"
                        : isDone
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-200 text-slate-400"
                    )}
                  >
                    {isDone ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : step}
                  </div>
                  <span
                    className={cn(
                      "text-[11px] font-semibold hidden sm:inline",
                      isActive ? "text-[#12335f]" : isDone ? "text-emerald-600" : "text-slate-400"
                    )}
                  >
                    {label}
                  </span>
                  {i < stepLabels.length - 1 && (
                    <div className={cn(
                      "hidden sm:block w-8 lg:w-12 h-px mx-1",
                      isDone ? "bg-emerald-400" : "bg-slate-200"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#12335f] to-[#1e6cbf] transition-all duration-300 ease-out"
              style={{ width: `${((currentStep - 1) / 2) * 100}%` }}
            />
          </div>
        </div>

        {/* ── Content body ──────────────────────────────────────────── */}
        <div className="px-5 py-5 overflow-y-auto max-h-[58vh]">
          {currentStep === 1 && (
            <div className="space-y-4" role="radiogroup" aria-label="Requirement type">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  What type of requirement are you procuring?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Choose the nature of the deliverable so the system can match the complexity and scoring requirements.
                </p>
              </div>

              <div className="space-y-3">
                <OptionCard
                  id="opt-goods"
                  selected={itemType === 'goods'}
                  onClick={() => setItemType('goods')}
                  icon={<Package className="h-4.5 w-4.5" />}
                  title="Standard Commercial Goods & Supplies"
                  description="Off-the-shelf equipment, hardware, raw materials, office stationery with clear specs."
                />
                <OptionCard
                  id="opt-complex"
                  selected={itemType === 'complex_services'}
                  onClick={() => setItemType('complex_services')}
                  icon={<Wrench className="h-4.5 w-4.5" />}
                  title="Complex Services, Software, or Specialized Solutions"
                  description="Consulting, customized software development, facility operations requiring technical credential verification."
                />
                <OptionCard
                  id="opt-recurring"
                  selected={itemType === 'recurring'}
                  onClick={() => setItemType('recurring')}
                  icon={<Layers className="h-4.5 w-4.5" />}
                  title="Recurring / Continuous Demands Throughout the Year"
                  description="Items ordered periodically where you want pre-negotiated unit prices valid for 1-2 years."
                />
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4" role="radiogroup" aria-label="Budget range">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  What is the approximate estimated procurement budget?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Budget thresholds influence statutory approval rules and whether open advertising is mandated.
                </p>
              </div>

              <div className="space-y-3">
                <OptionCard
                  id="opt-micro"
                  selected={budgetTier === 'micro'}
                  onClick={() => setBudgetTier('micro')}
                  icon={<span className="text-sm font-bold">₹</span>}
                  title="Under ₹5 Lakhs (Micro / Small Procurement)"
                  description="Eligible for expedited direct RFQs or limited quotations with rapid turnaround."
                />
                <OptionCard
                  id="opt-medium"
                  selected={budgetTier === 'medium'}
                  onClick={() => setBudgetTier('medium')}
                  icon={<span className="text-sm font-bold">₹₹</span>}
                  title="₹5 Lakhs to ₹50 Lakhs (Medium Commercial Scale)"
                  description="Suitable for single-packet RFQs, open tenders, or competitive dynamic auctions."
                />
                <OptionCard
                  id="opt-major"
                  selected={budgetTier === 'major'}
                  onClick={() => setBudgetTier('major')}
                  icon={<span className="text-sm font-bold">₹₹₹</span>}
                  title="Above ₹50 Lakhs (Major Public / Corporate Tender)"
                  description="Requires comprehensive governance, open public transparency, or two-envelope evaluations."
                />
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <div role="radiogroup" aria-label="Sourcing strategy">
                <div className="mb-4">
                  <h3 className="text-sm font-extrabold text-slate-900">
                    What is your primary sourcing strategy &amp; goal?
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    How should sellers compete for the final contract?
                  </p>
                </div>

                <div className="space-y-3">
                  <OptionCard
                    id="opt-l1"
                    selected={strategy === 'fast_price'}
                    onClick={() => setStrategy('fast_price')}
                    icon={<CheckCircle2 className="h-4.5 w-4.5" />}
                    title="Lowest price on standardized specifications (L1 Direct)"
                    description="Fastest cycle. No complex technical scoring; quotes are compared directly on price."
                  />
                  <OptionCard
                    id="opt-auction"
                    selected={strategy === 'live_auction'}
                    onClick={() => setStrategy('live_auction')}
                    icon={<Gavel className="h-4.5 w-4.5" />}
                    title="Real-time price competition (Reverse Auction Floor)"
                    description="Sellers compete live during a countdown window, driving down unit costs dynamically."
                  />
                  <OptionCard
                    id="opt-two-packet"
                    selected={strategy === 'two_stage'}
                    onClick={() => setStrategy('two_stage')}
                    icon={<ShieldCheck className="h-4.5 w-4.5" />}
                    title="Vendor credentials & technical qualification first (Two-Packet)"
                    description="Strict scrutiny of certifications, experience, and methodology before price envelopes are opened."
                  />
                  <OptionCard
                    id="opt-limited"
                    selected={strategy === 'limited'}
                    onClick={() => setStrategy('limited')}
                    icon={<Building2 className="h-4.5 w-4.5" />}
                    title="Pre-approved or invited vendor list only (Limited Sourcing)"
                    description="Only specifically selected registered sellers can view and respond to the request."
                  />
                </div>
              </div>

              {/* ── Recommendation Preview Card ─────────────────────── */}
              <div className="mt-5 rounded-xl overflow-hidden border border-emerald-300/80 shadow-sm">
                <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
                    <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                    Recommended Method
                  </span>
                  <span className="text-[11px] font-bold text-emerald-100">
                    {recommendation.badge}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 via-white to-blue-50/40 p-4 space-y-2.5">
                  <h4 className="text-[14px] font-black text-slate-900 leading-snug">
                    {recommendation.name}
                  </h4>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {recommendation.whyFit}
                  </p>

                  <div className="pt-2.5 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Clock className="h-3.5 w-3.5 text-[#12335f]" aria-hidden="true" />
                      {recommendation.estimatedTimeline}
                    </span>
                    <span className="flex items-center gap-1 text-emerald-700 font-bold">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                      Full statutory compliance
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer actions ────────────────────────────────────────── */}
        <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-200/60 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="h-9 px-4 text-xs font-bold border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-1.5 rounded-lg"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-9 px-4 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
            >
              Cancel
            </Button>
          )}

          {currentStep < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="h-9 px-5 text-xs font-bold bg-[#12335f] hover:bg-[#0b2445] text-white flex items-center gap-1.5 rounded-lg shadow-sm"
            >
              <span>Next</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApplyMethod(recommendation.methodId);
                onClose();
              }}
              className="h-9 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm rounded-lg"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Apply {recommendation.name.split(' (')[0]}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProcurementAdvisorModal;
