import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { maskPAN, maskGSTIN } from './maskPii';
import { resolveMediaUrl } from './api';

/**
 * Enterprise PDF Engine for MSME Procurement Portal
 * Generates SAP/Odoo style enterprise procurement ERP documents.
 */

export interface DocumentParty {
  title: string;
  name?: string;
  email?: string;
  address?: string;
  phone?: string;
  gstin?: string;
  pan?: string;
  logoUrl?: string | null;
  resolvedLogoDataUrl?: string | null;
  details?: string[]; // Extra details (e.g. Vendor Code, Dept, Ship Via)
}

export interface DocumentFinancials {
  subtotal?: number;
  discount?: number;
  taxableAmount?: number;
  igst?: number;
  cgst?: number;
  sgst?: number;
  totalTax?: number;
  tds?: number;
  shipping?: number;
  grandTotal: number;
  amountInWords?: string;
}

export interface DocumentConfig {
  documentTitle: string;
  documentNumber: string;
  referenceNumber?: string;
  dateStr: string;
  status?: string;
  parties: DocumentParty[]; // Usually Buyer and Seller
  infoGrid?: Record<string, string>; // Grid of metadata (e.g. Delivery Type, Payment Terms)
  tableHeaders: string[];
  tableData: any[][];
  financials?: DocumentFinancials;
  notes?: string[];
  terms?: string[];
  footerNote?: string;
  currency?: string;
  logoBase64?: string;
  watermark?: string;

  // Dynamic Issuer details (Replaces hardcoded third-party network branding)
  issuerName?: string;
  issuerSubtitle?: string;
  issuerLogo?: string | null;

  // Signatures & Stamps (Rendered directly in the signatory section)
  sellerSignatureUrl?: string | null;
  sellerStampUrl?: string | null;
  buyerSignatureUrl?: string | null;
  buyerStampUrl?: string | null;

  signatures?: {
    sellerTitle?: string;
    sellerName?: string;
    sellerSignatureUrl?: string | null;
    sellerStampUrl?: string | null;
    buyerTitle?: string;
    buyerName?: string;
    buyerSignatureUrl?: string | null;
    buyerStampUrl?: string | null;
  };
}

const PRIMARY_COLOR: [number, number, number] = [11, 36, 71]; // #0b2447 deep navy
const SECONDARY_COLOR: [number, number, number] = [30, 64, 114];
const ACCENT_COLOR: [number, number, number] = [230, 235, 241];
const TEXT_DARK: [number, number, number] = [15, 23, 42];
const TEXT_MUTED: [number, number, number] = [100, 116, 139];

/**
 * Safely converts an image URL or SVG to a base64 PNG data URL via HTML Canvas.
 */
export async function loadImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || typeof window === 'undefined') return null;
  const rawUrl = url.trim();
  if (!rawUrl) return null;
  if (rawUrl.startsWith('data:image/')) return rawUrl;

  const targetUrl = resolveMediaUrl(rawUrl) || rawUrl;
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  let authUrl = targetUrl.startsWith('/') ? `${window.location.origin}${targetUrl}` : targetUrl;
  if (token && (authUrl.includes('/api/files/') || authUrl.includes('/api/public/files/')) && !authUrl.includes('token=')) {
    const sep = authUrl.includes('?') ? '&' : '?';
    authUrl = `${authUrl}${sep}token=${encodeURIComponent(token)}`;
  }

  // 1. First attempt: fetch -> blob -> readAsDataURL -> draw onto canvas to guarantee standard PNG
  try {
    const fetchHeaders: Record<string, string> = {};
    if (token) {
      fetchHeaders['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(authUrl, {
      mode: 'cors',
      credentials: 'include',
      headers: fetchHeaders
    });
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        const rawDataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') resolve(reader.result);
            else resolve(null);
          };
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });

        if (rawDataUrl) {
          // Normalize to canvas PNG to guarantee compatibility with jsPDF addImage
          const pngDataUrl = await new Promise<string | null>((resolve) => {
            try {
              const img = new Image();
              img.onload = () => {
                try {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.naturalWidth || img.width || 300;
                  canvas.height = img.naturalHeight || img.height || 100;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return resolve(rawDataUrl);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                  resolve(canvas.toDataURL('image/png'));
                } catch {
                  resolve(rawDataUrl);
                }
              };
              img.onerror = () => resolve(rawDataUrl);
              img.src = rawDataUrl;
            } catch {
              resolve(rawDataUrl);
            }
          });
          if (pngDataUrl) return pngDataUrl;
        }
      }
    }
  } catch (err) {
    console.warn('loadImageAsDataUrl fetch failed, attempting canvas fallback:', err);
  }

  // 2. Second attempt: HTML Image + Canvas fallback with crossOrigin
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 100;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = authUrl;
    } catch {
      resolve(null);
    }
  });
}

export const fallbackStr = (val: any, fallback = 'N/A') => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number' && Number.isNaN(val)) return fallback;
  const str = String(val).trim();
  return str === '' ? fallback : str;
};

/**
 * Strips raw Unicode rupee characters (which break Helvetica encoding in jsPDF)
 * and ensures clean enterprise representation.
 */
export const sanitizePdfText = (val: any): string => {
  if (val === undefined || val === null || val === '') return 'N/A';
  if (typeof val === 'number') {
    return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  const str = String(val);
  return str.replace(/₹/g, 'INR ').trim();
};

export const moneyPdf = (val: any, currency = 'INR') => {
  const num = Number(val || 0);
  if (!Number.isFinite(num) || num === 0) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const numberToWords = (amount: number): string => {
  if (amount === 0) return 'Zero Rupees';
  const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const toWords = (num: number): string => {
    if (num < 20) return units[num];
    if (num < 100) return tens[Math.floor(num / 10)] + (num % 10 !== 0 ? ' ' + units[num % 10] : '');
    if (num < 1000) return units[Math.floor(num / 100)] + ' Hundred' + (num % 100 !== 0 ? ' and ' + toWords(num % 100) : '');
    if (num < 100000) return toWords(Math.floor(num / 1000)) + ' Thousand' + (num % 1000 !== 0 ? ' ' + toWords(num % 1000) : '');
    if (num < 10000000) return toWords(Math.floor(num / 100000)) + ' Lakh' + (num % 100000 !== 0 ? ' ' + toWords(num % 100000) : '');
    return toWords(Math.floor(num / 10000000)) + ' Crore' + (num % 10000000 !== 0 ? ' ' + toWords(num % 10000000) : '');
  };

  const whole = Math.floor(amount);
  const fraction = Math.round((amount - whole) * 100);
  
  let words = toWords(whole) + ' Rupees';
  if (fraction > 0) {
    words += ' and ' + toWords(fraction) + ' Paise';
  }
  return words + ' Only';
};

export class PdfEngine {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private cursorY: number = 0;
  
  constructor(orientation: 'p' | 'l' = 'p') {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', orientation });
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  public getDoc() {
    return this.doc;
  }

  private drawHeader(config: DocumentConfig, resolvedLogoDataUrl: string | null) {
    // Top colored banner band
    this.doc.setFillColor(...PRIMARY_COLOR);
    this.doc.rect(0, 0, this.pageWidth, 36, 'F');
    
    // Header Left: Dynamic Organization Branding
    this.doc.setTextColor(255, 255, 255);
    const logoToUse = resolvedLogoDataUrl || config.logoBase64 || null;
    const startX = logoToUse ? 45 : 14;

    if (logoToUse) {
      try {
        const format = logoToUse.includes('image/jpeg') ? 'JPEG' : 'PNG';
        this.doc.addImage(logoToUse, format, 14, 5, 26, 26);
      } catch (err) {
        console.warn('Unable to embed header logo in PDF:', err);
      }
    }

    const issuerTitle = fallbackStr(config.issuerName, 'ENTERPRISE PROCUREMENT').toUpperCase();
    const issuerSub = fallbackStr(config.issuerSubtitle, 'Official Commercial Document');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    const titleLines = this.doc.splitTextToSize(issuerTitle, this.pageWidth - startX - 75);
    this.doc.text(titleLines[0] || issuerTitle, startX, 14);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8.5);
    const subLines = this.doc.splitTextToSize(issuerSub, this.pageWidth - startX - 75);
    this.doc.text(subLines[0] || issuerSub, startX, 20);

    // Document Title & Metadata - Right Column
    this.doc.setFontSize(11);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.documentTitle.toUpperCase(), this.pageWidth - 14, 14, { align: 'right' });
    
    this.doc.setFontSize(8.5);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`No: ${sanitizePdfText(config.documentNumber)}`, this.pageWidth - 14, 20, { align: 'right' });
    this.doc.text(`Date: ${sanitizePdfText(config.dateStr)}`, this.pageWidth - 14, 25, { align: 'right' });
    
    if (config.status) {
      this.doc.text(`Status: ${sanitizePdfText(config.status)}`, this.pageWidth - 14, 30, { align: 'right' });
    }

    this.cursorY = 44;
  }

  private drawParties(parties: DocumentParty[]) {
    if (!parties || parties.length === 0) return;

    const head: string[] = parties.map(p => sanitizePdfText(p.title));
    const body: string[][] = [parties.map(p => {
      const lines: string[] = [];
      lines.push(fallbackStr(p.name, 'N/A'));
      lines.push(`Address: ${fallbackStr(p.address, 'N/A')}`);
      lines.push(`Email: ${fallbackStr(p.email, 'N/A')}`);
      lines.push(`Phone: ${fallbackStr(p.phone, 'N/A')}`);
      if (p.gstin && p.gstin !== 'N/A') {
        lines.push(`GSTIN: ${maskGSTIN(p.gstin)}`);
      } else {
        lines.push(`GSTIN: N/A`);
      }
      if (p.pan && p.pan !== 'N/A') {
        lines.push(`PAN: ${maskPAN(p.pan)}`);
      }
      if (p.details && p.details.length > 0) {
        p.details.forEach(d => {
          if (d) lines.push(sanitizePdfText(d));
        });
      }
      return lines.join('\n');
    })];

    autoTable(this.doc, {
      startY: this.cursorY,
      theme: 'grid',
      head: [head],
      body: body,
      headStyles: { fillColor: SECONDARY_COLOR, fontStyle: 'bold', textColor: 255 },
      styles: { fontSize: 8.5, cellPadding: 3.5, valign: 'top', textColor: TEXT_DARK },
      columnStyles: parties.reduce((acc, _, idx) => ({ ...acc, [idx]: { cellWidth: (this.pageWidth - 28) / parties.length } }), {}),
      didDrawCell: (data) => {
        if (data.section === 'body') {
          const party = parties[data.column.index];
          if (party && party.resolvedLogoDataUrl) {
            try {
              const format = party.resolvedLogoDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
              const logoSize = 13;
              const xPos = data.cell.x + data.cell.width - logoSize - 3;
              const yPos = data.cell.y + 3;
              this.doc.addImage(party.resolvedLogoDataUrl, format, xPos, yPos, logoSize, logoSize);
            } catch (err) {
              console.warn('Unable to render party logo in table cell:', err);
            }
          }
        }
      }
    });
    
    this.cursorY = (this.doc as any).lastAutoTable.finalY + 6;
  }

  private drawInfoGrid(infoGrid?: Record<string, string>) {
    if (!infoGrid || Object.keys(infoGrid).length === 0) return;

    const keys = Object.keys(infoGrid).map(k => sanitizePdfText(k));
    const values = Object.values(infoGrid).map(v => sanitizePdfText(v));

    autoTable(this.doc, {
      startY: this.cursorY,
      theme: 'grid',
      head: [keys],
      body: [values],
      headStyles: { fillColor: ACCENT_COLOR, textColor: TEXT_DARK, fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 2.5, textColor: TEXT_DARK },
    });

    this.cursorY = (this.doc as any).lastAutoTable.finalY + 6;
  }

  private drawItems(config: DocumentConfig) {
    if (!config.tableData || config.tableData.length === 0) return;

    const sanitizedHeaders = config.tableHeaders.map(h => sanitizePdfText(h));
    const sanitizedData = config.tableData.map(row =>
      row.map(cell => {
        if (cell === null || cell === undefined || cell === '') return 'N/A';
        return sanitizePdfText(cell);
      })
    );

    autoTable(this.doc, {
      startY: this.cursorY,
      theme: 'striped',
      head: [sanitizedHeaders],
      body: sanitizedData,
      headStyles: { fillColor: PRIMARY_COLOR, fontStyle: 'bold', textColor: 255 },
      bodyStyles: { textColor: TEXT_DARK },
      styles: { fontSize: 8.5, cellPadding: 3, overflow: 'linebreak' },
      columnStyles: sanitizedHeaders.reduce((acc, header, idx) => {
        const hLower = header.toLowerCase();
        if (hLower.includes('sr') || hLower === '#') {
          acc[idx] = { cellWidth: 14, halign: 'center' };
        } else if (hLower.includes('qty') || hLower.includes('quantity')) {
          acc[idx] = { cellWidth: 20, halign: 'center' };
        } else if (hLower.includes('unit') && !hLower.includes('price')) {
          acc[idx] = { cellWidth: 18, halign: 'center' };
        } else if (hLower.includes('tax') || hLower.includes('gst')) {
          acc[idx] = { cellWidth: 20, halign: 'right' };
        } else if (hLower.includes('rate') || hLower.includes('price') || hLower.includes('amount') || hLower.includes('total')) {
          acc[idx] = { halign: 'right' };
        }
        return acc;
      }, {} as any),
      didParseCell: (data) => {
        if (data.section === 'body' || data.section === 'head') {
          const text = String(data.cell.raw || '').toLowerCase();
          if (text.includes('amount') || text.includes('total') || text.includes('rate') || text.includes('price')) {
            data.cell.styles.halign = 'right';
          }
        }
      }
    });

    this.cursorY = (this.doc as any).lastAutoTable.finalY + 6;
  }

  private drawFinancials(financials?: DocumentFinancials) {
    if (!financials) return;
    this.doc.setTextColor(...TEXT_DARK);

    const boxWidth = 90;
    const startX = this.pageWidth - boxWidth - 14;
    let y = this.cursorY;
    const currency = (this as any)._currentCurrency || 'INR';

    if (y + 40 > this.pageHeight - 30) {
      this.doc.addPage();
      y = 20;
    }

    this.doc.setFontSize(9);
    
    const drawLine = (label: string, val: number | undefined, isBold = false) => {
      if (val === undefined || Number.isNaN(val)) return;
      if (isBold) this.doc.setFont('helvetica', 'bold');
      else this.doc.setFont('helvetica', 'normal');
      
      this.doc.text(label, startX, y);
      this.doc.text(moneyPdf(val, currency), this.pageWidth - 14, y, { align: 'right' });
      y += 5;
    };

    drawLine('Subtotal', financials.subtotal);
    drawLine('Discount', financials.discount);
    drawLine('Taxable Amount', financials.taxableAmount);
    drawLine('CGST', financials.cgst);
    drawLine('SGST', financials.sgst);
    drawLine('IGST', financials.igst);
    drawLine('Total Tax', financials.totalTax);
    drawLine('TDS', financials.tds);
    drawLine('Shipping/Freight', financials.shipping);
    
    y += 2;
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(startX, y - 4, this.pageWidth - 14, y - 4);
    
    this.doc.setFontSize(11);
    drawLine('Grand Total', financials.grandTotal, true);
    
    y += 2;
    
    // Amount in Words
    if (financials.grandTotal > 0 && !Number.isNaN(financials.grandTotal)) {
      this.doc.setFontSize(8.5);
      this.doc.setFont('helvetica', 'italic');
      this.doc.setTextColor(...TEXT_MUTED);
      
      const words = financials.amountInWords || numberToWords(financials.grandTotal);
      const lines = this.doc.splitTextToSize(`Amount in words: ${words}`, this.pageWidth - 28);
      this.doc.text(lines, 14, y);
      y += (lines.length * 4) + 4;
    }

    this.cursorY = Math.max(this.cursorY, y);
  }

  private drawNotesAndTerms(config: DocumentConfig) {
    let y = this.cursorY + 6;

    if (y > this.pageHeight - 40) {
      this.doc.addPage();
      y = 20;
    }

    this.doc.setTextColor(...TEXT_DARK);
    
    if (config.notes && config.notes.length > 0) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.text('Notes / Remarks:', 14, y);
      y += 5;
      
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      config.notes.forEach(note => {
        const lines = this.doc.splitTextToSize(`• ${sanitizePdfText(note)}`, this.pageWidth - 28);
        this.doc.text(lines, 14, y);
        y += (lines.length * 4);
      });
      y += 4;
    }

    if (config.terms && config.terms.length > 0) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.text('Terms & Conditions:', 14, y);
      y += 5;
      
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      config.terms.forEach((term, i) => {
        const lines = this.doc.splitTextToSize(`${i + 1}. ${sanitizePdfText(term)}`, this.pageWidth - 28);
        this.doc.text(lines, 14, y);
        y += (lines.length * 4);
      });
    }
    
    this.cursorY = y;
  }

  private drawSignatures(
    config: DocumentConfig,
    sellerSigDataUrl: string | null,
    sellerStampDataUrl: string | null,
    buyerSigDataUrl: string | null,
    buyerStampDataUrl: string | null
  ) {
    let y = this.cursorY + 12;
    if (y + 36 > this.pageHeight - 20) {
      this.doc.addPage();
      y = 20;
    }

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...TEXT_DARK);

    const buyerName = config.parties && config.parties[0]?.name ? config.parties[0].name : 'Buyer';
    const sellerName = config.parties && config.parties[1]?.name ? config.parties[1].name : (config.parties && config.parties[0]?.name ? config.parties[0].name : 'Seller');

    // Left Signatory (Buyer)
    this.doc.text(`For ${fallbackStr(buyerName, 'Buyer')}`, 20, y);

    // Right Signatory (Seller)
    this.doc.text(`For ${fallbackStr(sellerName, 'Seller')}`, this.pageWidth - 20, y, { align: 'right' });

    // Render Buyer Stamp & Signature if present
    if (buyerStampDataUrl) {
      try {
        const format = buyerStampDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        this.doc.addImage(buyerStampDataUrl, format, 20, y + 2, 22, 22);
      } catch (e) {
        console.warn('Unable to render buyer stamp:', e);
      }
    }
    if (buyerSigDataUrl) {
      try {
        const format = buyerSigDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        this.doc.addImage(buyerSigDataUrl, format, buyerStampDataUrl ? 32 : 20, y + 6, 26, 14);
      } catch (e) {
        console.warn('Unable to render buyer signature:', e);
      }
    }

    // Render Seller Stamp & Signature if present
    const rightBoxX = this.pageWidth - 65;
    if (sellerStampDataUrl) {
      try {
        const format = sellerStampDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        this.doc.addImage(sellerStampDataUrl, format, rightBoxX, y + 2, 22, 22);
      } catch (e) {
        console.warn('Unable to render seller stamp:', e);
      }
    }
    if (sellerSigDataUrl) {
      try {
        const format = sellerSigDataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        this.doc.addImage(sellerSigDataUrl, format, this.pageWidth - 46, y + 6, 26, 14);
      } catch (e) {
        console.warn('Unable to render seller signature:', e);
      }
    }

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...TEXT_MUTED);
    this.doc.text('Authorized Signatory', 20, y + 26);
    this.doc.text('Authorized Signatory', this.pageWidth - 20, y + 26, { align: 'right' });

    this.cursorY = y + 32;
  }

  private drawFooter() {
    const pageCount = (this.doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(...TEXT_MUTED);
      
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(14, this.pageHeight - 12, this.pageWidth - 14, this.pageHeight - 12);
      
      this.doc.text('Enterprise Procurement & Supply Chain ERP', 14, this.pageHeight - 8);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - 14, this.pageHeight - 8, { align: 'right' });
    }
  }

  public async generate(config: DocumentConfig): Promise<jsPDF> {
    (this as any)._currentCurrency = config.currency || 'INR';

    const sellerSigUrl = config.sellerSignatureUrl || config.signatures?.sellerSignatureUrl;
    const sellerStampUrl = config.sellerStampUrl || config.signatures?.sellerStampUrl;
    const buyerSigUrl = config.buyerSignatureUrl || config.signatures?.buyerSignatureUrl;
    const buyerStampUrl = config.buyerStampUrl || config.signatures?.buyerStampUrl;

    const partyLogoPromises = (config.parties || []).map(p => loadImageAsDataUrl(p.logoUrl));

    // Pre-load all imagery asynchronously via canvas
    const [logoDataUrl, sellerSig, sellerStamp, buyerSig, buyerStamp, ...resolvedPartyLogos] = await Promise.all([
      loadImageAsDataUrl(config.issuerLogo || config.logoBase64),
      loadImageAsDataUrl(sellerSigUrl),
      loadImageAsDataUrl(sellerStampUrl),
      loadImageAsDataUrl(buyerSigUrl),
      loadImageAsDataUrl(buyerStampUrl),
      ...partyLogoPromises,
    ]);

    if (config.parties) {
      config.parties.forEach((p, idx) => {
        p.resolvedLogoDataUrl = resolvedPartyLogos[idx] || null;
      });
    }

    this.drawHeader(config, logoDataUrl);
    this.drawParties(config.parties);
    this.drawInfoGrid(config.infoGrid);
    this.drawItems(config);
    this.drawFinancials(config.financials);
    this.drawNotesAndTerms(config);
    this.drawSignatures(config, sellerSig, sellerStamp, buyerSig, buyerStamp);
    this.drawFooter();
    
    if (config.watermark) {
      const pageCount = (this.doc as any).internal.getNumberOfPages();
      this.doc.setFontSize(60);
      this.doc.setTextColor(200, 200, 200);
      for (let i = 1; i <= pageCount; i++) {
        this.doc.setPage(i);
        this.doc.text(config.watermark.toUpperCase(), this.pageWidth / 2, this.pageHeight / 2, { angle: 45, align: 'center' });
      }
    }
    
    return this.doc;
  }
}

