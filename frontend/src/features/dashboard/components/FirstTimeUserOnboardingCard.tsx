'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Landmark, 
  PackagePlus, 
  FileText,
  Building2,
  ExternalLink
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../lib/utils';

export interface OnboardingChecklistData {
  isProfileComplete?: boolean;
  profileVerified?: boolean;
  isBankAdded?: boolean;
  bankAccountLinked?: boolean;
  hasCatalogueItem?: boolean;
  hasDeliveryAddress?: boolean;
  catalogueItemsListed?: boolean;
  hasSubmittedBid?: boolean;
  hasPublishedProcurement?: boolean;
  firstBidSubmitted?: boolean;
  completionPercentage?: number;
  steps?: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
    href: string;
  }>;
}

interface FirstTimeUserOnboardingCardProps {
  checklist?: OnboardingChecklistData | null;
  role?: string;
  className?: string;
}

export function FirstTimeUserOnboardingCard({
  checklist,
  role = 'seller',
  className
}: FirstTimeUserOnboardingCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!checklist) return null;

  const percentage = checklist.completionPercentage ?? 0;
  // If 100% complete, we don't need to dominate the dashboard screen
  if (percentage >= 100) return null;

  const isBuyer = role === 'buyer';

  const step1Done = Boolean(checklist.isProfileComplete ?? checklist.profileVerified);
  const step2Done = Boolean(checklist.isBankAdded ?? checklist.bankAccountLinked ?? (isBuyer && checklist.hasDeliveryAddress));
  const step3Done = Boolean(
    isBuyer 
      ? (checklist.hasDeliveryAddress ?? checklist.catalogueItemsListed)
      : (checklist.hasCatalogueItem ?? checklist.catalogueItemsListed)
  );
  const step4Done = Boolean(
    isBuyer
      ? (checklist.hasPublishedProcurement ?? checklist.firstBidSubmitted)
      : (checklist.hasSubmittedBid ?? checklist.firstBidSubmitted)
  );

  const steps = [
    {
      id: 'step-1',
      title: 'Organization & Compliance Verification',
      desc: isBuyer
        ? 'Upload procurement department authorization & GSTIN/PAN documents.'
        : 'Verify MSME Udyam registration, GSTIN, and business credentials.',
      isDone: step1Done,
      ctaText: 'Verify Profile',
      ctaPath: isBuyer ? '/buyer/profile' : '/seller/settings',
      icon: ShieldCheck
    },
    {
      id: 'step-2',
      title: isBuyer ? 'Delivery Addresses & Locations' : 'Bank Account & Escrow Integration',
      desc: isBuyer
        ? 'Register consignee delivery locations for direct PO shipping.'
        : 'Link active bank account and verify IFSC for direct escrow settlements.',
      isDone: step2Done,
      ctaText: isBuyer ? 'Add Address' : 'Link Bank Account',
      ctaPath: isBuyer ? '/buyer/profile' : '/seller/settings',
      icon: isBuyer ? Building2 : Landmark
    },
    {
      id: 'step-3',
      title: isBuyer ? 'Review Procurement Approvals' : 'Catalogue Products & Services',
      desc: isBuyer
        ? 'Establish requisition rules and financial delegation thresholds.'
        : 'List at least one manufactured product or service with unit specifications.',
      isDone: step3Done,
      ctaText: isBuyer ? 'Review Approvals' : 'Publish Product',
      ctaPath: isBuyer ? '/approvals' : '/seller/catalogue',
      icon: isBuyer ? ShieldCheck : PackagePlus
    },
    {
      id: 'step-4',
      title: isBuyer ? 'Publish First Procurement / RFQ' : 'Submit First Competitive Bid',
      desc: isBuyer
        ? 'Create and publish your first Request for Quotation or Open Tender.'
        : 'Explore live public opportunities and submit a compliant quote.',
      isDone: step4Done,
      ctaText: isBuyer ? 'Create Procurement' : 'Explore Tenders',
      ctaPath: isBuyer ? '/buyer/create-bid' : '/seller/opportunities',
      icon: FileText
    }
  ];

  const completedCount = steps.filter((s) => s.isDone).length;

  return (
    <Card
      role="region"
      aria-label="Account Onboarding Checklist"
      className={cn(
        "overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-sm transition-all",
        className
      )}
    >
      <div className="bg-gradient-to-r from-[#12335f] to-[#1e4986] p-4 sm:p-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-xs">
              <Sparkles className="h-5 w-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Quick Start Guide
                </span>
                <span className="text-white/40">•</span>
                <span className="text-xs font-semibold text-blue-100">
                  {completedCount} of 4 steps completed
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Complete Your Account Setup
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label={isCollapsed ? "Expand onboarding checklist" : "Collapse onboarding checklist"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-blue-100">
            <span>Onboarding Progress</span>
            <span className="text-white font-extrabold">{percentage}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/20">
            <div
              className="h-full bg-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${percentage}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl p-3.5 border transition-all",
                    step.isDone
                      ? "border-emerald-200/80 bg-emerald-50/40 text-slate-800"
                      : "border-slate-200 bg-slate-50/60 hover:bg-slate-50 text-slate-800"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-400">
                        <span>Step {idx + 1}</span>
                      </div>
                      {step.isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg shrink-0 mt-0.5",
                          step.isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-200/70 text-slate-700"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 leading-snug">
                        {step.title}
                      </h3>
                    </div>

                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="pt-3 mt-2 border-t border-slate-200/50">
                    {step.isDone ? (
                      <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completed
                      </span>
                    ) : (
                      <Link href={step.ctaPath}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full h-8 text-[11px] font-bold text-[#12335f] hover:bg-[#12335f] hover:text-white border-[#12335f]/30 justify-between transition-colors rounded-lg cursor-pointer"
                        >
                          <span>{step.ctaText}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export default FirstTimeUserOnboardingCard;
