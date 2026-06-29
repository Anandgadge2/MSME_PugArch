export const ACCOUNT_TYPE_IDS = {
  MASTER_ADMIN: 0,
  SUPERADMIN: 1,
  SELLER: 2,
  BUYER: 3,
  SHG: 4,
  FINANCIER: 5
} as const;

export const legacyRoleToAccountType = (role?: string | null) => {
  switch (role) {
    case 'master_admin':
      return { accountType: 'MASTER_ADMIN', accountTypeId: ACCOUNT_TYPE_IDS.MASTER_ADMIN };
    case 'admin':
      return { accountType: 'SUPERADMIN', accountTypeId: ACCOUNT_TYPE_IDS.SUPERADMIN };
    case 'seller':
      return { accountType: 'SELLER', accountTypeId: ACCOUNT_TYPE_IDS.SELLER };
    case 'shg':
      return { accountType: 'SHG', accountTypeId: ACCOUNT_TYPE_IDS.SHG };
    case 'financier':
      return { accountType: 'FINANCIER', accountTypeId: ACCOUNT_TYPE_IDS.FINANCIER };
    case 'buyer':
    default:
      return { accountType: 'BUYER', accountTypeId: ACCOUNT_TYPE_IDS.BUYER };
  }
};

export const RBAC_PERMISSION_CATALOG = [
  ['dashboard.view', 'Dashboard', 'view', 'dashboard', 'View dashboard summaries'],
  ['user.view', 'Users', 'view', 'user', 'View users'],
  ['user.create', 'Users', 'create', 'user', 'Create users'],
  ['user.update', 'Users', 'update', 'user', 'Update users'],
  ['user.block', 'Users', 'block', 'user', 'Block or disable users'],
  ['team.member.view', 'Team Management', 'view', 'team.member', 'View team members'],
  ['team.member.invite', 'Team Management', 'invite', 'team.member', 'Invite team members'],
  ['team.member.disable', 'Team Management', 'disable', 'team.member', 'Disable team members'],
  ['team.role.view', 'Team Management', 'view', 'team.role', 'View team roles'],
  ['team.role.manage', 'Team Management', 'manage', 'team.role', 'Create and update roles'],
  ['team.role.assign', 'Team Management', 'assign', 'team.role', 'Assign roles to users'],
  ['approval.view', 'Approvals', 'view', 'approval', 'View approval queues and history'],
  ['approval.submit', 'Approvals', 'submit', 'approval', 'Start approval chains'],
  ['approval.approve', 'Approvals', 'approve', 'approval', 'Approve items in workflow'],
  ['approval.reject', 'Approvals', 'reject', 'approval', 'Reject items in workflow'],
  ['approval.clarification.request', 'Approvals', 'clarification.request', 'approval', 'Request clarification in workflow'],
  ['organization.view', 'Organization', 'view', 'organization', 'View organization information'],
  ['organization.update', 'Organization', 'update', 'organization', 'Update organization information'],
  ['onboarding.review', 'Onboarding', 'review', 'onboarding', 'Review onboarding submissions'],
  ['seller.verify', 'Onboarding', 'verify', 'seller', 'Verify sellers'],
  ['buyer.approve', 'Onboarding', 'approve', 'buyer', 'Approve buyers'],
  ['catalogue.product.view', 'Catalogue', 'view', 'catalogue.product', 'View catalogue products'],
  ['catalogue.product.create', 'Catalogue', 'create', 'catalogue.product', 'Create catalogue products'],
  ['catalogue.product.update', 'Catalogue', 'update', 'catalogue.product', 'Update catalogue products'],
  ['catalogue.product.delete', 'Catalogue', 'delete', 'catalogue.product', 'Delete catalogue products'],
  ['catalogue.service.view', 'Catalogue', 'view', 'catalogue.service', 'View catalogue services'],
  ['catalogue.service.create', 'Catalogue', 'create', 'catalogue.service', 'Create catalogue services'],
  ['catalogue.service.update', 'Catalogue', 'update', 'catalogue.service', 'Update catalogue services'],
  ['catalogue.service.delete', 'Catalogue', 'delete', 'catalogue.service', 'Delete catalogue services'],
  ['marketplace.view', 'Marketplace', 'view', 'marketplace', 'View marketplace'],
  ['requirement.view', 'Requirements', 'view', 'requirement', 'View requirements'],
  ['requirement.create', 'Requirements', 'create', 'requirement', 'Create requirements'],
  ['requirement.publish', 'Requirements', 'publish', 'requirement', 'Publish requirements'],
  ['tender.view', 'Tender', 'view', 'tender', 'View tenders'],
  ['tender.create', 'Tender', 'create', 'tender', 'Create tenders'],
  ['tender.update', 'Tender', 'update', 'tender', 'Update tenders'],
  ['tender.publish', 'Tender', 'publish', 'tender', 'Publish tenders'],
  ['bid.submit', 'Bid Evaluation', 'submit', 'bid', 'Submit bids'],
  ['bid.technical.evaluate', 'Bid Evaluation', 'technical.evaluate', 'bid', 'Evaluate technical bids'],
  ['bid.financial.evaluate', 'Bid Evaluation', 'financial.evaluate', 'bid', 'Evaluate financial bids'],
  ['award.recommend', 'Bid Evaluation', 'recommend', 'award', 'Recommend awards'],
  ['purchase_order.view', 'Purchase Order', 'view', 'purchase_order', 'View purchase orders'],
  ['purchase_order.create', 'Purchase Order', 'create', 'purchase_order', 'Create purchase orders'],
  ['purchase_order.approve', 'Purchase Order', 'approve', 'purchase_order', 'Approve purchase orders'],
  ['cart.view', 'Cart', 'view', 'cart', 'View organization carts'],
  ['cart.add', 'Cart', 'add', 'cart', 'Add items to organization carts'],
  ['cart.submit_for_approval', 'Cart', 'submit_for_approval', 'cart', 'Submit carts for approval'],
  ['checkout.initiate', 'Checkout', 'initiate', 'checkout', 'Start procurement checkout'],
  ['checkout.approve', 'Checkout', 'approve', 'checkout', 'Approve procurement checkout'],
  ['reverse_auction.view', 'Reverse Auction', 'view', 'reverse_auction', 'View reverse auctions'],
  ['reverse_auction.create', 'Reverse Auction', 'create', 'reverse_auction', 'Create reverse auctions'],
  ['reverse_auction.update', 'Reverse Auction', 'update', 'reverse_auction', 'Update reverse auctions'],
  ['reverse_auction.publish', 'Reverse Auction', 'publish', 'reverse_auction', 'Publish or schedule reverse auctions'],
  ['reverse_auction.invite_seller', 'Reverse Auction', 'invite_seller', 'reverse_auction', 'Invite sellers to reverse auctions'],
  ['reverse_auction.bid.submit', 'Reverse Auction', 'submit', 'reverse_auction.bid', 'Submit reverse auction bids'],
  ['reverse_auction.close', 'Reverse Auction', 'close', 'reverse_auction', 'Close or cancel reverse auctions'],
  ['reverse_auction.award', 'Reverse Auction', 'award', 'reverse_auction', 'Recommend reverse auction awards'],
  ['delivery.view', 'Delivery', 'view', 'delivery', 'View deliveries'],
  ['delivery.create', 'Delivery', 'create', 'delivery', 'Create deliveries'],
  ['delivery.update', 'Delivery', 'update', 'delivery', 'Update deliveries'],
  ['delivery.dispatch', 'Delivery', 'dispatch', 'delivery', 'Dispatch deliveries'],
  ['delivery.confirm', 'Delivery', 'confirm', 'delivery', 'Confirm deliveries'],
  ['grn.view', 'Delivery / GRN', 'view', 'grn', 'View goods receipt notes'],
  ['grn.create', 'Delivery / GRN', 'create', 'grn', 'Create goods receipt notes'],
  ['grn.approve', 'Delivery / GRN', 'approve', 'grn', 'Approve goods receipt notes'],
  ['inspection.view', 'Inspection', 'view', 'inspection', 'View inspections'],
  ['inspection.create', 'Inspection', 'create', 'inspection', 'Create inspections'],
  ['inspection.approve', 'Inspection', 'approve', 'inspection', 'Approve inspections'],
  ['invoice.view', 'Invoice', 'view', 'invoice', 'View invoices'],
  ['invoice.approve', 'Invoice', 'approve', 'invoice', 'Approve invoices'],
  ['payment.view', 'Payment', 'view', 'payment', 'View payments'],
  ['payment.initiate', 'Payment', 'initiate', 'payment', 'Initiate payments'],
  ['payment.verify', 'Payment', 'verify', 'payment', 'Verify payments'],
  ['escrow.view', 'Escrow', 'view', 'escrow', 'View escrow records'],
  ['escrow.release', 'Escrow', 'release', 'escrow', 'Release escrow'],
  ['dispute.view', 'Dispute', 'view', 'dispute', 'View disputes'],
  ['dispute.manage', 'Dispute', 'manage', 'dispute', 'Manage disputes'],
  ['report.view', 'Reports', 'view', 'report', 'View reports'],
  ['report.export', 'Reports', 'export', 'report', 'Export reports'],
  ['audit.view', 'Audit', 'view', 'audit', 'View audit logs'],
  ['settings.manage', 'Settings', 'manage', 'settings', 'Manage settings']
] as const;

export const DEFAULT_DYNAMIC_ROLE_TEMPLATES = [
  {
    code: 'PLATFORM_ADMINISTRATOR',
    name: 'Platform Administrator',
    description: 'Default template for platform administrators.',
    permissionCodes: RBAC_PERMISSION_CATALOG.map(([code]) => code)
  },
  {
    code: 'COLLECTOR_ADMINISTRATOR',
    name: 'Collector Administrator',
    description: 'Default template for district and collector office administrators.',
    permissionCodes: ['dashboard.view', 'user.view', 'team.member.view', 'team.member.invite', 'team.member.disable', 'team.role.view', 'team.role.manage', 'team.role.assign', 'organization.view', 'organization.update', 'onboarding.review', 'seller.verify', 'buyer.approve', 'report.view', 'report.export', 'audit.view']
  },
  {
    code: 'ORGANIZATION_ADMINISTRATOR',
    name: 'Organization Administrator',
    description: 'Default template for organization administrators.',
    permissionCodes: RBAC_PERMISSION_CATALOG.map(([code]) => code)
  },
  {
    code: 'TENDER_CREATOR',
    name: 'Tender Creator',
    description: 'Can draft and update tender records.',
    permissionCodes: ['dashboard.view', 'requirement.view', 'requirement.create', 'tender.view', 'tender.create', 'tender.update']
  },
  {
    code: 'TENDER_PUBLISHER',
    name: 'Tender Publisher',
    description: 'Can publish tenders and requirements.',
    permissionCodes: ['dashboard.view', 'requirement.view', 'requirement.publish', 'tender.view', 'tender.publish']
  },
  {
    code: 'TECHNICAL_EVALUATOR',
    name: 'Technical Evaluator',
    description: 'Can evaluate technical bid packets.',
    permissionCodes: ['dashboard.view', 'tender.view', 'bid.technical.evaluate']
  },
  {
    code: 'FINANCE_APPROVER',
    name: 'Finance Approver',
    description: 'Can approve invoices and verify payments.',
    permissionCodes: ['dashboard.view', 'invoice.view', 'invoice.approve', 'payment.view', 'payment.verify']
  },
  {
    code: 'CATALOGUE_MANAGER',
    name: 'Catalogue Manager',
    description: 'Can maintain organization catalogue.',
    permissionCodes: ['dashboard.view', 'catalogue.product.view', 'catalogue.product.create', 'catalogue.product.update', 'catalogue.product.delete', 'catalogue.service.view', 'catalogue.service.create', 'catalogue.service.update', 'catalogue.service.delete']
  },
  {
    code: 'INVOICE_MANAGER',
    name: 'Invoice Manager',
    description: 'Can view and approve invoices.',
    permissionCodes: ['dashboard.view', 'invoice.view', 'invoice.approve']
  },
  {
    code: 'DELIVERY_MANAGER',
    name: 'Delivery Manager',
    description: 'Can create and approve delivery/GRN records.',
    permissionCodes: ['dashboard.view', 'grn.view', 'grn.create', 'grn.approve', 'purchase_order.view']
  },
  {
    code: 'PAYMENT_VERIFIER',
    name: 'Payment Verifier',
    description: 'Can verify payment evidence and view payment records.',
    permissionCodes: ['dashboard.view', 'payment.view', 'payment.verify']
  },
  {
    code: 'REPORT_VIEWER',
    name: 'Report Viewer',
    description: 'Read-only reporting access.',
    permissionCodes: ['dashboard.view', 'report.view']
  },
  {
    code: 'TEAM_MANAGER',
    name: 'Team Manager',
    description: 'Can invite members and manage scoped role assignments.',
    permissionCodes: ['dashboard.view', 'team.member.view', 'team.member.invite', 'team.member.disable', 'team.role.view', 'team.role.manage', 'team.role.assign']
  }
] as const;
