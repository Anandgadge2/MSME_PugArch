export const UI_PERMISSIONS = {
  ADMIN_REVIEW: 'admin:review',
  TENDER_CREATE: 'tender:create',
  BID_CREATE: 'bid:create',
  QUOTATION_CREATE: 'quotation:create'
} as const;

const rolePermissions: Record<string, string[]> = {
  admin: Object.values(UI_PERMISSIONS),
  buyer: [UI_PERMISSIONS.TENDER_CREATE, UI_PERMISSIONS.QUOTATION_CREATE],
  seller: [UI_PERMISSIONS.BID_CREATE]
};

export const hasPermission = (role: string | undefined, permission: string) =>
  Boolean(role && rolePermissions[role]?.includes(permission));
