export type AuthUser = {
  id: number;
  _id?: number;
  name: string;
  email: string;
  role: 'admin' | 'buyer' | 'seller' | 'shg' | 'master_admin' | 'financier';
  accountType?: 'MASTER_ADMIN' | 'SUPERADMIN' | 'SELLER' | 'BUYER' | 'SHG' | 'FINANCIER';
  accountTypeId?: number;
  organizationId?: number | null;
  districtId?: number | null;
  activeScope?: { scopeType: string; scopeId: string | null };
  permissions?: string[];
  emailVerified?: boolean;
  mobileVerified?: boolean;
  twoFactorEnabled?: boolean;
};
