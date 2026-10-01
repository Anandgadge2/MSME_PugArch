/**
 * Procurement Workflow Action Engine (Single Source of Truth)
 * Consolidates all lifecycle checks, sealing rules, and primary action determination
 * so that the Procurement Highway (orientation) and Header Toolbar (execution)
 * always operate in 100% synchronized harmony with zero state drift or duplicate buttons.
 */

export type ProcurementActionType =
  | 'SELLER_AWAITING_WINDOW'
  | 'SELLER_SUBMIT_QUOTE'
  | 'SELLER_VIEW_SUBMITTED'
  | 'SELLER_WINDOW_CLOSED'
  | 'BUYER_SEALED_AWAITING_CLOSING'
  | 'BUYER_EVALUATE_PROPOSALS'
  | 'BUYER_ISSUE_CALL_OFF'
  | 'BUYER_VIEW_RESULTS'
  | 'CONCLUDED_OR_CANCELLED';

export interface ProcurementPrimaryAction {
  type: ProcurementActionType;
  label: string;
  subtext?: string;
  isExecutable: boolean;
  isSealedLock: boolean;
  unlocksAt?: Date | string | null;
  targetTab?: 'overview' | 'scope' | 'clarifications' | 'terms';
  badgeTone?: 'emerald' | 'amber' | 'sky' | 'rose' | 'slate';
}

export interface DeriveActionParams {
  isBuyer: boolean;
  isCancelled: boolean;
  isContractSettled: boolean;
  isBidAwarded: boolean;
  isRateContract: boolean;
  isAwardAccepted: boolean;
  isBeforeSubmissionStart: boolean;
  isDeadlinePassed: boolean;
  isBiddingClosed: boolean;
  isEvaluationReady: boolean;
  isSellerParticipated: boolean;
  hasSubmittedProposal: boolean;
  submittedBidsCount: number;
  technicalOpeningDate?: Date | string | null;
  closingDate?: Date | string | null;
  submissionStartDateFormatted?: string;
  closingDateFormatted?: string;
  technicalDateFormatted?: string;
  submitButtonLabel?: string;
  isReverseAuction?: boolean;
}

export function deriveProcurementPrimaryAction(
  params: DeriveActionParams
): ProcurementPrimaryAction {
  const {
    isBuyer,
    isCancelled,
    isContractSettled,
    isBidAwarded,
    isRateContract,
    isAwardAccepted,
    isBeforeSubmissionStart,
    isDeadlinePassed,
    isBiddingClosed,
    isEvaluationReady,
    isSellerParticipated,
    hasSubmittedProposal,
    submittedBidsCount,
    technicalOpeningDate,
    closingDate,
    submissionStartDateFormatted,
    closingDateFormatted,
    technicalDateFormatted,
    submitButtonLabel,
    isReverseAuction
  } = params;

  // 1. Cancelled or Terminated State
  if (isCancelled) {
    return {
      type: 'CONCLUDED_OR_CANCELLED',
      label: 'Procurement Cancelled',
      subtext: 'This procurement event has been officially cancelled.',
      isExecutable: false,
      isSealedLock: false,
      badgeTone: 'rose'
    };
  }

  // 2. Fully Completed / Settled
  if (isContractSettled) {
    return {
      type: 'CONCLUDED_OR_CANCELLED',
      label: 'Contract Settled',
      subtext: 'All contract milestones successfully executed.',
      isExecutable: false,
      isSealedLock: false,
      badgeTone: 'emerald'
    };
  }

  // ==========================================
  // BUYER / ADMIN ACTION WORKFLOW
  // ==========================================
  if (isBuyer) {
    // 2.1 Awarded / Call-Off Order Ready
    if (isBidAwarded) {
      if (isRateContract && isAwardAccepted) {
        return {
          type: 'BUYER_ISSUE_CALL_OFF',
          label: '+ Issue Call-Off Order',
          subtext: 'Rate agreement active — issue purchase orders against locked unit rates',
          isExecutable: true,
          isSealedLock: false,
          badgeTone: 'emerald'
        };
      }
      return {
        type: 'BUYER_VIEW_RESULTS',
        label: isReverseAuction
          ? 'View Reverse Auction Outcome'
          : 'View Awarded Results & Ranking',
        subtext: 'Contract awarded — view final rankings and bid audit',
        isExecutable: true,
        isSealedLock: false,
        targetTab: 'clarifications',
        badgeTone: 'emerald'
      };
    }

    // 2.2 Sealed State: Bidding window is open or technical opening date has not elapsed
    if (!isEvaluationReady) {
      const targetOpening = technicalOpeningDate || closingDate;
      const displayOpeningTime = technicalDateFormatted || closingDateFormatted || 'the scheduled closing';
      return {
        type: 'BUYER_SEALED_AWAITING_CLOSING',
        label: 'Evaluation Opens at Closing',
        subtext: `Proposals remain encrypted and sealed until ${displayOpeningTime}`,
        isExecutable: false,
        isSealedLock: true,
        unlocksAt: targetOpening,
        badgeTone: 'amber'
      };
    }

    // 2.3 Ready for Evaluation
    return {
      type: 'BUYER_EVALUATE_PROPOSALS',
      label:
        submitButtonLabel ||
        (submittedBidsCount > 0
          ? `Evaluate Proposals & Rank Bids (${submittedBidsCount}) →`
          : 'Evaluate Proposals & Rank Bids →'),
      subtext: `${submittedBidsCount} proposal${submittedBidsCount === 1 ? '' : 's'} unsealed and ready for technical & financial scrutiny`,
      isExecutable: true,
      isSealedLock: false,
      targetTab: 'clarifications',
      badgeTone: 'sky'
    };
  }

  // ==========================================
  // SELLER / VENDOR ACTION WORKFLOW
  // ==========================================

  // 3.1 Seller already submitted quote
  if (isSellerParticipated || hasSubmittedProposal) {
    return {
      type: 'SELLER_VIEW_SUBMITTED',
      label: isRateContract ? 'View Submitted Rate Proposal' : 'View Submitted Quotation',
      subtext: 'Your proposal was securely submitted and is sealed until opening',
      isExecutable: true,
      isSealedLock: false,
      badgeTone: 'emerald'
    };
  }

  // 3.2 Bidding start date is in the future
  if (isBeforeSubmissionStart) {
    return {
      type: 'SELLER_AWAITING_WINDOW',
      label: submissionStartDateFormatted ? `Submission Opens ${submissionStartDateFormatted}` : 'Submission Opens Soon',
      subtext: 'Bidding window is scheduled to open in the future',
      isExecutable: false,
      isSealedLock: true,
      unlocksAt: params.submissionStartDateFormatted,
      badgeTone: 'sky'
    };
  }

  // 3.3 Bidding closed or deadline passed without participating
  if (isBiddingClosed || isDeadlinePassed) {
    return {
      type: 'SELLER_WINDOW_CLOSED',
      label: 'Submission Window Closed',
      subtext: `The deadline elapsed on ${closingDateFormatted || 'schedule'}. New proposals are closed.`,
      isExecutable: false,
      isSealedLock: false,
      badgeTone: 'slate'
    };
  }

  // 3.4 Actively open for quotation submission
  return {
    type: 'SELLER_SUBMIT_QUOTE',
    label: isRateContract ? 'Submit Rate Quotation →' : 'Submit Quotation →',
    subtext: `Accepting proposals until ${closingDateFormatted || 'deadline'}`,
    isExecutable: true,
    isSealedLock: false,
    badgeTone: 'emerald'
  };
}
