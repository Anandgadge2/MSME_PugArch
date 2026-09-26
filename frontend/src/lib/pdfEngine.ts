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

  /**
   * Controls the signatory block layout:
   * - 'bilateral' (default): Buyer + Seller signature blocks
   * - 'single': One "Authorized Officer" block (for MIS, admin reports)
   * - 'none': No signature block (for tabular reports, data exports)
   */
  signatoryMode?: 'bilateral' | 'single' | 'none';
  /** Title for single-signatory mode (e.g. "Reporting Officer") */
  singleSignatoryTitle?: string;
  /** Name for single-signatory mode */
  singleSignatoryName?: string;

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
 * Renders an image into a bounding box while preserving its native aspect ratio.
 * The image is scaled to fit within maxW × maxH and aligned within that box.
 */
export function drawFitImage(
  doc: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  align: 'left' | 'center' | 'right' = 'left'
): void {
  try {
    const format = dataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
    // Decode image to get natural dimensions
    const img = new Image();
    img.src = dataUrl;
    const natW = img.naturalWidth || img.width || maxW;
    const natH = img.naturalHeight || img.height || maxH;

    // Calculate scale to fit within bounding box
    const scale = Math.min(maxW / natW, maxH / natH, 1);
    const renderW = natW * scale;
    const renderH = natH * scale;

    // Align within bounding box
    let drawX = x;
    if (align === 'center') drawX = x + (maxW - renderW) / 2;
    else if (align === 'right') drawX = x + maxW - renderW;
    const drawY = y + (maxH - renderH) / 2; // vertically center

    doc.addImage(dataUrl, format, drawX, drawY, renderW, renderH);
  } catch (err) {
    console.warn('drawFitImage: unable to render image:', err);
  }
}

/**
 * Outputs a generated PDF document — either download or print.
 * Ensures print and download produce identical vector PDF output.
 */
export function outputPdf(doc: jsPDF, filename: string, mode: 'download' | 'print'): void {
  const safeName = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  if (mode === 'print') {
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  } else {
    doc.save(safeName);
  }
}

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
    // Dynamic banner height to fit multiline organization titles safely
    const bannerHeight = 38;
    this.doc.setFillColor(...PRIMARY_COLOR);
    this.doc.rect(0, 0, this.pageWidth, bannerHeight, 'F');
    
    // Header Left: Dynamic Organization Branding
    this.doc.setTextColor(255, 255, 255);
    const logoToUse = resolvedLogoDataUrl || config.logoBase64 || null;
    const startX = logoToUse ? 45 : 14;

    if (logoToUse) {
      drawFitImage(this.doc, logoToUse, 14, 5, 28, 28, 'left');
    }

    const rightMargin = 14;
    const rightColWidth = 85;
    const leftAvailableWidth = this.pageWidth - startX - rightColWidth - 8;

    const issuerTitle = fallbackStr(config.issuerName, 'ENTERPRISE PROCUREMENT').toUpperCase();
    const issuerSub = fallbackStr(config.issuerSubtitle, 'Official Commercial Document');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    const titleLines = this.doc.splitTextToSize(issuerTitle, leftAvailableWidth);
    let leftY = 12;
    if (titleLines.length > 1) {
      this.doc.text(titleLines[0], startX, leftY);
      leftY += 5;
      this.doc.text(titleLines[1], startX, leftY);
      leftY += 5;
    } else {
      this.doc.text(titleLines[0] || issuerTitle, startX, leftY);
      leftY += 6;
    }

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    const subLines = this.doc.splitTextToSize(issuerSub, leftAvailableWidth);
    this.doc.text(subLines[0] || issuerSub, startX, leftY);

    // Document Title & Metadata - Right Column
    this.doc.setFontSize(10.5);
    this.doc.setFont('helvetica', 'bold');
    const docTitleLines = this.doc.splitTextToSize(config.documentTitle.toUpperCase(), rightColWidth);
    let rightY = 12;
    docTitleLines.slice(0, 2).forEach((line: string) => {
      this.doc.text(line, this.pageWidth - rightMargin, rightY, { align: 'right' });
      rightY += 4.5;
    });

    this.doc.setFontSize(8);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`No: ${sanitizePdfText(config.documentNumber)}`, this.pageWidth - rightMargin, rightY, { align: 'right' });
    rightY += 4;
    this.doc.text(`Date: ${sanitizePdfText(config.dateStr)}`, this.pageWidth - rightMargin, rightY, { align: 'right' });
    
    if (config.status) {
      rightY += 4;
      this.doc.text(`Status: ${sanitizePdfText(config.status)}`, this.pageWidth - rightMargin, rightY, { align: 'right' });
    }

    this.cursorY = bannerHeight + 6;
  }

  private drawParties(parties: DocumentParty[]) {
    if (!parties || parties.length === 0) return;

    const head: string[] = parties.map(p => sanitizePdfText(p.title));
    const body: string[][] = [parties.map(p => {
      const lines: string[] = [];
      if (p.name && p.name !== 'N/A' && p.name !== '—') {
        lines.push(p.name);
      }
      if (p.address && p.address !== 'N/A' && p.address !== '—') {
        lines.push(`Address: ${p.address}`);
      }
      if (p.email && p.email !== 'N/A' && p.email !== '—') {
        lines.push(`Email: ${p.email}`);
      }
      if (p.phone && p.phone !== 'N/A' && p.phone !== '—') {
        lines.push(`Phone: ${p.phone}`);
      }
      if (p.gstin && p.gstin !== 'N/A' && p.gstin !== '—') {
        lines.push(`GSTIN: ${maskGSTIN(p.gstin)}`);
      }
      if (p.pan && p.pan !== 'N/A' && p.pan !== '—') {
        lines.push(`PAN: ${maskPAN(p.pan)}`);
      }
      if (p.details && p.details.length > 0) {
        p.details.forEach(d => {
          if (d && !d.endsWith(': N/A') && !d.endsWith(': —') && d !== 'N/A' && d !== '—') {
            lines.push(sanitizePdfText(d));
          }
        });
      }
      if (lines.length === 0) {
        lines.push('As per procurement terms & specifications');
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
            const maxLogoSize = 15;
            const xPos = data.cell.x + data.cell.width - maxLogoSize - 3;
            const yPos = data.cell.y + 3;
            drawFitImage(this.doc, party.resolvedLogoDataUrl, xPos, yPos, maxLogoSize, maxLogoSize, 'right');
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
    const mode = config.signatoryMode || 'bilateral';
    if (mode === 'none') return;

    const blockHeight = 40;
    let y = this.cursorY + 12;
    if (y + blockHeight > this.pageHeight - 20) {
      this.doc.addPage();
      y = 20;
    }

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...TEXT_DARK);

    if (mode === 'single') {
      // Single authority signatory (centered) — for MIS, admin reports, and tender notices
      const title = config.singleSignatoryTitle || config.signatures?.buyerTitle || (config.parties && config.parties[0]?.name ? config.parties[0].name : 'Procuring Authority');
      const name = config.singleSignatoryName || config.signatures?.buyerName || '';
      const centerX = this.pageWidth / 2;

      const titleLines = this.doc.splitTextToSize(`For ${fallbackStr(title, 'Procuring Authority')}`, this.pageWidth - 40);
      this.doc.text(titleLines[0], centerX, y, { align: 'center' });

      // Stamp (centered)
      const stampUrl = buyerStampDataUrl || sellerStampDataUrl;
      if (stampUrl) {
        drawFitImage(this.doc, stampUrl, centerX - 13, y + 3, 26, 20, 'center');
      }
      // Signature (centered, below stamp)
      const sigUrl = buyerSigDataUrl || sellerSigDataUrl;
      if (sigUrl) {
        const sigY = stampUrl ? y + 18 : y + 4;
        drawFitImage(this.doc, sigUrl, centerX - 15, sigY, 30, 14, 'center');
      }

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);
      this.doc.setTextColor(...TEXT_MUTED);
      if (name) {
        this.doc.text(name, centerX, y + 30, { align: 'center' });
      }
      this.doc.text('Authorized Signatory (Procuring Authority)', centerX, y + 35, { align: 'center' });

      this.cursorY = y + 40;
      return;
    }

    // Bilateral mode (default) — Buyer on left, Seller on right
    const rawBuyerTitle = config.signatures?.buyerTitle || (config.parties && config.parties[0]?.name ? config.parties[0].name : 'Buyer');
    const rawSellerTitle = config.signatures?.sellerTitle || (config.parties && config.parties[1]?.name ? config.parties[1].name : 'Seller');
    
    // Guard against RFQ title being injected into seller signatory
    const sellerTitle = (rawSellerTitle === config.documentTitle || rawSellerTitle.startsWith('Procurement of') || (config.parties && config.parties[1]?.title === 'RFQ'))
      ? 'Authorized Bidder Representative'
      : rawSellerTitle;

    const signatoryColWidth = (this.pageWidth - 50) / 2;
    const buyerSigLines = this.doc.splitTextToSize(`For ${fallbackStr(rawBuyerTitle, 'Buyer')}`, signatoryColWidth);
    this.doc.text(buyerSigLines[0], 20, y);

    const sellerSigLines = this.doc.splitTextToSize(`For ${fallbackStr(sellerTitle, 'Seller')}`, signatoryColWidth);
    this.doc.text(sellerSigLines[0], this.pageWidth - 20, y, { align: 'right' });

    // Buyer Stamp & Signature (left side — stamp first, signature below)
    if (buyerStampDataUrl) {
      drawFitImage(this.doc, buyerStampDataUrl, 20, y + 3, 25, 20, 'left');
    }
    if (buyerSigDataUrl) {
      const sigY = buyerStampDataUrl ? y + 18 : y + 4;
      drawFitImage(this.doc, buyerSigDataUrl, 20, sigY, 30, 14, 'left');
    }

    // Seller Stamp & Signature (right side — stamp first, signature below)
    const rightBoxX = this.pageWidth - 55;
    if (sellerStampDataUrl) {
      drawFitImage(this.doc, sellerStampDataUrl, rightBoxX, y + 3, 25, 20, 'right');
    }
    if (sellerSigDataUrl) {
      const sigY = sellerStampDataUrl ? y + 18 : y + 4;
      drawFitImage(this.doc, sellerSigDataUrl, rightBoxX, sigY, 30, 14, 'right');
    }

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...TEXT_MUTED);
    const buyerOfficerName = config.signatures?.buyerName || '';
    if (buyerOfficerName) {
      this.doc.text(buyerOfficerName, 20, y + 30);
    }
    this.doc.text('Authorized Signatory', 20, y + 35);

    const sellerOfficerName = config.signatures?.sellerName || '';
    if (sellerOfficerName) {
      this.doc.text(sellerOfficerName, this.pageWidth - 20, y + 30, { align: 'right' });
    }
    this.doc.text('Authorized Signatory', this.pageWidth - 20, y + 35, { align: 'right' });

    this.cursorY = y + 40;
  }

  private drawFooter() {
    const pageCount = (this.doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setTextColor(...TEXT_MUTED);
      
      this.doc.setDrawColor(200, 200, 200);
      this.doc.line(14, this.pageHeight - 12, this.pageWidth - 14, this.pageHeight - 12);
      
      const footerText = (this as any)._footerNote || 'Enterprise Procurement & Supply Chain ERP';
      this.doc.text(footerText, 14, this.pageHeight - 8);
      this.doc.text(`Page ${i} of ${pageCount}`, this.pageWidth - 14, this.pageHeight - 8, { align: 'right' });
    }
  }

  public async generate(config: DocumentConfig): Promise<jsPDF> {
    (this as any)._currentCurrency = config.currency || 'INR';
    (this as any)._footerNote = config.footerNote || (config.issuerName ? `${config.issuerName} · Official Document` : 'Enterprise Procurement & Supply Chain ERP');
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

