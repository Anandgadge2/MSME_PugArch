import { OrgRole, OrganizationType } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { ensureOrgMembership } from './org-membership.service.js';
import { getDefaultCompanyId } from './default-company.service.js';
import { ApiError } from '../utils/ApiError.js';

const ORGANIZATION_TYPES = new Set(Object.values(OrganizationType));

type ApprovalResult = {
  user: any;
  organization: {
    id: number;
    organizationName: string;
    organizationType: OrganizationType;
    verificationStatus: string;
    organizationOnboardingStatus: string | null;
  };
  membership: {
    id: number;
    userId: number;
    organizationId: number;
    orgRole: OrgRole;
    isActive: boolean;
    acceptedAt: Date | null;
  };
  createdOrganization: boolean;
  createdMembership: boolean;
};

const clean = (value: unknown) => String(value ?? '').trim();
const first = (...values: unknown[]) => values.map(clean).find(Boolean) || '';

const normalizeOrganizationType = (value: unknown, fallback: OrganizationType) => {
  const raw = clean(value).toUpperCase().replace(/[\s-]+/g, '_');
  if (ORGANIZATION_TYPES.has(raw as OrganizationType)) return raw as OrganizationType;
  if (raw.includes('GOVERNMENT') || raw === 'GOVT') return OrganizationType.GOVERNMENT;
  if (raw.includes('PSU') || raw.includes('PUBLIC_SECTOR')) return OrganizationType.PSU;
  if (raw.includes('PUBLIC')) return OrganizationType.PUBLIC_LIMITED;
  if (raw.includes('PRIVATE') || raw.includes('COMPANY')) return OrganizationType.PRIVATE_LIMITED;
  if (raw.includes('LLP')) return OrganizationType.LLP;
  if (raw.includes('PARTNER')) return OrganizationType.PARTNERSHIP;
  if (raw.includes('PROPRIET')) return OrganizationType.PROPRIETORSHIP;
  if (raw.includes('STARTUP')) return OrganizationType.STARTUP;
  if (raw.includes('MSME') || raw.includes('MICRO') || raw.includes('SMALL') || raw.includes('MEDIUM')) return OrganizationType.MSME;
  if (raw.includes('SHG') || raw.includes('SELF_HELP')) return OrganizationType.SHG;
  return fallback;
};

const organizationNameFor = (user: any) => {
  return first(
    user.organization?.organizationName,
    user.buyerProfile?.organizationName,
    user.shgProfile?.shgName,
    user.shgProfile?.groupName,
    user.sellerProfile?.businessName,
    user.sellerProfile?.nameAsInPan,
    user.registrationDetails?.shgName,
    user.registrationDetails?.businessName,
    user.registrationDetails?.organizationName,
    user.name,
    user.email ? user.email.split('@')[0] : '',
    'Enterprise'
  );
};

const organizationDataFor = (user: any) => {
  const primaryOffice = user.sellerProfile?.offices?.find((office: any) => office.isMandatory) || user.sellerProfile?.offices?.[0] || null;
  const organizationName = organizationNameFor(user);

  if (user.role === 'buyer') {
    const profile = user.buyerProfile || {};
    return {
      organizationName,
      organizationType: normalizeOrganizationType(profile.organizationTypeEnum || profile.organizationType || profile.businessType, OrganizationType.GOVERNMENT),
      addressLine1: first(profile.registeredAddress, profile.corporateAddress) || null,
      city: first(profile.city, profile.district) || 'Jharsuguda',
      district: first(profile.district, profile.city) || 'Jharsuguda',
      state: first(profile.state) || 'ODISHA',
      pincode: first(profile.pincode) || null,
      website: first(profile.website) || null,
      verificationStatus: 'VERIFIED' as const,
      organizationOnboardingStatus: 'approved_for_procurement'
    };
  }

  if (user.role === 'shg') {
    const shgProfile = user.shgProfile || {};
    const sellerProfile = user.sellerProfile || {};
    const regDetails = (user.registrationDetails as Record<string, any>) || {};
    return {
      organizationName,
      organizationType: OrganizationType.SHG,
      addressLine1: first(shgProfile.village, primaryOffice?.address, regDetails.address, regDetails.village) || null,
      city: first(shgProfile.block, shgProfile.district, primaryOffice?.city, regDetails.city, 'Jharsuguda') || 'Jharsuguda',
      district: first(shgProfile.district, (primaryOffice as any)?.district, regDetails.district, 'Jharsuguda') || 'Jharsuguda',
      state: first(shgProfile.state, primaryOffice?.state, regDetails.state, 'ODISHA') || 'ODISHA',
      pincode: first(shgProfile.pincode, primaryOffice?.pincode, regDetails.pincode) || null,
      website: first(shgProfile.website, null),
      verificationStatus: 'VERIFIED' as const,
      organizationOnboardingStatus: 'approved_for_procurement'
    };
  }

  const profile = user.sellerProfile || {};
  return {
    organizationName,
    organizationType: normalizeOrganizationType(profile.organizationTypeEnum || profile.organizationType || profile.msmeType, OrganizationType.MSME),
    addressLine1: first(primaryOffice?.address) || null,
    city: first(primaryOffice?.city) || 'Jharsuguda',
    district: first((primaryOffice as any)?.district, primaryOffice?.city) || 'Jharsuguda',
    state: first(primaryOffice?.state) || 'ODISHA',
    pincode: first(primaryOffice?.pincode) || null,
    website: null,
    verificationStatus: 'VERIFIED' as const,
    organizationOnboardingStatus: 'approved_for_procurement'
  };
};

const selectSafeOrganization = {
  id: true,
  organizationName: true,
  organizationType: true,
  verificationStatus: true,
  organizationOnboardingStatus: true
};

export async function approveOnboardingAndEnsureOrganization(userId: number, updateData: Record<string, unknown>): Promise<ApprovalResult> {
  return prisma.$transaction(async (tx) => {
    const defaultCompanyId = await getDefaultCompanyId(tx as any);
    const existing = await tx.user.findUnique({
      where: { id: userId },
      include: {
        buyerProfile: true,
        shgProfile: true,
        sellerProfile: {
          include: {
            offices: true,
            bankAccounts: { select: { id: true, isPrimary: true, isVerified: true } },
            sellerDocuments: { select: { id: true, verificationStatus: true } }
          }
        },
        organization: { select: selectSafeOrganization }
      }
    });

    if (!existing) throw new ApiError(404, 'User not found');
    if (!['buyer', 'seller', 'shg', 'admin'].includes(String(existing.role))) {
      throw new ApiError(400, 'Organization auto-creation is only available for buyer, seller, and SHG onboarding approvals');
    }

    const orgData = organizationDataFor(existing);
    if (!orgData.organizationName) {
      throw new ApiError(400, 'Organization name is required before approving onboarding');
    }

    let organization = existing.organization;
    let createdOrganization = false;

    if (organization) {
      organization = await tx.organization.update({
        where: { id: organization.id },
        data: {
          organizationName: organization.organizationName || orgData.organizationName,
          organizationType: organization.organizationType || orgData.organizationType,
          addressLine1: orgData.addressLine1 || (organization as any).addressLine1 || null,
          city: orgData.city || (organization as any).city || 'Jharsuguda',
          district: orgData.district || (organization as any).district || 'Jharsuguda',
          state: orgData.state || (organization as any).state || 'ODISHA',
          pincode: orgData.pincode || (organization as any).pincode || null,
          website: orgData.website || (organization as any).website || null,
          verificationStatus: 'VERIFIED' as any,
          organizationOnboardingStatus: 'approved_for_procurement'
        },
        select: selectSafeOrganization
      });
    } else {
      const duplicate = await tx.organization.findFirst({
        where: {
          deletedAt: null,
          organizationName: { equals: orgData.organizationName, mode: 'insensitive' }
        },
        select: selectSafeOrganization
      });

      if (duplicate) {
        organization = await tx.organization.update({
          where: { id: duplicate.id },
          data: {
            verificationStatus: 'VERIFIED' as any,
            organizationOnboardingStatus: 'approved_for_procurement'
          },
          select: selectSafeOrganization
        });
      } else {
        organization = await tx.organization.create({
          data: {
            organizationName: orgData.organizationName,
            organizationType: orgData.organizationType,
            addressLine1: orgData.addressLine1 || null,
            city: orgData.city || 'Jharsuguda',
            district: orgData.district || 'Jharsuguda',
            state: orgData.state || 'ODISHA',
            pincode: orgData.pincode || null,
            website: orgData.website || null,
            verificationStatus: 'VERIFIED' as any,
            organizationOnboardingStatus: 'approved_for_procurement'
          },
          select: selectSafeOrganization
        });
        createdOrganization = true;
      }
    }

    const previousMembership = await tx.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: organization.id } },
      select: { id: true }
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { ...updateData, organizationId: organization.id },
      include: { organization: { select: selectSafeOrganization } }
    });

    try {
      if (user.role === 'buyer') {
        await tx.buyerProfile.updateMany({
          where: { userId },
          data: {
            organizationId: organization.id,
            verificationStatusEnum: 'VERIFIED' as any,
            verificationStatus: 'VERIFIED'
          }
        });
      } else if (user.role === 'shg') {
        if (existing.shgProfile) {
          await tx.shgProfile.update({
            where: { id: existing.shgProfile.id },
            data: {
              organizationId: organization.id,
              applicationStatus: 'APPROVED',
              approvedAt: new Date()
            }
          }).catch(() => null);
        }
        if (existing.sellerProfile) {
          await tx.sellerProfile.update({
            where: { id: existing.sellerProfile.id },
            data: { organizationId: organization.id, verificationStatusEnum: 'VERIFIED' as any }
          }).catch(() => null);
        }
      } else {
        await tx.sellerProfile.updateMany({
          where: { userId },
          data: { organizationId: organization.id, verificationStatusEnum: 'VERIFIED' as any }
        });
      }
    } catch (profileSyncErr) {
      console.warn('[Onboarding Org Approval] Profile relation sync warning:', profileSyncErr);
    }

    let membership: any = null;
    try {
      membership = await ensureOrgMembership({
        userId,
        organizationId: organization.id,
        desiredRole: OrgRole.ORG_ADMIN,
        upgrade: true,
        client: tx as any
      });
    } catch (membershipErr) {
      console.warn('[Onboarding Org Approval] Membership ensure warning:', membershipErr);
      membership = await tx.orgMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: organization.id } }
      }) || { id: 0, userId, organizationId: organization.id, orgRole: OrgRole.ORG_ADMIN, isActive: true, acceptedAt: new Date() };
    }

    return {
      user,
      organization,
      membership: {
        id: membership.id,
        userId: membership.userId,
        organizationId: membership.organizationId,
        orgRole: membership.orgRole,
        isActive: membership.isActive,
        acceptedAt: membership.acceptedAt
      },
      createdOrganization,
      createdMembership: !previousMembership
    };
  }, { timeout: 20_000 });
}

export async function createOrUpdatePendingOrganization(userId: number): Promise<any> {
  return prisma.$transaction(async (tx) => {
    const defaultCompanyId = await getDefaultCompanyId(tx as any);
    const existing = await tx.user.findUnique({
      where: { id: userId },
      include: {
        buyerProfile: true,
        shgProfile: true,
        sellerProfile: {
          include: {
            offices: true,
          }
        },
        organization: { select: selectSafeOrganization }
      }
    });

    if (!existing) throw new Error('User not found');
    if (!['buyer', 'seller', 'shg'].includes(String(existing.role))) {
      return null;
    }

    const orgData = organizationDataFor(existing);
    if (!orgData.organizationName) {
      return null;
    }

    let organization = existing.organization;

    if (organization) {
      if (organization.verificationStatus !== 'VERIFIED') {
        organization = await tx.organization.update({
          where: { id: organization.id },
          data: {
            organizationName: organization.organizationName || orgData.organizationName,
            organizationType: organization.organizationType || orgData.organizationType,
            addressLine1: orgData.addressLine1,
            city: orgData.city,
            district: orgData.district,
            state: orgData.state,
            pincode: orgData.pincode,
            website: orgData.website,
            verificationStatus: 'PENDING' as any,
            organizationOnboardingStatus: 'pending'
          },
          select: selectSafeOrganization
        });
      }
    } else {
      const duplicate = await tx.organization.findFirst({
        where: {
          deletedAt: null,
          organizationName: { equals: orgData.organizationName, mode: 'insensitive' }
        },
        select: selectSafeOrganization
      });

      if (duplicate) {
        organization = await tx.organization.update({
          where: { id: duplicate.id },
          data: {
            verificationStatus: duplicate.verificationStatus === 'VERIFIED' ? 'VERIFIED' as any : 'PENDING' as any,
            organizationOnboardingStatus: duplicate.verificationStatus === 'VERIFIED' ? 'approved_for_procurement' : 'pending'
          },
          select: selectSafeOrganization
        });
      } else {
        organization = await tx.organization.create({
          data: {
            organizationName: orgData.organizationName,
            organizationType: orgData.organizationType,
            addressLine1: orgData.addressLine1,
            city: orgData.city,
            district: orgData.district,
            state: orgData.state,
            pincode: orgData.pincode,
            website: orgData.website,
            
            verificationStatus: 'PENDING' as any,
            organizationOnboardingStatus: 'pending'
          },
          select: selectSafeOrganization
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { organizationId: organization.id}
      });

      if (existing.role === 'buyer') {
        await tx.buyerProfile.updateMany({
          where: { userId },
          data: { organizationId: organization.id }
        });
      } else if (existing.role === 'shg') {
        if (existing.shgProfile) {
          await tx.shgProfile.update({
            where: { id: existing.shgProfile.id },
            data: { organizationId: organization.id }
          }).catch(() => null);
        }
        if (existing.sellerProfile) {
          await tx.sellerProfile.update({
            where: { id: existing.sellerProfile.id },
            data: { organizationId: organization.id }
          }).catch(() => null);
        }
      } else {
        await tx.sellerProfile.updateMany({
          where: { userId },
          data: { organizationId: organization.id }
        });
      }
    }

    await ensureOrgMembership({
      userId,
      organizationId: organization.id,
      desiredRole: OrgRole.ORG_ADMIN,
      upgrade: true,
      client: tx as any
    });

    return organization;
  }, { timeout: 20_000 });
}
