/** Feature flags for deprecated procurement flows. */
export const featureFlags = {
  legacy_direct_purchase_checkout: process.env.LEGACY_DIRECT_PURCHASE_CHECKOUT === 'true',
  legacy_direct_purchase_create: process.env.LEGACY_DIRECT_PURCHASE_CREATE === 'true',
};
