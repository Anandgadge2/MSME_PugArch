import type { OrgStatus } from '../hooks/useOrgRole';

/**
 * Resolves the official display organization name from the user session and org status.
 * Evaluates verified organization records, buyer/seller profiles, and registration metadata.
 */
export function getResolvedOrgName(user: any, orgStatus?: OrgStatus | null): string {
  if (!user && !orgStatus) return '';
  const reg = ((user?.registrationDetails) || {}) as Record<string, any>;
  const raw = (
    orgStatus?.organization?.organizationName ||
    user?.organization?.organizationName ||
    user?.buyerProfile?.organizationName ||
    user?.sellerProfile?.businessName ||
    user?.sellerProfile?.companyName ||
    user?.sellerProfile?.nameAsInPan ||
    user?.buyerProfile?.departmentName ||
    user?.buyerProfile?.entityName ||
    user?.buyerProfile?.companyName ||
    user?.shgProfile?.groupName ||
    user?.shgProfile?.shgName ||
    reg.organizationName ||
    reg.businessName ||
    reg.companyName ||
    reg.organisation ||
    reg.enterpriseName ||
    reg.legalName ||
    reg.tradeName ||
    ''
  );

  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}
