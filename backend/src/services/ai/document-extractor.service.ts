import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export interface ExtractedBuyerDetails {
  name?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  department?: string;
  plantCode?: string;
}

export interface ExtractedSellerDetails {
  name?: string;
  gstin?: string;
  pan?: string;
  udyamNumber?: string;
  address?: string;
  erpVendorCode?: string;
}

export interface ExtractedLineItem {
  itemName: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  uom: string;
  unitPrice: number;
  taxRate?: number;
  totalAmount: number;
}

export interface ExtractedFinancials {
  subtotal: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  totalTax: number;
  grandTotal: number;
  currency: string;
}

export interface ExtractedDeliveryTerms {
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
}

export interface ExtractedDocumentData {
  documentType: 'PURCHASE_ORDER' | 'TAX_INVOICE' | 'QUOTATION' | 'UNKNOWN';
  systemDetected: 'SAP' | 'GEM' | 'TALLY' | 'GENERIC';
  poNumber?: string;
  invoiceNumber?: string;
  documentDate?: string;
  buyerDetails: ExtractedBuyerDetails;
  sellerDetails: ExtractedSellerDetails;
  lineItems: ExtractedLineItem[];
  financials: ExtractedFinancials;
  deliveryTerms: ExtractedDeliveryTerms;
  confidenceScore: number;
  notes?: string;
}

export interface DocumentExtractionResult {
  success: boolean;
  extractionMode: 'AI_MODEL' | 'DIGITAL_RECORD' | 'GRACEFUL_FALLBACK';
  statusBanner: string; // Strictly "Extracted via AI Model", "Extracted via Digital Record", or "Manual Review Mode Active"
  data: ExtractedDocumentData;
  warnings?: string[];
}

const SYSTEM_EXTRACTION_PROMPT = `
You are an expert Enterprise ERP & Procurement Document Extraction Engine specialized in Indian public and private procurement (SAP Ariba, GeM - Government e-Marketplace, Tally, Navision, and custom buyer purchase orders).

Analyze the attached document (PDF or image) and extract all procurement information with high precision into a JSON object matching this exact schema:
{
  "documentType": "PURCHASE_ORDER" | "TAX_INVOICE" | "QUOTATION" | "UNKNOWN",
  "systemDetected": "SAP" | "GEM" | "TALLY" | "GENERIC",
  "poNumber": string or null,
  "invoiceNumber": string or null,
  "documentDate": "YYYY-MM-DD" or null,
  "buyerDetails": {
    "name": string or null,
    "gstin": string or null,
    "pan": string or null,
    "address": string or null,
    "department": string or null,
    "plantCode": string or null
  },
  "sellerDetails": {
    "name": string or null,
    "gstin": string or null,
    "pan": string or null,
    "udyamNumber": string or null,
    "address": string or null,
    "erpVendorCode": string or null (e.g. SAP Vendor Code / LIFNR like '1004523' or GeM Seller ID)
  },
  "lineItems": [
    {
      "itemName": string,
      "description": string or null,
      "hsnCode": string or null,
      "quantity": number,
      "uom": string (e.g. NOS, KG, SET, MTR, PCS),
      "unitPrice": number,
      "taxRate": number or null (e.g. 18 for 18%),
      "totalAmount": number
    }
  ],
  "financials": {
    "subtotal": number,
    "cgst": number or null,
    "sgst": number or null,
    "igst": number or null,
    "totalTax": number,
    "grandTotal": number,
    "currency": "INR"
  },
  "deliveryTerms": {
    "expectedDeliveryDate": "YYYY-MM-DD" or null,
    "deliveryAddress": string or null,
    "paymentTerms": string or null
  },
  "confidenceScore": number (0 to 1),
  "notes": string or null
}

Rules:
1. For Indian GST numbers (15-alphanumeric), extract accurately. If PAN is present in GSTIN (chars 3-12), populate PAN as well.
2. For GeM contracts, the GeM Contract Number (GEMC-...) should be placed in poNumber, and systemDetected must be "GEM".
3. For SAP Ariba or SAP S/4HANA POs, look for 10-digit PO numbers (typically starting with 45 or 42) and Vendor Code (LIFNR).
4. Always extract the complete PO / Order Reference Number into "poNumber".
5. For line items, "totalAmount" must strictly represent the line total inclusive of taxes: (quantity * unitPrice) * (1 + taxRate/100). If the PDF table only lists pre-tax subtotal in that column, calculate and output the tax-inclusive line total.
6. Extract the 4-digit to 8-digit HSN or SAC code for each line item whenever available (e.g. 4819 for corrugated boxes).
7. For deliveryAddress, extract the complete consignee/plant address, do not truncate company suffixes like LIMITED or LTD.
8. Numbers must be numeric floats/integers, not formatted strings (e.g. 125000.50, not "1,25,000.50").
9. Return ONLY valid JSON, without Markdown backticks or commentary.
`;

/**
 * Deterministic Heuristic Regex Extractor (Tier 0 & Tier 3 Fallback)
 * Scans text content / raw buffer for GSTINs, PO numbers, dates, amounts.
 */
function extractHeuristicsFromText(text: string): ExtractedDocumentData {
  const gstinRegex = /\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b/g;
  const gstins = Array.from(new Set(text.match(gstinRegex) || []));

  const gemRegex = /GEMC-[0-9]{8,15}/i;
  const sapPoRegex = /\b(45[0-9]{8}|42[0-9]{8}|PO[-_/]?[0-9]{4,12})\b/i;
  const generalPoRegex = /(?:Purchase\s*Order\s*(?:No|Number|#)|PO\s*(?:No|Number|#)|Order\s*(?:No|Number|#))[\s:.]*([A-Za-z0-9\/-]{4,30})/i;
  const vendorCodeRegex = /(?:Vendor\s*(?:Code|No|ID|#)|LIFNR)[\s:]*([A-Z0-9-]{4,12})/i;

  const gemMatch = text.match(gemRegex);
  const sapMatch = text.match(sapPoRegex);
  const generalPoMatch = text.match(generalPoRegex);
  const vendorMatch = text.match(vendorCodeRegex);

  const poNumber = gemMatch ? gemMatch[0] : (sapMatch ? sapMatch[0] : (generalPoMatch ? generalPoMatch[1].trim() : undefined));
  const systemDetected = gemMatch ? 'GEM' : (sapMatch ? 'SAP' : 'GENERIC');
  const erpVendorCode = vendorMatch ? vendorMatch[1].trim() : undefined;

  // Extract PAN from first GSTIN if available
  const buyerGstin = gstins[0] || undefined;
  const sellerGstin = gstins[1] || undefined;
  const sellerPan = sellerGstin && sellerGstin.length === 15 ? sellerGstin.slice(2, 12) : undefined;
  const buyerPan = buyerGstin && buyerGstin.length === 15 ? buyerGstin.slice(2, 12) : undefined;

  // Date heuristics
  const dateRegex = /\b(\d{2}[-/.]\d{2}[-/.]\d{4}|\d{4}[-/.]\d{2}[-/.]\d{2})\b/;
  const dateMatch = text.match(dateRegex);
  let docDate: string | undefined = undefined;
  if (dateMatch) {
    const raw = dateMatch[0].replace(/[./]/g, '-');
    const parts = raw.split('-');
    if (parts[0].length === 4) {
      docDate = raw;
    } else if (parts[2].length === 4) {
      docDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
  }

  // Amount heuristics
  const amountRegex = /(?:Total\s*Order\s*Value|Grand\s*Total|Total\s*Amount|Net\s*Amount|Order\s*Value|Total)[\s:₹Rs.INR]*([0-9,]+(?:\.[0-9]{2})?)/i;
  const amtMatch = text.match(amountRegex);
  let total = 0;
  if (amtMatch) {
    total = parseFloat(amtMatch[1].replace(/,/g, '')) || 0;
  }

  return {
    documentType: 'PURCHASE_ORDER',
    systemDetected,
    poNumber,
    documentDate: docDate,
    buyerDetails: {
      gstin: buyerGstin,
      pan: buyerPan
    },
    sellerDetails: {
      gstin: sellerGstin,
      pan: sellerPan,
      erpVendorCode
    },
    lineItems: [
      {
        itemName: 'Imported Procurement Item',
        description: 'Details extracted from uploaded purchase document',
        quantity: 1,
        uom: 'NOS',
        unitPrice: total > 0 ? Math.round((total / 1.18) * 100) / 100 : 0,
        taxRate: 18,
        totalAmount: total > 0 ? total : 0
      }
    ],
    financials: {
      subtotal: total > 0 ? Math.round((total / 1.18) * 100) / 100 : 0,
      totalTax: total > 0 ? Math.round((total - total / 1.18) * 100) / 100 : 0,
      grandTotal: total,
      currency: 'INR'
    },
    deliveryTerms: {},
    confidenceScore: 0.4,
    notes: 'Parsed via deterministic document pattern analysis.'
  };
}

/**
 * Call Google AI Studio (Gemini 2.0 Flash / 1.5 Flash)
 */
async function callGeminiExtractor(buffer: Buffer, mimeType: string, apiKey: string): Promise<ExtractedDocumentData> {
  const models = ['gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
  let lastError: any = null;

  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            parts: [
              {
                text: SYSTEM_EXTRACTION_PROMPT
              },
              {
                inlineData: {
                  mimeType: mimeType || 'application/pdf',
                  data: buffer.toString('base64')
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini ${model} HTTP ${response.status}: ${errorText}`);
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        throw new Error(`Empty response from Gemini ${model}`);
      }

      const parsed: ExtractedDocumentData = JSON.parse(rawText);
      return parsed;
    } catch (err: any) {
      logger.warn(`[DocumentExtractor] Gemini ${model} failed: ${err.message}`);
      lastError = err;
      // If quota exceeded (429) or other failure, continue to failover
    }
  }

  throw lastError || new Error('All Gemini model endpoints failed');
}

/**
 * Call Nvidia NIM (meta/llama-3.2-11b-vision-instruct) Failover
 */
async function callNvidiaNimExtractor(buffer: Buffer, mimeType: string, apiKey: string): Promise<ExtractedDocumentData> {
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  
  // Format for vision models in OpenAI chat completion format
  const base64Data = buffer.toString('base64');
  const imageUrl = `data:${mimeType || 'application/pdf'};base64,${base64Data}`;

  const payload = {
    model: 'meta/llama-3.2-11b-vision-instruct',
    messages: [
      {
        role: 'system',
        content: SYSTEM_EXTRACTION_PROMPT
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract the procurement purchase order or tax invoice data into the structured JSON schema.'
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 3000
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Nvidia NIM HTTP ${response.status}: ${errorText}`);
  }

  const json = await response.json();
  const rawText = json?.choices?.[0]?.message?.content;
  if (!rawText) {
    throw new Error('Empty response from Nvidia NIM');
  }

  // Sanitize potential backticks
  const cleaned = rawText.replace(/```json\s*|\s*```/g, '').trim();
  const parsed: ExtractedDocumentData = JSON.parse(cleaned);
  return parsed;
}

/**
 * Normalizes and verifies mathematical consistency of extracted procurement documents.
 */
function normalizeExtractedData(data: ExtractedDocumentData): ExtractedDocumentData {
  // 1. Sanitize delivery address (fix common OCR typos like LIMITI -> LIMITED)
  if (data.deliveryTerms?.deliveryAddress) {
    data.deliveryTerms.deliveryAddress = data.deliveryTerms.deliveryAddress
      .replace(/\bLIMITI\b/gi, 'LIMITED')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // 2. Normalize and verify line items mathematically
  if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
    data.lineItems = data.lineItems.map(item => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unitPrice) || 0;
      const taxRate = Number(item.taxRate) || 0;
      const subtotal = Math.round(qty * price * 100) / 100;
      const taxAmt = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
      const calculatedTotal = Math.round((subtotal + taxAmt) * 100) / 100;

      const rawTotal = Number(item.totalAmount) || 0;
      // If extracted totalAmount is approximately equal to the pre-tax subtotal and taxRate > 0,
      // and NOT already equal to the tax-inclusive total, adjust to inclusive total.
      const finalTotal = (Math.abs(rawTotal - subtotal) < 0.05 && taxRate > 0 && Math.abs(rawTotal - calculatedTotal) > 0.5)
        ? calculatedTotal
        : (rawTotal > 0 ? rawTotal : calculatedTotal);

      return {
        ...item,
        quantity: qty,
        unitPrice: price,
        taxRate,
        totalAmount: finalTotal
      };
    });

    // 3. Re-harmonize financials with line items
    const sub = data.lineItems.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
    const tot = data.lineItems.reduce((acc, it) => acc + it.totalAmount, 0);
    const tax = Math.max(0, tot - sub);
    data.financials = {
      subtotal: Math.round(sub * 100) / 100,
      totalTax: Math.round(tax * 100) / 100,
      grandTotal: Math.round(tot * 100) / 100,
      currency: data.financials?.currency || 'INR'
    };
  }

  return data;
}

/**
 * Main Multi-Tier Extractor Entry Point
 */
export async function extractProcurementDocument(
  buffer: Buffer,
  mimeType: string = 'application/pdf',
  filename?: string
): Promise<DocumentExtractionResult> {
  const rawTextSample = buffer.toString('utf8', 0, Math.min(buffer.length, 50000));
  
  // Tier 0: Quick check for clear GeM or digital text patterns
  const heuristics = extractHeuristicsFromText(rawTextSample);

  // Tier 1: Primary AI Engine (Google AI Studio Gemini Flash)
  const rawGemini = [env.GEMINI_API_KEY, process.env.GEMINI_API_KEY].filter(Boolean) as string[];
  const geminiKeys = Array.from(new Set(rawGemini.flatMap(k => k.split(/[,;\s]+/)).map(k => k.trim()).filter(Boolean)));

  for (const geminiKey of geminiKeys) {
    try {
      logger.info(`[DocumentExtractor] Processing document via primary engine: ${filename || 'upload'}`);
      const aiData = await callGeminiExtractor(buffer, mimeType, geminiKey);
      
      const combined = normalizeExtractedData({
        ...heuristics,
        ...aiData,
        confidenceScore: aiData.confidenceScore || 0.95
      });

      return {
        success: true,
        extractionMode: 'AI_MODEL',
        statusBanner: 'Extracted via AI Model',
        data: combined
      };
    } catch (primaryErr: any) {
      logger.warn(`[DocumentExtractor] Gemini key attempt failed (${primaryErr.message}). Trying next candidate...`);
    }
  }

  // Tier 2: Secondary AI Engine (Nvidia NIM Vision Failover)
  const rawNvidia = [
    env.NVIDIA_NIM_API_KEY,
    (env as any).NVIDIA_API_KEY,
    process.env.NVIDIA_NIM_API_KEY,
    process.env.NVIDIA_API_KEY
  ].filter(Boolean) as string[];
  const nvidiaKeys = Array.from(new Set(rawNvidia.flatMap(k => k.split(/[,;\s]+/)).map(k => k.trim()).filter(Boolean)));

  for (const nvidiaKey of nvidiaKeys) {
    try {
      logger.info(`[DocumentExtractor] Processing document via secondary failover: ${filename || 'upload'}`);
      const nimData = await callNvidiaNimExtractor(buffer, mimeType, nvidiaKey);

      const combined = normalizeExtractedData({
        ...heuristics,
        ...nimData,
        confidenceScore: nimData.confidenceScore || 0.88
      });

      return {
        success: true,
        extractionMode: 'AI_MODEL',
        statusBanner: 'Extracted via AI Model',
        data: combined
      };
    } catch (secondaryErr: any) {
      logger.warn(`[DocumentExtractor] Nvidia NIM key attempt failed (${secondaryErr.message}). Trying next candidate...`);
    }
  }

  // Tier 3: Tertiary Graceful Fallback Mode (Deterministic local extraction)
  // NEVER throw 500 error; return partial heuristics so the user can verify in Split-Pane UI.
  logger.info(`[DocumentExtractor] Activating graceful fallback mode for: ${filename || 'upload'}`);
  return {
    success: true,
    extractionMode: 'GRACEFUL_FALLBACK',
    statusBanner: 'Manual Review Mode Active',
    data: normalizeExtractedData(heuristics),
    warnings: [
      'Document parsed in manual review mode. Please verify order details and line items against the original document.'
    ]
  };
}
