import React from 'react';

export interface MaskedDataDisplayProps {
  value: string | null | undefined;
  type?: 'aadhaar' | 'pan' | 'bankAccount' | 'gst' | 'phone' | 'email' | 'generic';
  className?: string;
  fallbackText?: string;
}

/**
 * VPAT / WCAG 2.1 AA Compliant Masked Data Component
 *
 * Screen readers verbalize raw asterisks ("* * * * 1 2 3 4") unintelligibly.
 * This component provides an accessible semantic description (via role="text" and aria-label)
 * while preserving visual masking for sighted users.
 */
export const MaskedDataDisplay: React.FC<MaskedDataDisplayProps> = ({
  value,
  type = 'generic',
  className = '',
  fallbackText = '—'
}) => {
  if (!value || String(value).trim() === '') {
    return <span className={className}>{fallbackText}</span>;
  }

  const clean = String(value).trim();
  const digits = clean.replace(/[^a-zA-Z0-9]/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : digits;

  let accessibleLabel = `Identifier ending in ${last4}`;

  switch (type) {
    case 'aadhaar':
      accessibleLabel = `Masked Aadhaar number ending in ${last4}`;
      break;
    case 'pan':
      accessibleLabel = `Masked PAN identification ending in ${last4}`;
      break;
    case 'bankAccount':
      accessibleLabel = `Masked bank account ending in ${last4}`;
      break;
    case 'gst':
      accessibleLabel = `Masked GSTIN identification ending in ${last4}`;
      break;
    case 'phone':
      accessibleLabel = `Masked mobile number ending in ${last4}`;
      break;
    case 'email':
      accessibleLabel = `Masked email address`;
      break;
    default:
      accessibleLabel = `Masked value ending in ${last4}`;
  }

  return (
    <span
      className={className}
      role="text"
      aria-label={accessibleLabel}
      title={accessibleLabel}
    >
      {clean}
    </span>
  );
};
