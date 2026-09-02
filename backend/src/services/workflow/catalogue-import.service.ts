import * as XLSX from 'xlsx';
import path from 'path';
import { ApiError } from '../../utils/ApiError.js';
import { auditWorkflow, db, type WorkflowActor } from './workflow-common.js';
import { catalogueWorkflow } from './catalogue-workflow.service.js';
import { uploadFile } from '../storage/storage.service.js';

const parseUrls = (value: unknown): string[] => {
  const str = String(value ?? '').trim();
  if (!str) return [];
  const splitChar = str.includes(',') ? ',' : (str.includes(';') ? ';' : ' ');
  return str
    .split(splitChar)
    .map(u => u.trim())
    .filter(u => u && (u.startsWith('http://') || u.startsWith('https://')));
};

type DownloadedFileType = {
  ext: string;
  mimeType: string;
  resourceKind: 'image' | 'document';
};

const downloadedFileTypes: DownloadedFileType[] = [
  { ext: '.pdf', mimeType: 'application/pdf', resourceKind: 'document' },
  { ext: '.jpg', mimeType: 'image/jpeg', resourceKind: 'image' },
  { ext: '.jpeg', mimeType: 'image/jpeg', resourceKind: 'image' },
  { ext: '.png', mimeType: 'image/png', resourceKind: 'image' },
  { ext: '.webp', mimeType: 'image/webp', resourceKind: 'image' },
  { ext: '.doc', mimeType: 'application/msword', resourceKind: 'document' },
  { ext: '.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', resourceKind: 'document' },
  { ext: '.xls', mimeType: 'application/vnd.ms-excel', resourceKind: 'document' },
  { ext: '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', resourceKind: 'document' },
  { ext: '.csv', mimeType: 'text/csv', resourceKind: 'document' }
];

const fileTypeForMime = (mimeType: string) =>
  downloadedFileTypes.find(type => type.mimeType === mimeType);

const fileTypeForExtension = (ext: string) =>
  downloadedFileTypes.find(type => type.ext === ext.toLowerCase());

const detectDownloadedFileType = (buffer: Buffer, declaredMime: string): DownloadedFileType | null => {
  const normalizedMime = declaredMime.split(';')[0].trim().toLowerCase();
  if (buffer.subarray(0, 4).equals(Buffer.from([0x25, 0x50, 0x44, 0x46]))) return fileTypeForMime('application/pdf') || null;
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return fileTypeForMime('image/jpeg') || null;
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return fileTypeForMime('image/png') || null;
  if (buffer.subarray(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) && buffer.subarray(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))) return fileTypeForMime('image/webp') || null;
  if (buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
    const archiveIndex = buffer.toString('latin1');
    if (archiveIndex.includes('[Content_Types].xml') || archiveIndex.includes('word/')) {
      return fileTypeForMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || null;
    }
    if (archiveIndex.includes('xl/')) {
      return fileTypeForMime('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') || null;
    }
  }
  if (buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
    return normalizedMime === 'application/vnd.ms-excel'
      ? fileTypeForMime('application/vnd.ms-excel') || null
      : fileTypeForMime('application/msword') || null;
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 512)).toString('utf8').trim().toLowerCase();
  if (sample.startsWith('<!doctype html') || sample.startsWith('<html')) return null;
  if (/^[\u0009\u000a\u000d\u0020-\u007e]+$/.test(sample) && sample.includes(',')) return fileTypeForMime('text/csv') || null;
  return fileTypeForMime(normalizedMime) || null;
};

const fileNameForDownloadedUrl = (url: string, detectedType: DownloadedFileType) => {
  let originalName = `imported_file${detectedType.ext}`;
  try {
    const basename = path.basename(new URL(url).pathname) || originalName;
    const ext = path.extname(basename).toLowerCase();
    const extensionType = fileTypeForExtension(ext);
    originalName = extensionType?.mimeType === detectedType.mimeType
      ? basename
      : `${path.basename(basename, ext) || 'imported_file'}${detectedType.ext}`;
  } catch {
    // Keep generated fallback name.
  }
  return originalName;
};

const extractImageFromHtml = (html: string, baseUrl: string): string | null => {
  try {
    // 1. OpenGraph Image: <meta property="og:image" content="...">
    const ogMatch = html.match(/<meta[^>]+(?:property|name)=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image(?::secure_url)?["']/i);
    if (ogMatch?.[1]) {
      return new URL(ogMatch[1], baseUrl).href;
    }

    // 2. Twitter Image: <meta name="twitter:image" content="...">
    const twitterMatch = html.match(/<meta[^>]+(?:property|name)=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']twitter:image(?::src)?["']/i);
    if (twitterMatch?.[1]) {
      return new URL(twitterMatch[1], baseUrl).href;
    }

    // 3. Link rel="image_src": <link rel="image_src" href="...">
    const linkMatch = html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i);
    if (linkMatch?.[1]) {
      return new URL(linkMatch[1], baseUrl).href;
    }

    // 4. Schema.org JSON-LD: "image": "..."
    const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const json = JSON.parse(match[1]);
        const extractFromObj = (obj: any): string | null => {
          if (!obj) return null;
          if (typeof obj === 'string' && /^https?:\/\//i.test(obj)) return obj;
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const res = extractFromObj(item);
              if (res) return res;
            }
          }
          if (typeof obj === 'object') {
            if (obj.image) return extractFromObj(obj.image);
            if (obj.thumbnailUrl) return extractFromObj(obj.thumbnailUrl);
            if (obj.url && /\.(jpe?g|png|webp)/i.test(obj.url)) return extractFromObj(obj.url);
            if (obj['@graph']) return extractFromObj(obj['@graph']);
          }
          return null;
        };
        const found = extractFromObj(json);
        if (found) return new URL(found, baseUrl).href;
      } catch {
        // continue
      }
    }

    // 5. First product image: <img ... src="..." />
    const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi);
    for (const match of imgMatches) {
      const src = match[1];
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar') && !src.includes('badge') && !src.includes('pixel') && !src.includes('spinner')) {
        if (/\.(jpe?g|png|webp)(\?.*)?$/i.test(src)) {
          return new URL(src, baseUrl).href;
        }
      }
    }
  } catch {
    // Return null if parsing fails
  }
  return null;
};

async function downloadAndUploadUrl(
  url: string,
  userId: number,
  role: string,
  entityType: 'catalogue_product' | 'catalogue_service',
  expectedKind: 'image' | 'document',
  depth = 0
) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': expectedKind === 'image' ? 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' : '*/*'
      }
    });
    if (!res.ok) {
      console.warn(`[Catalogue Import] Failed to fetch URL: ${url}, status: ${res.status}`);
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length === 0) {
      console.warn(`[Catalogue Import] Empty file downloaded from URL: ${url}`);
      return null;
    }

    const detectedType = detectDownloadedFileType(buffer, res.headers.get('content-type') || 'application/octet-stream');

    // If user provided a product webpage URL and we are importing an image, automatically extract the product image from HTML
    if (!detectedType && expectedKind === 'image' && depth === 0) {
      const html = buffer.toString('utf8');
      if (html.includes('<html') || html.includes('<!doctype html') || (res.headers.get('content-type') || '').includes('text/html')) {
        const extractedImageUrl = extractImageFromHtml(html, url);
        if (extractedImageUrl && extractedImageUrl !== url) {
          console.info(`[Catalogue Import] Automatically extracted product image "${extractedImageUrl}" from webpage: ${url}`);
          return downloadAndUploadUrl(extractedImageUrl, userId, role, entityType, 'image', depth + 1);
        }
      }
    }

    if (!detectedType) {
      console.warn(`[Catalogue Import] Skipped URL with unsupported or invalid file content: ${url}`);
      return null;
    }
    if (detectedType.resourceKind !== expectedKind) {
      console.warn(`[Catalogue Import] Skipped ${expectedKind} URL with ${detectedType.resourceKind} content: ${url}`);
      return null;
    }
    const originalName = fileNameForDownloadedUrl(url, detectedType);

    const mockFile: Express.Multer.File = {
      buffer,
      originalname: originalName,
      mimetype: detectedType.mimeType,
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: null as any
    };

    const asset = await uploadFile(mockFile, {
      ownerId: userId,
      ownerRole: role,
      entityType
    });

    return asset.id;
  } catch (err: any) {
    console.warn(`[Catalogue Import] Skipped URL ${url}: ${err?.message || 'download/upload failed'}`);
    return null;
  }
}


const MAX_ROWS = 1000;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const clean = (value: unknown) => String(value ?? '').trim();
const sanitizeText = (value: unknown, max = 4000) => clean(value).slice(0, max) || null;

const parseBool = (value: unknown): boolean | null => {
  const v = clean(value).toLowerCase();
  if (!v) return null;
  if (['yes', 'true', '1', 'y'].includes(v)) return true;
  if (['no', 'false', '0', 'n'].includes(v)) return false;
  return null;
};

const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const parseDate = (value: unknown): Date | null => {
  const v = clean(value);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizeHeader = (h: unknown) =>
  clean(h)
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[*%]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const PRODUCT_STATUSES = new Set(['DRAFT', 'ACTIVE', 'INACTIVE']);
const PRICING_MODELS = new Set(['FIXED', 'HOURLY', 'DAILY', 'MONTHLY', 'PER_PROJECT', 'CUSTOM']);

const STANDARD_UNITS = [
  'Nos', 'Kg', 'Ton', 'MT', 'Bag', 'Box', 'Packet', 'Set', 'Pair', 'Roll',
  'Litre', 'Meter', 'Feet', 'Piece', 'Unit', 'Coil', 'Drum', 'Bundle', 'Carton',
  'Cylinder', 'Dozen', 'Sheet', 'Plate', 'Bucket', 'Kit', 'Bottle', 'Container',
  'Cum', 'SqFt', 'SqMeter'
];

const STANDARD_ITEM_CONDITIONS = ['NEW', 'REFURBISHED', 'USED', 'CUSTOM_MANUFACTURED'];

type RowError = { rowNumber: number; field?: string; message: string; rawData?: Record<string, unknown> };

const readSheetRows = (workbook: XLSX.WorkBook, sheetName: string) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { headers: [] as string[], rows: [] as Record<string, unknown>[] };
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', raw: false });
  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = (matrix[0] || []).map(h => clean(h));
  const rows = matrix.slice(1).map((row, idx) => {
    const record: Record<string, unknown> = { __rowNumber: idx + 2 };
    headers.forEach((header, colIdx) => {
      if (header) record[header] = row?.[colIdx] ?? '';
    });
    return record;
  }).filter(row => Object.keys(row).some(k => k !== '__rowNumber' && clean(row[k])));
  return { headers, rows };
};

const col = (row: Record<string, unknown>, ...names: string[]) => {
  const keys = Object.keys(row);
  for (const name of names) {
    const target = normalizeHeader(name);
    const key = keys.find(k => normalizeHeader(k) === target);
    if (key && clean(row[key]) !== '') return row[key];
  }
  return '';
};

const assertApprovedSeller = async (actor: WorkflowActor) => {
  if (actor.role === 'admin') return;
  const user = await db.user.findUnique({ where: { id: actor.id }, select: { role: true, onboardingStatus: true } });
  if (user?.role !== 'seller' || !['approved_for_procurement', 'approved'].includes(String(user.onboardingStatus))) {
    throw new ApiError(403, 'Your seller account must be approved before importing catalogue items.', 'SELLER_NOT_APPROVED');
  }
};

const categoryMap = async (type: 'PRODUCT' | 'SERVICE') => {
  const categories = await db.category.findMany({
    where: { isActive: true, OR: [{ type: type === 'PRODUCT' ? 'PRODUCT' : 'SERVICE' }, { type: 'BOTH' }] },
    select: { id: true, name: true }
  });
  const map = new Map<string, number>();
  categories.forEach(c => map.set(c.name.trim().toLowerCase(), c.id));
  return map;
};

const productInstructions = () => [
  ['Catalogue Product Import Instructions & Field Guide'],
  [''],
  ['1. Mandatory vs Optional Fields:'],
  ['   - MANDATORY (*): Product Name *, Category *, Price *, Unit Of Measure *.'],
  ['   - OPTIONAL: SKU, Brand, Model Number, HSN Code, GST Rate, Item Condition, MSME Made,'],
  ['     Description, Discount/Offer fields, Bulk Deal fields, Image URLs, Document URLs.'],
  [''],
  ['2. Sample Data Rows in Template:'],
  ['   - Rows 2 and 3 in the "Products" sheet contain realistic sample products.'],
  ['   - Rows 2-7 in the "Product Specifications" sheet show how to link technical attributes.'],
  ['   - You can replace or delete the sample rows with your actual catalogue data before uploading.'],
  [''],
  ['3. Field Formatting Guidelines:'],
  ['   - Category: Must match an active category name from the "Dropdown Values" sheet.'],
  ['   - Status: DRAFT, ACTIVE, or INACTIVE (Defaults to DRAFT).'],
  ['   - Price & Original Price: Numeric value in INR without commas or currency symbols (e.g. 450 or 1250.50).'],
  ['   - GST Rate: Number representing percentage (0, 5, 12, 18, 28). Do not append %.'],
  ['   - Unit Of Measure: Standard unit code e.g. Nos, Kg, Ton, Box, Piece, Set (see "Dropdown Values" sheet).'],
  ['   - Item Condition: NEW, REFURBISHED, USED, or CUSTOM_MANUFACTURED.'],
  ['   - Dates (Offer Start / End): Format as YYYY-MM-DD (e.g., 2026-09-01).'],
  ['   - Booleans (MSME Made, Bulk Deal Available): Enter Yes or No (or TRUE / FALSE).'],
  ['   - SKU: Optional, but if provided must be unique within your seller catalogue.'],
  ['   - Image / Document URLs: Direct HTTP/HTTPS links separated by commas or semicolons.'],
  [''],
  ['4. Linking Technical Specifications:'],
  ['   - Switch to the "Product Specifications" sheet to define technical specifications.'],
  ['   - Link specifications by entering the matching "Product SKU" OR "Product Name" used in the Products sheet.'],
  ['   - Multiple specification rows can be added for the same product.'],
  [''],
  ['5. Automated Promotional Offers & Bulk Tiers:'],
  ['   - If you provide "Discount Percent" (e.g. 20), the system auto-calculates "Discount Price".'],
  ['   - If you provide "Discount Price" (e.g. 800), the system auto-calculates "Discount Percent".'],
  ['   - If "Original Price" is left blank, the system automatically uses the "Price" as the baseline reference MRP.'],
  ['   - Providing an "Offer Label", "Discount Price", or validity dates automatically activates the special deal badge.'],
  ['   - To enable volume tier discounts, set "Bulk Deal Available" to Yes and enter "Bulk Minimum Quantity" (e.g. 10).']
];

const serviceInstructions = () => [
  ['Catalogue Service Import Instructions & Field Guide'],
  [''],
  ['1. Mandatory vs Optional Fields:'],
  ['   - MANDATORY (*): Service Name *, Category *, Pricing Model *, Base Price * (if FIXED), Service Area *.'],
  ['   - OPTIONAL: Description, GST Rate, Scope Of Work, Deliverables, Inclusions, Exclusions,'],
  ['     SLA Response Time, Duration, Original Price, Discount Price, Discount Percent,'],
  ['     Offer Label, Offer Start Date, Offer End Date, Bulk Deal Available, Bulk Minimum Quantity,'],
  ['     Image URLs, Document URLs.'],
  [''],
  ['2. Sample Data in Template:'],
  ['   - Row 2 in the "Services" sheet contains a complete sample service with all commercial and operational fields.'],
  ['   - Rows in "Service Specifications" show sample technical attributes and SLAs.'],
  ['   - You can replace or delete the sample rows before uploading.'],
  [''],
  ['3. Field Formatting Guidelines:'],
  ['   - Category: Must match an active category name from the "Dropdown Values" sheet.'],
  ['   - Status: DRAFT, ACTIVE, or INACTIVE (Defaults to DRAFT).'],
  ['   - Pricing Model: FIXED, HOURLY, DAILY, MONTHLY, PER_PROJECT, or CUSTOM.'],
  ['   - Base Price & Original Price: Numeric amount in INR (Mandatory for FIXED pricing).'],
  ['   - GST Rate: Number between 0 and 40 (e.g. 18). Do not append %.'],
  ['   - Dates (Offer Start / End): Format as YYYY-MM-DD (e.g. 2026-09-01).'],
  ['   - Booleans (Bulk Deal Available): Enter Yes or No (or TRUE / FALSE).'],
  ['   - Service Area: Geographical coverage (e.g., "Pan-India", "Maharashtra", "District-wide").'],
  ['   - Image / Document URLs: Direct HTTP/HTTPS links separated by commas or semicolons.'],
  [''],
  ['4. Specifications:'],
  ['   - In "Service Specifications", link attributes using the exact "Service Name" matching the Services sheet.'],
  [''],
  ['5. Automated Promotional Offers & Bulk Tiers:'],
  ['   - If you provide "Discount Percent" (e.g. 20), the system auto-calculates "Discount Price".'],
  ['   - If you provide "Discount Price" (e.g. 20000), the system auto-calculates "Discount Percent".'],
  ['   - If "Original Price" is left blank, the system automatically uses "Base Price" as baseline reference rate.'],
  ['   - Providing an "Offer Label", "Discount Price", or validity dates automatically activates the special deal badge.'],
  ['   - To enable volume tier contracts, set "Bulk Deal Available" to Yes and enter "Bulk Minimum Quantity" (e.g. 5).']
];

export const catalogueImportService = {
  async generateProductTemplate() {
    const categories = await db.category.findMany({
      where: { isActive: true, OR: [{ type: 'PRODUCT' }, { type: 'BOTH' }] },
      select: { name: true },
      orderBy: { name: 'asc' }
    });
    const wb = XLSX.utils.book_new();

    const productHeaders = [
      'Product Name *', 'Category *', 'Status', 'Description', 'Price *', 'Currency', 'GST Rate (%)',
      'Unit Of Measure *', 'HSN Code', 'SKU', 'Brand', 'Model Number', 'Item Condition', 'MSME Made (Yes/No)',
      'Original Price', 'Discount Price', 'Discount Percent', 'Offer Label', 'Offer Start Date (YYYY-MM-DD)',
      'Offer End Date (YYYY-MM-DD)', 'Bulk Deal Available (Yes/No)', 'Bulk Minimum Quantity', 'Image URLs', 'Document URLs'
    ];

    const sampleCategory1 = categories[0]?.name || 'Safety Equipment & Industrial Safety';
    const sampleCategory2 = categories.find(c => /Fastener|Hardware|Mechanical|Metal/i.test(c.name))?.name || categories[1]?.name || 'Industrial Fasteners & Components';

    const sampleProducts = [
      [
        'Industrial Safety Helmet Class-E',
        sampleCategory1,
        'ACTIVE',
        'High-density polyethylene (HDPE) shell safety helmet with 6-point ratchet suspension and sweatband for industrial site safety.',
        450,
        'INR',
        18,
        'Nos',
        '650610',
        'SAF-HLM-001',
        'SafeShield',
        'PRO-E500',
        'NEW',
        'Yes',
        600,
        450,
        25,
        'MSME Special Deal',
        '2026-09-01',
        '2026-12-31',
        'Yes',
        50,
        'https://images.unsplash.com/photo-1578873375969-d729352e464c',
        ''
      ],
      [
        'Heavy Duty M12 Galvanized Hex Bolt',
        sampleCategory2,
        'ACTIVE',
        'Grade 8.8 galvanized carbon steel hexagonal head bolts with matching nuts and washers.',
        35,
        'INR',
        18,
        'Nos',
        '731815',
        'FAS-HEX-M12',
        'SteelTech',
        'M12-100G',
        'NEW',
        'Yes',
        '',
        '',
        '',
        '',
        '',
        '',
        'No',
        '',
        '',
        ''
      ]
    ];

    const specHeaders = ['Product SKU', 'Product Name', 'Specification Name *', 'Specification Value *', 'Unit'];
    const sampleSpecs = [
      ['SAF-HLM-001', 'Industrial Safety Helmet Class-E', 'Material', 'High-Density Polyethylene (HDPE)', ''],
      ['SAF-HLM-001', 'Industrial Safety Helmet Class-E', 'Impact Resistance', '50', 'Joules'],
      ['SAF-HLM-001', 'Industrial Safety Helmet Class-E', 'Standard Certification', 'IS 2925:1984 / EN 397', ''],
      ['FAS-HEX-M12', 'Heavy Duty M12 Galvanized Hex Bolt', 'Thread Size', 'M12 x 1.75mm', ''],
      ['FAS-HEX-M12', 'Heavy Duty M12 Galvanized Hex Bolt', 'Length', '100', 'mm'],
      ['FAS-HEX-M12', 'Heavy Duty M12 Galvanized Hex Bolt', 'Tensile Strength', '800', 'MPa']
    ];

    const maxDropdownLength = Math.max(categories.length, STANDARD_UNITS.length, STANDARD_ITEM_CONDITIONS.length, 3);
    const dropdownRows = [
      ['Categories', 'Statuses', 'Units', 'Item Conditions', 'Yes / No'],
      ...Array.from({ length: maxDropdownLength }, (_, i) => [
        categories[i]?.name || '',
        ['ACTIVE', 'DRAFT', 'INACTIVE'][i] || '',
        STANDARD_UNITS[i] || '',
        STANDARD_ITEM_CONDITIONS[i] || '',
        ['Yes', 'No'][i] || ''
      ])
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([productHeaders, ...sampleProducts]), 'Products');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([specHeaders, ...sampleSpecs]), 'Product Specifications');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productInstructions()), 'Instructions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dropdownRows), 'Dropdown Values');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },

  async generateServiceTemplate() {
    const categories = await db.category.findMany({
      where: { isActive: true, OR: [{ type: 'SERVICE' }, { type: 'BOTH' }] },
      select: { name: true },
      orderBy: { name: 'asc' }
    });
    const wb = XLSX.utils.book_new();

    const serviceHeaders = [
      'Service Name *', 'Category *', 'Status', 'Description', 'Pricing Model *', 'Base Price *', 'Currency',
      'GST Rate (%)', 'Service Area *', 'Scope Of Work', 'Deliverables', 'Inclusions', 'Exclusions', 'SLA Response Time', 'Duration',
      'Original Price', 'Discount Price', 'Discount Percent', 'Offer Label', 'Offer Start Date (YYYY-MM-DD)', 'Offer End Date (YYYY-MM-DD)',
      'Bulk Deal Available (Yes/No)', 'Bulk Minimum Quantity', 'Image URLs', 'Document URLs'
    ];

    const sampleServiceCategory = categories[0]?.name || 'Industrial Maintenance Services';

    const sampleServices = [
      [
        'Annual Industrial Electrical Maintenance & Inspection',
        sampleServiceCategory,
        'ACTIVE',
        'Comprehensive preventive electrical audit, transformer testing, thermography, and switchgear maintenance.',
        'FIXED',
        25000,
        'INR',
        18,
        'Pan-India / On-site',
        'Quarterly on-site visits, infrared thermography inspection, earth pit testing, relay calibration.',
        'Audit report, compliance certificate, thermography scan sheets, maintenance log.',
        'Licensed Grade-A engineers, calibrated diagnostic equipment, travel within state.',
        'Replacement spare parts, high-voltage component overhaul.',
        '24 Hours',
        '1 Year Contract',
        30000,
        25000,
        16.67,
        'Annual MSME Maintenance Discount',
        '2026-09-01',
        '2027-08-31',
        'Yes',
        3,
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
        ''
      ]
    ];

    const serviceSpecHeaders = ['Service Name', 'Specification Name *', 'Specification Value *', 'Unit'];
    const sampleServiceSpecs = [
      ['Annual Industrial Electrical Maintenance & Inspection', 'Technician Certification', 'Licensed Grade-A Electrical Supervisors', ''],
      ['Annual Industrial Electrical Maintenance & Inspection', 'Visit Frequency', 'Quarterly (4 visits/year)', 'Visits'],
      ['Annual Industrial Electrical Maintenance & Inspection', 'Emergency Support', '24x7 Breakdown On-call', '']
    ];

    const maxDropdownLength = Math.max(categories.length, PRICING_MODELS.size, 3);
    const dropdownRows = [
      ['Categories', 'Pricing Models', 'Statuses', 'Yes / No'],
      ...Array.from({ length: maxDropdownLength }, (_, i) => [
        categories[i]?.name || '',
        ['FIXED', 'HOURLY', 'DAILY', 'MONTHLY', 'PER_PROJECT', 'CUSTOM'][i] || '',
        ['ACTIVE', 'DRAFT', 'INACTIVE'][i] || '',
        ['Yes', 'No'][i] || ''
      ])
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([serviceHeaders, ...sampleServices]), 'Services');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([serviceSpecHeaders, ...sampleServiceSpecs]), 'Service Specifications');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(serviceInstructions()), 'Instructions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dropdownRows), 'Dropdown Values');

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  },

  async previewProductImport(actor: WorkflowActor, file: Express.Multer.File) {
    await assertApprovedSeller(actor);
    return this.previewImport(actor, file, 'PRODUCT');
  },

  async previewServiceImport(actor: WorkflowActor, file: Express.Multer.File) {
    await assertApprovedSeller(actor);
    return this.previewImport(actor, file, 'SERVICE');
  },

  async previewImport(actor: WorkflowActor, file: Express.Multer.File, type: 'PRODUCT' | 'SERVICE') {
    if (!file?.buffer) throw new ApiError(400, 'Excel file is required', 'FILE_REQUIRED');
    if (file.size > MAX_FILE_BYTES) throw new ApiError(400, 'File exceeds 10MB limit', 'FILE_TOO_LARGE');
    const ext = clean(file.originalname).toLowerCase();
    if (!ext.endsWith('.xlsx')) throw new ApiError(400, 'Only .xlsx files are supported', 'INVALID_FILE_TYPE');

    const workbook = XLSX.read(file.buffer, { type: 'buffer', cellFormula: false, cellHTML: false });
    const mainSheet = type === 'PRODUCT' ? 'Products' : 'Services';
    const specSheet = type === 'PRODUCT' ? 'Product Specifications' : 'Service Specifications';
    const { headers, rows } = readSheetRows(workbook, mainSheet);
    if (rows.length === 0) {
      const fallback = readSheetRows(workbook, workbook.SheetNames[0] || '');
      if (fallback.rows.length === 0) throw new ApiError(400, 'Workbook contains no data rows', 'EMPTY_FILE');
    }
    const dataRows = rows.length > 0 ? rows : readSheetRows(workbook, workbook.SheetNames[0] || '').rows;
    if (dataRows.length > MAX_ROWS) throw new ApiError(400, `Maximum ${MAX_ROWS} rows allowed per import`, 'TOO_MANY_ROWS');

    const specData = readSheetRows(workbook, specSheet).rows;
    const categories = await categoryMap(type);
    const existingSkus = type === 'PRODUCT'
      ? new Set((await db.product.findMany({ where: { sellerId: actor.id, sku: { not: null } }, select: { sku: true } })).map(p => clean(p.sku).toLowerCase()))
      : new Set<string>();

    const rowErrors: RowError[] = [];
    const warnings: string[] = [];
    const validRows: Record<string, unknown>[] = [];
    const seenKeys = new Set<string>();
    let duplicateRows = 0;

    const knownHeaders = new Set([
      'product name', 'service name', 'category', 'status', 'description', 'price', 'currency', 'gst rate',
      'unit of measure', 'hsn code', 'sku', 'brand', 'model number', 'item condition', 'msme made',
      'original price', 'discount price', 'discount percent', 'offer label', 'offer start date', 'offer end date',
      'bulk deal available', 'bulk minimum quantity', 'image urls', 'document urls',
      'pricing model', 'base price', 'service area', 'scope of work', 'deliverables', 'inclusions', 'exclusions', 'sla response time', 'duration'
    ]);
    const unknownHeaders = headers.filter(h => {
      const norm = normalizeHeader(h);
      return norm && !knownHeaders.has(norm);
    });
    if (unknownHeaders.length) warnings.push(`Unknown columns ignored: ${unknownHeaders.join(', ')}`);

    for (const row of dataRows) {
      const rowNumber = Number(row.__rowNumber || 0);
      const errors: RowError[] = [];
      const name = sanitizeText(col(row, 'Product Name', 'Service Name'), 200);
      const categoryName = sanitizeText(col(row, 'Category'), 120);
      const statusRaw = clean(col(row, 'Status')).toUpperCase() || 'DRAFT';
      const rawDescription = sanitizeText(col(row, 'Description'));
      const description = rawDescription || name;
      const price = parseNumber(col(row, 'Price', 'Base Price'));
      const gst = parseNumber(col(row, 'GST Rate'));
      const currency = clean(col(row, 'Currency')).toUpperCase() || 'INR';

      if (!name) errors.push({ rowNumber, field: 'name', message: 'Name is required', rawData: row });
      if (!categoryName) errors.push({ rowNumber, field: 'category', message: 'Category is required', rawData: row });
      else if (!categories.has(categoryName.toLowerCase())) errors.push({ rowNumber, field: 'category', message: `Category "${categoryName}" not found`, rawData: row });
      if (!PRODUCT_STATUSES.has(statusRaw)) errors.push({ rowNumber, field: 'status', message: 'Status must be DRAFT, ACTIVE, or INACTIVE', rawData: row });
      if (type === 'PRODUCT') {
        const uom = sanitizeText(col(row, 'Unit Of Measure'), 40);
        if (!uom) errors.push({ rowNumber, field: 'unitOfMeasure', message: 'Unit Of Measure is required', rawData: row });
        if (price === null || price < 0) errors.push({ rowNumber, field: 'price', message: 'Price must be a number >= 0', rawData: row });
      } else {
        const pricingModel = clean(col(row, 'Pricing Model')).toUpperCase() || 'FIXED';
        if (!PRICING_MODELS.has(pricingModel)) errors.push({ rowNumber, field: 'pricingModel', message: 'Invalid pricing model', rawData: row });
        const serviceArea = sanitizeText(col(row, 'Service Area'), 300);
        if (!serviceArea) errors.push({ rowNumber, field: 'serviceArea', message: 'Service Area is required', rawData: row });
        const basePrice = parseNumber(col(row, 'Base Price'));
        if (pricingModel === 'FIXED' && (basePrice === null || basePrice < 0)) {
          errors.push({ rowNumber, field: 'basePrice', message: 'Base Price required for FIXED pricing', rawData: row });
        }
      }
      if (gst !== null && (gst < 0 || gst > 40)) errors.push({ rowNumber, field: 'gstRate', message: 'GST Rate must be between 0 and 40', rawData: row });
      if (currency !== 'INR') errors.push({ rowNumber, field: 'currency', message: 'Only INR currency is supported', rawData: row });

      const offerStart = parseDate(col(row, 'Offer Start Date'));
      const offerEnd = parseDate(col(row, 'Offer End Date'));
      if (offerStart && offerEnd && offerEnd < offerStart) {
        errors.push({ rowNumber, field: 'offerEndAt', message: 'Offer end date cannot be before start date', rawData: row });
      }

      const sku = type === 'PRODUCT' ? sanitizeText(col(row, 'SKU'), 80) : null;
      const dedupeKey = type === 'PRODUCT' ? (sku || name || '').toLowerCase() : (name || '').toLowerCase();
      if (dedupeKey) {
        if (seenKeys.has(dedupeKey)) {
          duplicateRows += 1;
          errors.push({ rowNumber, field: 'duplicate', message: 'Duplicate row in file', rawData: row });
        } else {
          seenKeys.add(dedupeKey);
        }
        if (type === 'PRODUCT' && sku && existingSkus.has(sku.toLowerCase())) {
          errors.push({ rowNumber, field: 'sku', message: `SKU "${sku}" already exists in your catalogue`, rawData: row });
        }
      }

      if (errors.length) {
        rowErrors.push(...errors);
        continue;
      }

      const specs = specData.filter(s => {
        const specSku = clean(col(s, 'Product SKU', 'SKU'));
        const specName = clean(col(s, 'Product Name', 'Name', 'Service Name'));
        if (type === 'PRODUCT') {
          if (sku && specSku && sku.toLowerCase() === specSku.toLowerCase()) return true;
          if (name && specName && name.toLowerCase() === specName.toLowerCase()) return true;
          if (name && specSku && name.toLowerCase() === specSku.toLowerCase()) return true;
          if (sku && specName && sku.toLowerCase() === specName.toLowerCase()) return true;
          return false;
        } else {
          return Boolean(name && specName && name.toLowerCase() === specName.toLowerCase());
        }
      }).map(s => ({
        name: sanitizeText(col(s, 'Specification Name', 'Name'), 120),
        value: sanitizeText(col(s, 'Specification Value', 'Value'), 500),
        unit: sanitizeText(col(s, 'Unit'), 40)
      })).filter(s => s.name && s.value);

      const imageUrls = parseUrls(col(row, 'Image URLs'));
      const docUrls = parseUrls(col(row, 'Document URLs'));

      const imageIds: number[] = [];
      const imageResults = await Promise.all(
        imageUrls.map(url => downloadAndUploadUrl(url, actor.id, actor.role, type === 'PRODUCT' ? 'catalogue_product' : 'catalogue_service', 'image'))
      );
      for (const id of imageResults) {
        if (id) imageIds.push(id);
      }

      const documentIds: number[] = [];
      const docResults = await Promise.all(
        docUrls.map(url => downloadAndUploadUrl(url, actor.id, actor.role, type === 'PRODUCT' ? 'catalogue_product' : 'catalogue_service', 'document'))
      );
      for (const id of docResults) {
        if (id) documentIds.push(id);
      }

      const rawOriginalPrice = parseNumber(col(row, 'Original Price'));
      const rawDiscountPrice = parseNumber(col(row, 'Discount Price'));
      const rawDiscountPercent = parseNumber(col(row, 'Discount Percent'));
      const basePriceVal = type === 'PRODUCT' ? price : parseNumber(col(row, 'Base Price'));
      const effectiveOriginalPrice = rawOriginalPrice ?? ((rawDiscountPrice !== null || rawDiscountPercent !== null) ? basePriceVal : null);

      let finalDiscountPrice = rawDiscountPrice;
      let finalDiscountPercent = rawDiscountPercent;

      if (effectiveOriginalPrice && effectiveOriginalPrice > 0) {
        if (finalDiscountPrice !== null && finalDiscountPercent === null && effectiveOriginalPrice > finalDiscountPrice) {
          finalDiscountPercent = Math.round(((effectiveOriginalPrice - finalDiscountPrice) / effectiveOriginalPrice) * 100 * 10) / 10;
        } else if (finalDiscountPercent !== null && finalDiscountPrice === null) {
          finalDiscountPrice = Math.round(effectiveOriginalPrice * (1 - finalDiscountPercent / 100) * 100) / 100;
        }
      }

      const offerLabelVal = sanitizeText(col(row, 'Offer Label'), 120);
      const isOfferActive = Boolean(offerLabelVal || finalDiscountPrice !== null || finalDiscountPercent !== null || offerStart || offerEnd);

      validRows.push({
        rowNumber,
        name,
        categoryId: categories.get(String(categoryName).toLowerCase()),
        status: statusRaw,
        description,
        currency: 'INR',
        taxRate: gst ?? 0,
        specifications: specs,
        imageIds,
        documentIds,
        originalPrice: effectiveOriginalPrice,
        discountPrice: finalDiscountPrice,
        discountPercent: finalDiscountPercent,
        offerLabel: offerLabelVal,
        offerStartAt: offerStart,
        offerEndAt: offerEnd,
        isOfferActive,
        bulkDealAvailable: parseBool(col(row, 'Bulk Deal Available')) ?? false,
        bulkMinQuantity: parseNumber(col(row, 'Bulk Minimum Quantity')),
        ...(type === 'PRODUCT'
          ? {
            price,
            unitOfMeasure: sanitizeText(col(row, 'Unit Of Measure'), 40),
            hsnCode: sanitizeText(col(row, 'HSN Code'), 30),
            sku,
            brand: sanitizeText(col(row, 'Brand'), 120),
            modelNumber: sanitizeText(col(row, 'Model Number'), 120),
            itemCondition: sanitizeText(col(row, 'Item Condition'), 40),
            isMsmeMade: parseBool(col(row, 'MSME Made')) ?? false
          }
          : {
            pricingModel: clean(col(row, 'Pricing Model')).toUpperCase() || 'FIXED',
            basePrice: parseNumber(col(row, 'Base Price')),
            serviceArea: sanitizeText(col(row, 'Service Area'), 300),
            scopeOfWork: sanitizeText(col(row, 'Scope Of Work')),
            deliverables: sanitizeText(col(row, 'Deliverables')),
            inclusions: sanitizeText(col(row, 'Inclusions')),
            exclusions: sanitizeText(col(row, 'Exclusions')),
            slaResponseTime: sanitizeText(col(row, 'SLA Response Time'), 120),
            duration: sanitizeText(col(row, 'Duration'), 120)
          })
      });
    }

    const batch = await db.catalogueImportBatch.create({
      data: {
        sellerId: actor.id,
        type,
        fileName: file.originalname,
        totalRows: dataRows.length,
        validRows: validRows.length,
        invalidRows: rowErrors.length,
        duplicateRows,
        status: 'PREVIEWED',
        previewData: validRows,
        warnings: warnings.length ? warnings : undefined
      }
    });

    if (rowErrors.length) {
      await db.catalogueImportError.createMany({
        data: rowErrors.map(err => ({
          batchId: batch.id,
          rowNumber: err.rowNumber,
          field: err.field || null,
          message: err.message,
          rawData: err.rawData || undefined
        }))
      });
    }

    return {
      batchId: batch.id,
      totalRows: dataRows.length,
      validRows: validRows.length,
      invalidRows: rowErrors.length,
      duplicateRows,
      warnings,
      rowErrors,
      preview: validRows.slice(0, 50)
    };
  },

  async confirmImport(actor: WorkflowActor, batchId: number, publish = false) {
    await assertApprovedSeller(actor);
    const batch = await db.catalogueImportBatch.findFirst({ where: { id: batchId, sellerId: actor.id } });
    if (!batch) throw new ApiError(404, 'Import batch not found', 'BATCH_NOT_FOUND');
    if (batch.status !== 'PREVIEWED' && batch.status !== 'FAILED') {
      throw new ApiError(400, 'Import batch already processed', 'BATCH_ALREADY_PROCESSED');
    }

    const rows = Array.isArray(batch.previewData) ? batch.previewData as Record<string, unknown>[] : [];
    if (rows.length === 0) {
      await db.catalogueImportBatch.update({ where: { id: batchId }, data: { status: 'FAILED' } });
      throw new ApiError(400, 'No valid rows to import', 'NO_VALID_ROWS');
    }

    let successCount = 0;
    try {
      await db.$transaction(async (tx) => {
        for (const row of rows) {
          const status = publish && row.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT';
          const { specifications, rowNumber, categoryId, ...data } = row;
          if (batch.type === 'PRODUCT') {
            await catalogueWorkflow.createProductWithClient(tx, actor, {
              ...data,
              categoryId,
              status,
              specifications: Array.isArray(specifications) ? specifications : []
            });
          } else {
            await catalogueWorkflow.createServiceWithClient(tx, actor, {
              ...data,
              categoryId,
              status,
              specifications: Array.isArray(specifications) ? specifications : []
            });
          }
          successCount += 1;
        }
        await tx.catalogueImportBatch.update({
          where: { id: batchId },
          data: { status: 'CONFIRMED', validRows: successCount }
        });
      }, {
        maxWait: 15000,
        timeout: 90000
      });
    } catch (err) {
      await db.catalogueImportBatch.update({ where: { id: batchId }, data: { status: 'FAILED' } });
      throw err;
    }

    await auditWorkflow(actor, 'workflow.catalogue.import_confirmed', 'catalogue_import_batch', batchId, { type: batch.type, successCount });
    return { batchId, imported: successCount, status: 'CONFIRMED' };
  },

  async listHistory(actor: WorkflowActor) {
    return db.catalogueImportBatch.findMany({
      where: { sellerId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { _count: { select: { errors: true } } }
    });
  },

  async getErrors(actor: WorkflowActor, batchId: number) {
    const batch = await db.catalogueImportBatch.findFirst({ where: { id: batchId, sellerId: actor.id } });
    if (!batch) throw new ApiError(404, 'Import batch not found', 'BATCH_NOT_FOUND');
    return db.catalogueImportError.findMany({ where: { batchId }, orderBy: { rowNumber: 'asc' } });
  },

  async exportErrorReport(actor: WorkflowActor, batchId: number) {
    const batch = await db.catalogueImportBatch.findFirst({ where: { id: batchId, sellerId: actor.id } });
    if (!batch) throw new ApiError(404, 'Import batch not found', 'BATCH_NOT_FOUND');
    const errors = await db.catalogueImportError.findMany({ where: { batchId }, orderBy: { rowNumber: 'asc' } });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(errors.map(e => ({
      Row: e.rowNumber,
      Field: e.field || '',
      Message: e.message,
      RawData: e.rawData ? JSON.stringify(e.rawData) : ''
    }))), 'Errors');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }
};
