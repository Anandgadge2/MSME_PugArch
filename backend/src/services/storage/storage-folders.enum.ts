export enum StorageFolder {
  PRODUCTS = 'products',
  BUYERS = 'buyers',
  SELLERS = 'sellers',
  USERS = 'users',
  DOCUMENTS = 'documents',
  KYC = 'kyc',
  COMPANY_LOGOS = 'company-logos',
  GOVERNMENT = 'government',
  NGO = 'ngo',
  CSR_PROJECTS = 'csr-projects',
  PURCHASE_ORDERS = 'purchase-orders',
  QUOTATIONS = 'quotations',
  INVOICES = 'invoices',
  VIDEOS = 'videos',
  MISC = 'misc'
}

export const mapEntityTypeToFolder = (entityType?: string): StorageFolder => {
  if (!entityType) return StorageFolder.DOCUMENTS;
  const normalized = entityType.toLowerCase();
  
  if (['product', 'product_image', 'catalogue', 'catalogue_product'].includes(normalized)) return StorageFolder.PRODUCTS;
  if (['seller', 'seller_profile', 'seller_document', 'onboarding'].includes(normalized)) return StorageFolder.SELLERS;
  if (['buyer', 'buyer_profile'].includes(normalized)) return StorageFolder.BUYERS;
  if (['user', 'user_profile', 'avatar'].includes(normalized)) return StorageFolder.USERS;
  if (['kyc', 'aadhaar', 'pan', 'gst'].includes(normalized)) return StorageFolder.KYC;
  if (['logo', 'company_logo', 'organization_logo'].includes(normalized)) return StorageFolder.COMPANY_LOGOS;
  if (['government', 'gov_doc'].includes(normalized)) return StorageFolder.GOVERNMENT;
  if (['ngo'].includes(normalized)) return StorageFolder.NGO;
  if (['csr', 'csr_project'].includes(normalized)) return StorageFolder.CSR_PROJECTS;
  if (['po', 'purchase_order'].includes(normalized)) return StorageFolder.PURCHASE_ORDERS;
  if (['quote', 'quotation', 'financial_quote'].includes(normalized)) return StorageFolder.QUOTATIONS;
  if (['invoice', 'billing'].includes(normalized)) return StorageFolder.INVOICES;
  if (['video', 'mp4'].includes(normalized)) return StorageFolder.VIDEOS;

  return StorageFolder.DOCUMENTS;
};
