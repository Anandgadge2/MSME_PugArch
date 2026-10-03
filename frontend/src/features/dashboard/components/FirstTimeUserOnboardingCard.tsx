'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  CheckCircle2, 
  ArrowRight, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  Landmark, 
  PackagePlus, 
  FileText,
  Building2,
  ShoppingBag
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
  hasIssuedPO?: boolean;
  firstBidSubmitted?: boolean;
  completedSteps?: number;
  totalSteps?: number;
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

  const isBuyer = role === 'buyer';

  const getStepIcon = (id: string, isDone: boolean) => {
    switch (id) {
      case 'profile':
      case 'step-1':
        return ShieldCheck;
      case 'delivery-address':
        return Building2;
      case 'bank':
      case 'step-2':
        return isBuyer ? Building2 : Landmark;
      case 'procurement':
        return FileText;
      case 'catalogue':
      case 'step-3':
        return isBuyer ? FileText : PackagePlus;
      case 'po':
        return ShoppingBag;
      case 'quote':
      case 'step-4':
      default:
        return isBuyer ? ShoppingBag : FileText;
    }
  };

  const getStepCtaText = (id: string, isBuyerRole: boolean) => {
    switch (id) {
      case 'profile':
      case 'step-1':
        return 'Verify Profile';
      case 'delivery-address':
        return 'Add Address';
      case 'bank':
        return 'Link Bank Account';
      case 'procurement':
        return 'Create Procurement';
      case 'catalogue':
        return 'Add Products';
      case 'po':
        return 'View Orders';
      case 'quote':
        return 'Explore Tenders';
      default:
        return 'Get Started';
    }
  };

  // Build steps using backend checklist.steps if available, or compute fallback steps
  const steps = (checklist.steps && checklist.steps.length > 0)
    ? checklist.steps.map((step, idx) => ({
        id: step.id || `step-${idx + 1}`,
        title: step.title,
        desc: step.description,
        isDone: Boolean(step.completed),
        ctaText: getStepCtaText(step.id, isBuyer),
        ctaPath: step.href || (isBuyer ? '/buyer/onboarding' : '/seller/onboarding'),
        icon: getStepIcon(step.id, Boolean(step.completed))
      }))
    : isBuyer
    ? [
        {
          id: 'profile',
          title: 'Department Profile Verification',
          desc: 'Upload procurement department authorization & GSTIN/PAN documents.',
          isDone: Boolean(checklist.isProfileComplete ?? checklist.profileVerified),
          ctaText: 'Verify Profile',
          ctaPath: '/buyer/onboarding',
          icon: ShieldCheck
        },
        {
          id: 'delivery-address',
          title: 'Consignee Delivery Locations',
          desc: 'Register consignee delivery locations for direct PO shipping.',
          isDone: Boolean(checklist.hasDeliveryAddress),
          ctaText: 'Add Address',
          ctaPath: '/buyer/onboarding?tab=addresses',
          icon: Building2
        },
        {
          id: 'procurement',
          title: 'Publish First Sourcing Notice',
          desc: 'Create and publish your first Request for Quotation or Open Tender.',
          isDone: Boolean(checklist.hasPublishedProcurement),
          ctaText: 'Create Procurement',
          ctaPath: '/procurements/create',
          icon: FileText
        },
        {
          id: 'po',
          title: 'Contract Award & Order Release',
          desc: 'Evaluate vendor bids and issue your first Purchase Order.',
          isDone: Boolean(checklist.hasIssuedPO),
          ctaText: 'View Orders',
          ctaPath: '/buyer/orders',
          icon: ShoppingBag
        }
      ]
    : [
        {
          id: 'profile',
          title: 'Business Verification',
          desc: 'Verify MSME Udyam registration, GSTIN, and business credentials.',
          isDone: Boolean(checklist.isProfileComplete ?? checklist.profileVerified),
          ctaText: 'Verify Profile',
          ctaPath: '/seller/onboarding',
          icon: ShieldCheck
        },
        {
          id: 'bank',
          title: 'Bank Account Linked',
          desc: 'Link active bank account and verify IFSC for direct escrow settlements.',
          isDone: Boolean(checklist.isBankAdded ?? checklist.bankAccountLinked),
          ctaText: 'Link Bank Account',
          ctaPath: '/seller/onboarding?tab=bank',
          icon: Landmark
        },
        {
          id: 'catalogue',
          title: 'First Catalogue Listing',
          desc: 'List at least one manufactured product or service with unit specifications.',
          isDone: Boolean(checklist.hasCatalogueItem ?? checklist.catalogueItemsListed),
          ctaText: 'Add Products',
          ctaPath: '/seller/catalogue',
          icon: PackagePlus
        },
        {
          id: 'quote',
          title: 'Submit First Bid / Quote',
          desc: 'Explore live public opportunities and submit a compliant quote.',
          isDone: Boolean(checklist.hasSubmittedBid ?? checklist.firstBidSubmitted),
          ctaText: 'Explore Tenders',
          ctaPath: '/seller/opportunities',
          icon: FileText
        }
      ];

  const totalSteps = steps.length;
  const completedCount = steps.filter((s) => s.isDone).length;
  // Always derive percentage directly from actual steps to guarantee perfect synchronization
  const percentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : (checklist.completionPercentage ?? 0);

  // If 100% complete, we don't need to take up space on the dashboard
  if (percentage >= 100) return null;

  return (
    <Card
      role="region"
      aria-label="Account Onboarding Checklist"
      className={cn(
        "overflow-hidden rounded-2xl border-slate-200 bg-white shadow-xs transition-all",
        className
      )}
    >
      <div className="bg-gradient-to-r from-slate-50 via-blue-50/30 to-slate-50/60 p-4 sm:p-5 border-b border-slate-200/80">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200/60 shadow-xs">
              <Sparkles className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-200/60">
                  Quick Start Guide
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs font-semibold text-slate-600">
                  {completedCount} of {totalSteps} steps completed
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mt-0.5">
                Complete Your Account Setup
              </h2>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label={isCollapsed ? "Expand onboarding checklist" : "Collapse onboarding checklist"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Onboarding Progress</span>
            <span className="text-slate-900 font-extrabold">{percentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
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
        <CardContent className="p-4 sm:p-5 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {steps.map((step, idx) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col justify-between rounded-xl p-3.5 border transition-all",
                    step.isDone
                      ? "border-emerald-200 bg-emerald-50/40 text-slate-800"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs text-slate-800"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-400">
                        <span>Step {idx + 1}</span>
                      </div>
                      {step.isDone ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Done
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div
                        className={cn(
                          "p-1.5 rounded-lg shrink-0 mt-0.5",
                          step.isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600 border border-slate-200/60"
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

                  <div className="pt-3 mt-2 border-t border-slate-200/60">
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
