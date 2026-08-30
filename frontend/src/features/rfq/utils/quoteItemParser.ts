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
