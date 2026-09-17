/**
 * quoteItemParser.ts
 *
 * Robust utility for parsing individual line items from buyer quote requests,
 * messages, and requirements, ensuring multi-item quotes (e.g. from Cart) are
 * accurately separated into distinct products with quantities and units.
 */

export type ParsedQuoteItem = {
  itemName: string;
  quantity: number;
  unitOfMeasure: string;
  description?: string;
  referenceUnitPrice?: number;
  estimatedLineTotal?: number;
};

/**
 * Clean a string of unwanted title decorations like "+ N other item(s)", "Quote request: ", etc.
 */
export function cleanItemName(name?: string): string {
  if (!name) return '';
  return String(name)
    .replace(/^Quote Request #?\d*:?\s*/i, '')
    .replace(/^Quote request:?\s*/i, '')
    .replace(/\s*\+\s*\d+\s+other item\(?s?\)?/gi, '')
    .replace(/^(?:Item\s*#?\d*[:\s-]*)/i, '')
    .trim();
}

/**
 * Parse individual items from subject and/or message body.
 */
export function parseQuoteRequestItems(subject?: string, message?: string): ParsedQuoteItem[] {
  const items: ParsedQuoteItem[] = [];
  const text = String(message || '').trim();

  // Pattern 1: Numbered item blocks (standard format produced by CartPage quote requests)
  // Example:
  // 1. Acer Predator Helios 16
  //    Quantity: 2 PCS
  //    Reference Unit Price: ₹1,50,000
  //    Estimated Line Total: ₹3,00,000
  const itemBlockRegex = /(?:^|\n)(?:(?:\d+[\.\)]|\[\d+\]|#\d+)\s+)([^\n]+)([\s\S]*?)(?=(?:\n(?:\d+[\.\)]|\[\d+\]|#\d+)\s+[^\n]+)|\n\s*Estimated Total:|\n\s*Total Value:|\n\s*Please share|\n\s*Thank you|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = itemBlockRegex.exec(text)) !== null) {
    const rawTitle = match[1]?.trim();
    const blockContent = match[2]?.trim() || '';

    if (!rawTitle) continue;
    // Skip if it's a URL or generic header
    if (rawTitle.toLowerCase().startsWith('http://') || rawTitle.toLowerCase().startsWith('https://')) continue;

    // Parse Quantity and Unit
    let qty = 1;
    let uom = 'Nos';
    const qtyMatch = blockContent.match(/(?:Quantity|Qty|Count)\s*:\s*([\d\.,]+)\s*([a-zA-Z]+)?/i)
      || rawTitle.match(/(?:Quantity|Qty|Count)\s*:\s*([\d\.,]+)\s*([a-zA-Z]+)?/i)
      || rawTitle.match(/[\(\[]\s*(?:Quantity|Qty)?\s*:\s*([\d\.,]+)\s*([a-zA-Z]+)?\s*[\)\]]/i);

    if (qtyMatch) {
      const parsedQty = parseFloat(qtyMatch[1].replace(/,/g, ''));
      if (!isNaN(parsedQty) && parsedQty > 0) qty = parsedQty;
      if (qtyMatch[2]) uom = qtyMatch[2].trim();
    }

    // Clean item name
    let cleanedName = cleanItemName(rawTitle)
      .replace(/[\(\[]\s*(?:Quantity|Qty)?\s*:\s*[\d\.,]+\s*[a-zA-Z]*\s*[\)\]]/gi, '')
      .replace(/\s*-\s*(?:Quantity|Qty)\s*:\s*[\d\.,]+\s*[a-zA-Z]*/gi, '')
      .trim();

    // Parse Reference Unit Price
    let refUnitPrice: number | undefined;
    const priceMatch = blockContent.match(/(?:Reference Unit Price|Unit Price|Reference Price|Price|Rate)\s*:\s*₹?\s*([\d\.,]+)/i);
    if (priceMatch) {
      const p = parseFloat(priceMatch[1].replace(/,/g, ''));
      if (!isNaN(p) && p >= 0) refUnitPrice = p;
    }

    // Parse Estimated Line Total
    let lineTotal: number | undefined;
    const totalMatch = blockContent.match(/(?:Estimated Line Total|Line Total|Total)\s*:\s*₹?\s*([\d\.,]+)/i);
    if (totalMatch) {
      const t = parseFloat(totalMatch[1].replace(/,/g, ''));
      if (!isNaN(t) && t >= 0) lineTotal = t;
    }

    // If unitOfMeasure not set from qtyMatch, check if unit is explicitly specified
    if (uom === 'Nos' || !uom) {
      const uomMatch = blockContent.match(/(?:Unit|UOM|Unit of Measure)\s*:\s*([a-zA-Z]+)/i);
      if (uomMatch) uom = uomMatch[1].trim();
    }

    if (cleanedName && cleanedName.length > 1) {
      items.push({
        itemName: cleanedName,
        quantity: qty,
        unitOfMeasure: uom,
        description: blockContent,
        referenceUnitPrice: refUnitPrice,
        estimatedLineTotal: lineTotal
      });
    }
  }

  // Pattern 2: Bulleted items (e.g. "- Dell Monitor (Qty: 2 Nos)")
  if (items.length <= 1 && (text.includes('\n- ') || text.startsWith('- ') || text.includes('\n* ') || text.startsWith('* '))) {
    const bulletItems: ParsedQuoteItem[] = [];
    const bulletRegex = /(?:^|\n)\s*[-*•]\s+([^\n]+)/gi;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = bulletRegex.exec(text)) !== null) {
      const line = bMatch[1]?.trim();
      if (!line || line.toLowerCase().startsWith('http')) continue;

      let qty = 1;
      let uom = 'Nos';
      const qMatch = line.match(/(?:Quantity|Qty|Count)\s*:\s*([\d\.,]+)\s*([a-zA-Z]+)?/i)
        || line.match(/[\(\[]\s*([\d\.,]+)\s*([a-zA-Z]+)?\s*[\)\]]/i);
      if (qMatch) {
        const q = parseFloat(qMatch[1].replace(/,/g, ''));
        if (!isNaN(q) && q > 0) qty = q;
        if (qMatch[2]) uom = qMatch[2].trim();
      }

      let name = cleanItemName(line)
        .replace(/[\(\[].*?[\)\]]/g, '')
        .replace(/(?:Quantity|Qty|Count|Price|Rate)\s*:.*$/gi, '')
        .replace(/\s*-\s*₹?[\d\.,]+.*$/gi, '')
        .trim();

      if (name && name.length >= 2) {
        bulletItems.push({
          itemName: name,
          quantity: qty,
          unitOfMeasure: uom,
          description: line
        });
      }
    }
    if (bulletItems.length > 1) {
      return bulletItems;
    }
  }

  if (items.length > 0) {
    return items;
  }

  // Pattern 3: Fallback for single item from subject
  if (subject) {
    const cleanSub = cleanItemName(subject);
    if (cleanSub) {
      return [{
        itemName: cleanSub,
        quantity: 1,
        unitOfMeasure: 'Nos',
        description: text || ''
      }];
    }
  }

  return [];
}

// Recognized standard Units of Measure
const COMMON_UOMS = [
  'nos', 'no', 'pcs', 'pc', 'piece', 'pieces',
  'kg', 'kgs', 'kilogram', 'kilograms', 'gm', 'gms', 'gram', 'grams',
  'ton', 'tons', 'tonne', 'tonnes', 'mt',
  'meter', 'meters', 'mtr', 'mtrs', 'm', 'cm', 'mm', 'km',
  'sqm', 'sqft', 'sqft.', 'sqmt', 'sq.m', 'sq.ft',
  'cum', 'cu.m', 'cbm',
  'liter', 'liters', 'litre', 'litres', 'ltr', 'ltrs', 'l', 'ml',
  'set', 'sets', 'box', 'boxes', 'pack', 'packs', 'packet', 'packets',
  'unit', 'units', 'lot', 'lots', 'job', 'jobs', 'pair', 'pairs',
  'bag', 'bags', 'bundle', 'bundles', 'roll', 'rolls', 'drum', 'drums',
  'barrel', 'barrels', 'can', 'cans', 'bottle', 'bottles', 'sheet', 'sheets',
  'hour', 'hours', 'day', 'days', 'month', 'months', 'year', 'years'
];

/**
 * Sanitize a Unit of Measure string.
 * If the value is a full sentence, excessively long (>18 chars), or contains
 * punctuation / multiple sentences, extracts a recognized unit or safely falls back to 'Nos'.
 */
export function sanitizeUom(raw?: any, fallback = 'Nos'): string {
  if (raw === null || raw === undefined) return fallback;
  const str = String(raw).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a') return fallback;

  // If reasonably short (<= 14 chars) without sentence punctuation or excessive words
  if (str.length <= 14 && !str.includes(';') && !str.includes(':') && str.split(/\s+/).length <= 2) {
    return str.replace(/[,;:]+$/, '').trim() || fallback;
  }

  // Check if any recognized UOM appears as a standalone word at the start or end
  const words = str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (COMMON_UOMS.includes(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    }
  }

  // If string is longer than 18 characters and no recognized UOM was found, it's invalid data/description
  if (str.length > 18) {
    return fallback;
  }

  return str.slice(0, 10).trim() || fallback;
}

/**
 * Sanitize an HSN / SAC Code.
 * Valid Indian HSN/SAC codes are strictly 2 to 8 digits (or occasionally up to 10 alphanumeric chars).
 * If a value is longer than 15 characters, contains spaces, sentences, or description text,
 * it is rejected and returns '-' to prevent multi-line vertical layout blowouts.
 */
export function sanitizeHsn(raw?: any, fallback = '-'): string {
  if (raw === null || raw === undefined) return fallback;
  const str = String(raw).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'none') {
    return fallback;
  }

  // If text contains sentences, spaces, or is longer than 15 characters, it's definitely not an HSN code
  if (str.length > 15 || str.includes(' ') || str.includes('\n') || str.includes(';') || str.includes('.')) {
    const match = str.match(/\b\d{4,8}\b/);
    if (match) return match[0];
    return fallback;
  }

  const cleaned = str.replace(/[^a-zA-Z0-9-]/g, '');
  return cleaned.length >= 2 ? cleaned : fallback;
}
