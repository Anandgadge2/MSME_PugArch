export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_REVIEW: 'users:review',
  USERS_UNLOCK: 'users:unlock',
  TENDERS_READ: 'tenders:read',
  TENDERS_WRITE: 'tenders:write',
  TENDERS_BIDS_READ: 'tenders:bids:read',
  TENDERS_STATUS_WRITE: 'tenders:status:write',
  BIDS_READ: 'bids:read',
  BIDS_WRITE: 'bids:write',
  BIDS_STATUS_WRITE: 'bids:status:write',
  VENDORS_READ: 'vendors:read',
  QUOTATIONS_READ: 'quotations:read',
  QUOTATIONS_WRITE: 'quotations:write',
  ONBOARDING_WRITE_SELF: 'onboarding:write:self',
  ONBOARDING_REVIEW: 'onboarding:review',
  COMPLIANCE_READ: 'compliance:read',
  COMPLIANCE_OVERRIDE: 'compliance:override',
  AUDIT_READ: 'audit:read',
  FILES_WRITE: 'files:write'
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  buyer: [
    PERMISSIONS.TENDERS_READ,
    PERMISSIONS.TENDERS_WRITE,
    PERMISSIONS.TENDERS_BIDS_READ,
    PERMISSIONS.TENDERS_STATUS_WRITE,
    PERMISSIONS.BIDS_STATUS_WRITE,
    PERMISSIONS.VENDORS_READ,
    PERMISSIONS.BIDS_READ,
    PERMISSIONS.QUOTATIONS_READ,
    PERMISSIONS.QUOTATIONS_WRITE,
    PERMISSIONS.ONBOARDING_WRITE_SELF,
    PERMISSIONS.FILES_WRITE
  ],
  seller: [
    PERMISSIONS.TENDERS_READ,
    PERMISSIONS.BIDS_WRITE,
    PERMISSIONS.BIDS_READ,
    PERMISSIONS.QUOTATIONS_READ,
    PERMISSIONS.ONBOARDING_WRITE_SELF,
    PERMISSIONS.FILES_WRITE
  ]
};

export const can = (user: { role?: string } | undefined, permission: Permission) =>
  Boolean(user?.role && ROLE_PERMISSIONS[user.role]?.includes(permission));

export const FOUNDATION_PERMISSION_CODES = {
  USER_CREATE: 'user.create',
  USER_BLOCK: 'user.block',
  ONBOARDING_REVIEW: 'onboarding.review',
  SELLER_CATALOGUE_CREATE: 'seller.catalogue.create',
  REQUIREMENT_CREATE: 'requirement.create',
  TENDER_CREATE: 'tender.create',
  TENDER_PUBLISH: 'tender.publish',
  BID_SUBMIT: 'bid.submit',
  BID_EVALUATE: 'bid.evaluate',
  PO_GENERATE: 'po.generate',
  DELIVERY_UPDATE: 'delivery.update',
  INSPECTION_CREATE: 'inspection.create',
  INVOICE_SUBMIT: 'invoice.submit',
  INVOICE_VERIFY: 'invoice.verify',
  PAYMENT_INITIATE: 'payment.initiate',
  ESCROW_RELEASE: 'escrow.release',
  DISPUTE_MANAGE: 'dispute.manage',
  AUDIT_VIEW: 'audit.view',
  ADMIN_REPORTS_VIEW: 'admin.reports.view',
  COMPLIANCE_REVIEW: 'compliance.review',
  FRAUD_REVIEW: 'fraud.review'
} as const;

export type FoundationPermissionCode =
  (typeof FOUNDATION_PERMISSION_CODES)[keyof typeof FOUNDATION_PERMISSION_CODES];
