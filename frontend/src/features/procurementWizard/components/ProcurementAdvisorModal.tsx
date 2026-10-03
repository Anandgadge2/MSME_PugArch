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
  Layers,
  Building2,
  Package,
  Wrench,
  Gavel,
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

/* ─── Modern Selection Card ────────────────────────────────────────────── */
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
        "group w-full text-left rounded-xl border-2 transition-all duration-150 flex items-center justify-between gap-4 p-4",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#12335f] focus-visible:ring-offset-2 cursor-pointer",
        selected
          ? "border-[#12335f] bg-blue-50/50 shadow-sm ring-1 ring-[#12335f]/15"
          : "border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60"
      )}
    >
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {/* Leading Icon Badge */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-150 mt-0.5",
            selected
              ? "bg-[#12335f] text-white shadow-xs"
              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-700"
          )}
          aria-hidden="true"
        >
          {icon}
        </div>

        {/* Text Content */}
        <div className="min-w-0 flex-1">
          <span className={cn(
            "block text-sm font-bold leading-snug tracking-tight",
            selected ? "text-[#12335f]" : "text-slate-900"
          )}>
            {title}
          </span>
          <span className="block mt-1 text-xs text-slate-600 font-medium leading-relaxed">
            {description}
          </span>
        </div>
      </div>

      {/* Trailing Radio Indicator */}
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150 ml-2",
          selected
            ? "border-[#12335f] bg-[#12335f]"
            : "border-slate-300 bg-white group-hover:border-slate-400"
        )}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3 text-white stroke-[3]" />}
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

  // Focus trap / auto-focus
  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  // Recommendation engine
  const computeRecommendation = (): RecommendationResult => {
    if (itemType === 'recurring') {
      return {
        methodId: 'RATE_CONTRACT',
        name: 'Annual Rate Contract (दर अनुबंध)',
        badge: 'Best for Recurring Demands',
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

  const steps = [
    { num: 1, label: 'Requirement Type' },
    { num: 2, label: 'Budget Range' },
    { num: 3, label: 'Strategy & Result' }
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Procurement Advisor: Help Me Choose"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ───────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#12335f] via-[#163e72] to-[#1e4b85] px-6 py-4.5 text-white flex items-center justify-between border-b border-blue-900/40">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur-xs shadow-inner">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-amber-300">
                Procurement Advisor
              </span>
              <h2 className="text-base font-bold text-white tracking-tight leading-tight">
                Help Me Choose the Right Sourcing Method
              </h2>
            </div>
          </div>
          <button
            ref={closeRef}
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
            aria-label="Close Advisor"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Progress Stepper Bar ───────────────────────────────────── */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200/80">
          <div className="flex items-center justify-between">
            {steps.map((step, idx) => {
              const isActive = step.num === currentStep;
              const isDone = step.num < currentStep;
              return (
                <React.Fragment key={step.num}>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-200",
                        isActive
                          ? "bg-[#12335f] text-white shadow-xs ring-2 ring-[#12335f]/20"
                          : isDone
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-200 text-slate-500 font-semibold"
                      )}
                    >
                      {isDone ? <Check className="h-4 w-4 stroke-[3]" /> : step.num}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-bold transition-colors",
                        isActive
                          ? "text-[#12335f]"
                          : isDone
                            ? "text-emerald-700"
                            : "text-slate-500"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className="flex-1 mx-3 h-0.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          step.num < currentStep ? "bg-emerald-500 w-full" : "w-0"
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Content Body ───────────────────────────────────────────── */}
        <div className="p-6 overflow-y-auto max-h-[62vh]">
          {/* STEP 1: REQUIREMENT TYPE */}
          {currentStep === 1 && (
            <div className="space-y-4" role="radiogroup" aria-label="Requirement type">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  1. What type of requirement are you procuring?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Choose the nature of the deliverable so the system can match complexity, statutory compliance, and evaluation requirements.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <OptionCard
                  id="opt-goods"
                  selected={itemType === 'goods'}
                  onClick={() => setItemType('goods')}
                  icon={<Package className="h-5 w-5" />}
                  title="Standard Commercial Goods & Supplies"
                  description="Off-the-shelf equipment, hardware, raw materials, or office supplies with predefined specifications."
                />
                <OptionCard
                  id="opt-complex"
                  selected={itemType === 'complex_services'}
                  onClick={() => setItemType('complex_services')}
                  icon={<Wrench className="h-5 w-5" />}
                  title="Complex Services, Software, or Specialized Solutions"
                  description="Consulting, turnkey projects, custom software development, or facility operations requiring technical credential scoring."
                />
                <OptionCard
                  id="opt-recurring"
                  selected={itemType === 'recurring'}
                  onClick={() => setItemType('recurring')}
                  icon={<Layers className="h-5 w-5" />}
                  title="Recurring Demands Throughout the Year (Rate Contract)"
                  description="Goods or services ordered periodically where pre-negotiated unit rates remain fixed for 1–2 years."
                />
              </div>
            </div>
          )}

          {/* STEP 2: BUDGET RANGE */}
          {currentStep === 2 && (
            <div className="space-y-4" role="radiogroup" aria-label="Budget range">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  2. What is the approximate estimated procurement budget?
                </h3>
                <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                  Budget thresholds govern statutory approval matrices, financial delegations, and open public tendering rules.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <OptionCard
                  id="opt-micro"
                  selected={budgetTier === 'micro'}
                  onClick={() => setBudgetTier('micro')}
                  icon={<span className="text-base font-black">₹</span>}
                  title="Under ₹5 Lakhs (Micro / Small Purchase)"
                  description="Expedited direct RFQs, single-quotation direct orders, or fast-turnaround limited quotes."
                />
                <OptionCard
                  id="opt-medium"
                  selected={budgetTier === 'medium'}
                  onClick={() => setBudgetTier('medium')}
                  icon={<span className="text-sm font-black">₹₹</span>}
                  title="₹5 Lakhs to ₹50 Lakhs (Medium Commercial Scale)"
                  description="Standard single-packet RFQs, dynamic reverse auctions, or competitive limited tenders."
                />
                <OptionCard
                  id="opt-major"
                  selected={budgetTier === 'major'}
                  onClick={() => setBudgetTier('major')}
                  icon={<span className="text-sm font-black">₹₹₹</span>}
                  title="Above ₹50 Lakhs (Major Corporate / Public Tender)"
                  description="Statutory open tender publishing, two-envelope technical evaluations, and broad national MSME outreach."
                />
              </div>
            </div>
          )}

          {/* STEP 3: STRATEGY & DYNAMIC RECOMMENDATION */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div role="radiogroup" aria-label="Sourcing strategy" className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 tracking-tight">
                    3. What is your primary sourcing goal?
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Select how suppliers should compete to award the contract.
                  </p>
                </div>

                <div className="space-y-2.5">
                  <OptionCard
                    id="opt-l1"
                    selected={strategy === 'fast_price'}
                    onClick={() => setStrategy('fast_price')}
                    icon={<CheckCircle2 className="h-5 w-5" />}
                    title="Lowest Price on Clear Specs (L1 Direct Comparison)"
                    description="Fastest turnaround. Commercial rates are compared directly with immediate L1 award determination."
                  />
                  <OptionCard
                    id="opt-auction"
                    selected={strategy === 'live_auction'}
                    onClick={() => setStrategy('live_auction')}
                    icon={<Gavel className="h-5 w-5" />}
                    title="Real-Time Price Discovery (Live Reverse Auction)"
                    description="Suppliers compete dynamically during an active countdown window to drive down unit costs."
                  />
                  <OptionCard
                    id="opt-two-packet"
                    selected={strategy === 'two_stage'}
                    onClick={() => setStrategy('two_stage')}
                    icon={<ShieldCheck className="h-5 w-5" />}
                    title="Strict Technical Qualification First (Two-Packet RFP)"
                    description="Credentials, methodologies, and compliance are scored before financial envelopes are unsealed."
                  />
                  <OptionCard
                    id="opt-limited"
                    selected={strategy === 'limited'}
                    onClick={() => setStrategy('limited')}
                    icon={<Building2 className="h-5 w-5" />}
                    title="Pre-Approved / Invited Vendors Only (Limited Sourcing)"
                    description="Restricted participation where only shortlisted or empaneled suppliers receive the invitation."
                  />
                </div>
              </div>

              {/* Dynamic Recommendation Banner Card */}
              <div className="rounded-xl overflow-hidden border-2 border-emerald-500/80 shadow-md">
                <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 px-5 py-3 flex items-center justify-between text-white">
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider">
                    <Sparkles className="h-4 w-4 text-amber-300" aria-hidden="true" />
                    Recommended Sourcing Method
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[11px] font-bold backdrop-blur-xs">
                    {recommendation.badge}
                  </span>
                </div>

                <div className="bg-gradient-to-br from-emerald-50/80 via-white to-blue-50/40 p-5 space-y-3">
                  <h4 className="text-base font-black text-slate-900 leading-snug">
                    {recommendation.name}
                  </h4>

                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    {recommendation.whyFit}
                  </p>

                  <div className="pt-3 border-t border-emerald-200/60 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                      <Clock className="h-4 w-4 text-[#12335f]" aria-hidden="true" />
                      Timeline: <strong className="text-slate-900">{recommendation.estimatedTimeline}</strong>
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-800 font-bold bg-emerald-100/80 px-2.5 py-1 rounded-md">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                      Statutory Compliant
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer Actions ───────────────────────────────────── */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="h-10 px-4 text-xs font-bold border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center gap-2 rounded-xl cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>Back</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-10 px-4 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
          )}

          {currentStep < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="h-10 px-6 text-xs font-bold bg-[#12335f] hover:bg-[#0b2445] text-white flex items-center gap-2 rounded-xl shadow-xs cursor-pointer"
            >
              <span>Next</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onApplyMethod(recommendation.methodId);
                onClose();
              }}
              className="h-10 px-6 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 shadow-sm rounded-xl cursor-pointer"
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
