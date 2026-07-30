export const queryKeys = {
  profile: ['profile'],
  navigationSummary: (role?: string) => ['navigation-summary', role || 'anonymous'],
  dashboardSummary: (role: string, orgId?: string) => ['dashboard-summary', role, orgId || 'none'],
  notifications: ['notifications'],
  marketplaceHome: (identity?: string) => ['marketplace-home', identity || 'public'],
  orders: (params?: object) => ['orders', params || {}],
  approvals: (params?: object) => ['approvals', params || {}],
  bids: (params?: object) => ['bids', params || {}],
  requirements: (params?: object) => ['requirements', params || {}],
  quoteRequests: (params?: object) => ['quote-requests', params || {}],
  reverseAuctions: (params?: object) => ['reverse-auctions', params || {}],
  catalogue: (params?: object) => ['catalogue', params || {}],
};
