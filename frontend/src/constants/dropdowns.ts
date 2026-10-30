/**
 * Centralized dropdown option constants for the MSME Portal.
 * Each array contains { value, label } objects for use in <Select> / <option> elements.
 */

// ── Quantity / Unit of Measure ──────────────────────────────────────────────
export const QUANTITY_UNITS = [
  { value: 'Nos', label: 'Nos - Numbers' },
  { value: 'Set', label: 'Set - Sets' },
  { value: 'Kg', label: 'Kg - Kilograms' },
  { value: 'Ton', label: 'Ton - Tonnes' },
  { value: 'MT', label: 'MT - Metric Tonnes' },
  { value: 'Bag', label: 'Bag - Bags' },
  { value: 'Box', label: 'Box - Boxes' },
  { value: 'Packet', label: 'Packet - Packets' },
  { value: 'Pair', label: 'Pair - Pairs' },
  { value: 'Roll', label: 'Roll - Rolls' },
  { value: 'Litre', label: 'Litre - Litres' },
  { value: 'Meter', label: 'Meter - Meters' },
  { value: 'Feet', label: 'Feet' },
  { value: 'SqFt', label: 'Sq. Ft - Square Feet' },
  { value: 'SqMeter', label: 'Sq. Meter - Square Meters' },
  { value: 'Cum', label: 'Cum - Cubic Meters' },
  { value: 'Piece', label: 'Piece - Pieces' },
  { value: 'Unit', label: 'Unit - Units' },
  { value: 'Coil', label: 'Coil - Coils' },
  { value: 'Drum', label: 'Drum - Drums' },
  { value: 'Bundle', label: 'Bundle - Bundles' },
  { value: 'Carton', label: 'Carton - Cartons' },
  { value: 'Cylinder', label: 'Cylinder - Cylinders' },
  { value: 'Dozen', label: 'Dozen' },
  { value: 'Sheet', label: 'Sheet' },
  { value: 'Plate', label: 'Plate' },
  { value: 'Bucket', label: 'Bucket' },
  { value: 'Kit', label: 'Kit' },
  { value: 'Bottle', label: 'Bottle' },
  { value: 'Container', label: 'Container' },
  { value: 'Lot', label: 'Lot - Lots' },
  { value: 'Job', label: 'Job - Jobs' },
] as const;

export const matchQuantityUnit = (uom?: string): string => {
  if (!uom) return 'Nos';
  const clean = uom.trim().toLowerCase();
  const match = QUANTITY_UNITS.find(opt => opt.value.toLowerCase() === clean);
  return match ? match.value : 'Other';
};

// ── MSME Type ───────────────────────────────────────────────────────────────
export const MSME_TYPES = [
  { value: 'MSME', label: 'MSME' },
  { value: 'NON_MSME', label: 'Non-MSME' },
  { value: 'LOCAL_MSME', label: 'Local MSME' },
  { value: 'ANCILLARY_UNIT', label: 'Ancillary Unit' },
  { value: 'STARTUP_MSME', label: 'Startup MSME' },
] as const;

// ── Vendor Type ─────────────────────────────────────────────────────────────
export const VENDOR_TYPES = [
  { value: 'MANUFACTURER', label: 'Manufacturer' },
  { value: 'DISTRIBUTOR', label: 'Distributor' },
  { value: 'DEALER', label: 'Dealer' },
  { value: 'SERVICE_PROVIDER', label: 'Service Provider' },
  { value: 'CONTRACTOR', label: 'Contractor' },
  { value: 'OEM', label: 'OEM' },
  { value: 'RETAIL_SUPPLIER', label: 'Retail Supplier' },
  { value: 'WHOLESALER', label: 'Wholesaler' },
] as const;

// ── Registration Type ───────────────────────────────────────────────────────
export const REGISTRATION_TYPES = [
  { value: 'GST_REGISTERED', label: 'GST Registered' },
  { value: 'NSIC_REGISTERED', label: 'NSIC Registered' },
  { value: 'ISO_CERTIFIED', label: 'ISO Certified' },
  { value: 'PAN_AVAILABLE', label: 'PAN Available' },
] as const;

// ── Product / Service Categories ────────────────────────────────────────────
// Categories are fetched dynamically from the database (/api/categories).
export const PRODUCT_CATEGORIES: readonly string[] = [];

// Sentinel value for the "Other" option that lets users type a custom category.
export const PRODUCT_CATEGORY_OTHER = 'Other';

// Procurement wizard common fields. Values are stable codes saved to backend payloads.
export const PROCUREMENT_REQUIREMENT_TYPES = [
  { value: 'GOODS', label: 'Goods' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'WORKS', label: 'Works' },
  { value: 'BOQ', label: 'BOQ' },
  { value: 'CATALOG_ITEM', label: 'Catalog Item' },
] as const;

export const PROCUREMENT_PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'EMERGENCY', label: 'Emergency' },
] as const;

export const PROCUREMENT_CURRENCIES = [
  { value: 'INR', label: 'INR - Indian Rupee' },
] as const;

export const PROCUREMENT_INSPECTION_TYPES = [
  { value: 'BUYER_INSPECTION', label: 'Buyer Inspection' },
  { value: 'THIRD_PARTY_INSPECTION', label: 'Third Party Inspection' },
  { value: 'JOINT_INSPECTION', label: 'Joint Inspection' },
  { value: 'SELF_CERTIFICATION', label: 'Self Certification' },
  { value: 'NOT_REQUIRED', label: 'Not Required' },
] as const;

export type ProcurementRequirementType = typeof PROCUREMENT_REQUIREMENT_TYPES[number]['value'];
export type ProcurementPriority = typeof PROCUREMENT_PRIORITIES[number]['value'];
export type ProcurementCurrency = typeof PROCUREMENT_CURRENCIES[number]['value'];
export type ProcurementInspectionType = typeof PROCUREMENT_INSPECTION_TYPES[number]['value'];

// ── Item Condition ──────────────────────────────────────────────────────────
export const ITEM_CONDITIONS = [
  { value: 'NEW', label: 'New' },
  { value: 'REFURBISHED', label: 'Refurbished' },
  { value: 'USED', label: 'Used' },
  { value: 'CUSTOM_MANUFACTURED', label: 'Custom Manufactured' },
] as const;

// ── Payment Terms ───────────────────────────────────────────────────────────
export const PAYMENT_TERMS = [
  { value: 'Pay on Invoice', label: 'Pay on Invoice (Standard)' },
  { value: 'Net 30 Days', label: 'Net 30 Days (Credit)' },
  { value: 'Net 45 Days', label: 'Net 45 Days (MSMED Act Statutory Limit)' },
  { value: 'Net 60 Days', label: 'Net 60 Days (Credit)' },
  { value: 'Net 90 Days', label: 'Net 90 Days (Credit)' },
  { value: '100% on Delivery (COD/POD)', label: '100% on Delivery (COD/POD)' },
  { value: '100% Advance Payment', label: '100% Advance Payment' },
  { value: '50% Advance / 50% on Delivery', label: '50% Advance / 50% on Delivery' },
  { value: 'Immediate Payment', label: 'Immediate Payment' },
] as const;

export const matchPaymentTerms = (term?: string): string => {
  if (!term) return 'Pay on Invoice';
  const clean = String(term).trim();
  const lower = clean.toLowerCase();
  if (lower === 'advance_payment' || lower === 'advance') return '100% Advance Payment';
  if (lower === 'on_delivery' || lower === 'pay_on_delivery') return '100% on Delivery (COD/POD)';
  if (lower === 'pay_on_invoice') return 'Pay on Invoice';
  if (lower === 'standard_net_30' || lower === 'net_30') return 'Net 30 Days';
  if (lower === 'net_60') return 'Net 60 Days';
  if (lower === 'net_90') return 'Net 90 Days';
  if (lower === 'immediate') return 'Immediate Payment';
  const match = PAYMENT_TERMS.find(opt => opt.value.toLowerCase() === lower);
  return match ? match.value : 'Other';
};

// ── Delivery Terms / Logistics Handover ─────────────────────────────────────
export const DELIVERY_TYPES = [
  { value: 'Door delivery to site', label: 'Door delivery to site (FOR Destination)' },
  { value: 'Buyer pickup', label: 'Buyer pickup (Ex-Works / Factory Gate)' },
  { value: 'Seller dispatch', label: 'Seller dispatch (Transporter / Courier Handover)' },
] as const;

export type DeliveryType = typeof DELIVERY_TYPES[number]['value'];
