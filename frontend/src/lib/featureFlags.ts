/** Client-side feature flags for deprecated procurement flows. */
export const featureFlags = {
  legacy_direct_purchase_create: process.env.NEXT_PUBLIC_LEGACY_DIRECT_PURCHASE_CREATE === 'true',
};
