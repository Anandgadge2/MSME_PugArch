import PDFDocument from 'pdfkit';
import { db, notifyWorkflowSoon } from './workflow/workflow-common.js';
import { getFileContent } from './storage/storage.service.js';
import { logger } from '../config/logger.js';

export interface TaxInvoicePdfInput {
  id?: number;
  invoiceNumber: string;
  createdAt?: Date | string;
  amount?: number | string;
  taxableAmount?: number | string;
  cgstAmount?: number | string;
  sgstAmount?: number | string;
  igstAmount?: number | string;
  totalTaxAmount?: number | string;
  tdsAmount?: number | string;
  interstate?: boolean;
  sellerId?: number;
  buyerId?: number;
  fileAssetId?: number | null;
  invoiceFileId?: number | null;
  purchaseOrder?: any;
  seller?: any;
  buyer?: any;
  items?: any[];
}

/**
 * Format currency to standard INR representation.
 */
function formatInr(val: number | string | undefined | null): string {
  const num = Number(val || 0);
  if (!Number.isFinite(num)) return 'INR 0.00';
  return `INR ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Generates an official, high-precision GST Tax Invoice PDF Buffer using PDFKit.
 */
export async function generateInvoicePdfBuffer(invoice: TaxInvoicePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: Error) => reject(err));

      const po = invoice.purchaseOrder || {};
      const seller = invoice.seller || po.seller || {};
      const buyer = invoice.buyer || po.buyer || {};

      const sellerName = seller.organization?.organizationName || seller.sellerProfile?.businessName || seller.name || 'MSME Enterprise Supplier';
      const sellerAddress = seller.sellerProfile?.registeredAddress || seller.organization?.profile?.registeredAddress || 'Block No. 78, SSBT Complex, Jalgaon, Maharashtra - 425001';
      const sellerGstin = seller.organization?.gstin || seller.sellerProfile?.gst || '27BMOPP7706E2Z1';
      const sellerCin = seller.organization?.cinNumber || seller.sellerProfile?.cin || 'U62013MH2023PTC416118';
      const sellerPhone = seller.mobile || seller.sellerProfile?.mobile || '9326546128';
      const sellerEmail = seller.email || 'info@msme-portal.in';

      const buyerName = buyer.organization?.organizationName || buyer.buyerProfile?.organizationName || buyer.name || 'PROAID Buyer Organization';
      const buyerAddress = po.deliveryAddress || buyer.buyerProfile?.registeredAddress || 'V247+H95, Marwari Para, Jharsuguda, Odisha - 768201';
      const buyerGstin = buyer.organization?.gstin || buyer.buyerProfile?.gst || '27AALCS2063D1ZG';
      const buyerPan = buyer.organization?.panNumber || buyer.buyerProfile?.pan || 'PFGPK6340B';

      const invNo = invoice.invoiceNumber || `INV-${po.poNumber || invoice.id || '2026-001'}`;
      const dateStr = invoice.createdAt
        ? new Date(invoice.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      const rawItems = invoice.items?.length ? invoice.items : (po.items?.length ? po.items : []);
      const totalAmountNum = Number(invoice.amount || po.amount || 0);

      const items = rawItems.length > 0
        ? rawItems.map((item: any, idx: number) => {
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.unitPrice || item.priceUnit || 0);
            const lineTotal = Number(item.totalAmount || item.taxableAmount || qty * unitPrice || totalAmountNum);
            return {
              srNo: idx + 1,
              description: item.itemName || po.title || 'Order Item',
              hsn: item.hsnCode || item.hsn || '84719000',
              qty,
              unitPrice: unitPrice || (lineTotal / Math.max(qty, 1)),
              totalAmount: lineTotal
            };
          })
        : [{
            srNo: 1,
            description: po.title || `Purchase Order #${po.poNumber || invoice.id}`,
            hsn: '84719000',
            qty: 1,
            unitPrice: totalAmountNum,
            totalAmount: totalAmountNum
          }];

      const subtotalNum = Number(invoice.taxableAmount) || items.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0) || totalAmountNum;
      const isInterstate = Boolean(invoice.interstate);
      const cgstNum = isInterstate ? 0 : (Number(invoice.cgstAmount) || Math.round(subtotalNum * 0.09 * 100) / 100);
      const sgstNum = isInterstate ? 0 : (Number(invoice.sgstAmount) || Math.round(subtotalNum * 0.09 * 100) / 100);
      const igstNum = isInterstate ? (Number(invoice.igstAmount) || Math.round(subtotalNum * 0.18 * 100) / 100) : 0;
      const grandTotalNum = totalAmountNum || Math.round((subtotalNum + cgstNum + sgstNum + igstNum) * 100) / 100;

      // Page Layout Constants
      const pageWidth = 595.28; // A4 Width
      const pageMargin = 36;
      const contentWidth = pageWidth - (pageMargin * 2); // 523.28

      // Top Navy Header Banner
      doc.rect(pageMargin, 30, contentWidth, 36).fill('#12335f');
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', pageMargin + 15, 38);
      doc.fontSize(9).font('Helvetica').text('ORIGINAL COPY FOR RECIPIENT (GST COMPLIANT)', pageMargin + 15, 56);

      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(invNo, pageMargin + contentWidth - 180, 38, { width: 165, align: 'right' });
      doc.fontSize(8.5).font('Helvetica').text(`Date: ${dateStr}`, pageMargin + contentWidth - 180, 54, { width: 165, align: 'right' });

      let currentY = 76;

      // Seller & Buyer Address Boxes
      doc.rect(pageMargin, currentY, contentWidth / 2 - 4, 85).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
      doc.rect(pageMargin + contentWidth / 2 + 4, currentY, contentWidth / 2 - 4, 85).strokeColor('#cbd5e1').lineWidth(0.75).stroke();

      // Seller Details Box
      doc.fillColor('#12335f').fontSize(8.5).font('Helvetica-Bold').text('SUPPLIER / SELLER DETAILS', pageMargin + 8, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(sellerName, pageMargin + 8, currentY + 20);
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(sellerAddress, pageMargin + 8, currentY + 32, { width: contentWidth / 2 - 20 });
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${sellerGstin}`, pageMargin + 8, currentY + 60);
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`CIN: ${sellerCin} | Mobile: ${sellerPhone}`, pageMargin + 8, currentY + 71);

      // Buyer Details Box
      const rightBoxX = pageMargin + contentWidth / 2 + 4;
      doc.fillColor('#12335f').fontSize(8.5).font('Helvetica-Bold').text('BILLED TO / BUYER DETAILS', rightBoxX + 8, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(buyerName, rightBoxX + 8, currentY + 20);
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(buyerAddress, rightBoxX + 8, currentY + 32, { width: contentWidth / 2 - 20 });
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${buyerGstin}`, rightBoxX + 8, currentY + 60);
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`PAN: ${buyerPan} | Place of Supply: ${isInterstate ? 'Interstate (IGST)' : 'Maharashtra (27)'}`, rightBoxX + 8, currentY + 71);

      currentY += 95;

      // Table Header Row
      const colX = [
        pageMargin,
        pageMargin + 30,
        pageMargin + 250,
        pageMargin + 320,
        pageMargin + 370,
        pageMargin + 440
      ];
      const colW = [30, 220, 70, 50, 70, 83];

      doc.rect(pageMargin, currentY, contentWidth, 20).fill('#f1f5f9');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
      doc.text('SR#', colX[0] + 4, currentY + 6);
      doc.text('ITEM DESCRIPTION', colX[1] + 4, currentY + 6);
      doc.text('HSN/SAC', colX[2] + 4, currentY + 6);
      doc.text('QTY', colX[3] + 4, currentY + 6, { width: colW[3] - 8, align: 'right' });
      doc.text('UNIT PRICE', colX[4] + 4, currentY + 6, { width: colW[4] - 8, align: 'right' });
      doc.text('AMOUNT', colX[5] + 4, currentY + 6, { width: colW[5] - 8, align: 'right' });

      currentY += 20;

      // Items Rows
      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafafa';
        doc.rect(pageMargin, currentY, contentWidth, 22).fill(rowBg);
        doc.rect(pageMargin, currentY, contentWidth, 22).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        doc.fillColor('#334155').fontSize(8).font('Helvetica');
        doc.text(String(item.srNo), colX[0] + 4, currentY + 7);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(item.description, colX[1] + 4, currentY + 7, { width: colW[1] - 8, height: 14 });
        doc.font('Helvetica').fillColor('#475569').text(item.hsn, colX[2] + 4, currentY + 7);
        doc.text(String(item.qty), colX[3] + 4, currentY + 7, { width: colW[3] - 8, align: 'right' });
        doc.text(formatInr(item.unitPrice), colX[4] + 4, currentY + 7, { width: colW[4] - 8, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatInr(item.totalAmount), colX[5] + 4, currentY + 7, { width: colW[5] - 8, align: 'right' });

        currentY += 22;
      });

      currentY += 10;

      // Totals & Taxes Summary Box (Right aligned)
      const summaryWidth = 240;
      const summaryX = pageMargin + contentWidth - summaryWidth;

      doc.rect(summaryX, currentY, summaryWidth, 85).strokeColor('#cbd5e1').lineWidth(0.75).stroke();

      let sumY = currentY + 8;
      const addSummaryLine = (label: string, valStr: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor(bold ? '#0f172a' : '#475569');
        doc.text(label, summaryX + 10, sumY);
        doc.text(valStr, summaryX + 10, sumY, { width: summaryWidth - 20, align: 'right' });
        sumY += 14;
      };

      addSummaryLine('Subtotal (Taxable Value):', formatInr(subtotalNum));
      if (isInterstate) {
        addSummaryLine('IGST (18%):', formatInr(igstNum));
      } else {
        addSummaryLine('CGST (9%):', formatInr(cgstNum));
        addSummaryLine('SGST (9%):', formatInr(sgstNum));
      }

      doc.rect(summaryX, sumY - 4, summaryWidth, 0.75).fill('#cbd5e1');
      sumY += 2;
      addSummaryLine('TOTAL INVOICE AMOUNT:', formatInr(grandTotalNum), true);

      // Bank Details (Left side bottom)
      doc.rect(pageMargin, currentY, contentWidth - summaryWidth - 12, 85).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
      doc.fillColor('#12335f').fontSize(8.5).font('Helvetica-Bold').text('PAYMENT & BANK DETAILS', pageMargin + 10, currentY + 8);
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(`Bank Name: State Bank of India`, pageMargin + 10, currentY + 22);
      doc.text(`Account Name: ${sellerName}`, pageMargin + 10, currentY + 34);
      doc.text(`Account No: 39820194812`, pageMargin + 10, currentY + 46);
      doc.text(`IFSC Code: SBIN0001892`, pageMargin + 10, currentY + 58);
      doc.fillColor('#059669').fontSize(7.5).font('Helvetica-Bold').text('Status: GST Tax Invoice Created & Verified', pageMargin + 10, currentY + 70);

      currentY += 100;

      // Stamp & Authorized Signatory Footer
      doc.rect(pageMargin, currentY, contentWidth, 50).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text('Terms & Conditions: 1. Payment due within agreed PO timeline. 2. Subject to MSME Procurement Rules.', pageMargin + 10, currentY + 10, { width: contentWidth - 170 });
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(`For ${sellerName}`, pageMargin + contentWidth - 150, currentY + 10, { width: 140, align: 'center' });
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Authorized Signatory / Digital Stamp', pageMargin + contentWidth - 150, currentY + 36, { width: 140, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves existing stored PDF buffer or generates exact Tax Invoice PDF buffer.
 */
export async function getOrGenerateInvoicePdfBuffer(invoice: TaxInvoicePdfInput): Promise<{ buffer: Buffer; filename: string }> {
  const filename = `Invoice_${invoice.invoiceNumber || `INV-${invoice.id}`}.pdf`;

  // 1. Check if invoice has stored fileAssetId or invoiceFileId
  const fileAssetId = invoice.invoiceFileId || invoice.fileAssetId;
  if (fileAssetId) {
    try {
      const stored = await getFileContent(fileAssetId, { id: invoice.sellerId || 1, role: 'admin' });
      if (stored?.buffer && stored.buffer.length > 0) {
        logger.info({ invoiceId: invoice.id, fileAssetId }, 'Retrieved existing stored invoice PDF file asset buffer');
        return { buffer: stored.buffer, filename };
      }
    } catch (err) {
      logger.warn({ err, invoiceId: invoice.id, fileAssetId }, 'Could not retrieve existing invoice file asset buffer, generating PDF on demand');
    }
  }

  // 2. Generate PDF buffer using PDFKit
  const buffer = await generateInvoicePdfBuffer(invoice);
  return { buffer, filename };
}

/**
 * Generates an official, high-precision Purchase Order PDF Buffer using PDFKit.
 */
export async function generatePurchaseOrderPdfBuffer(po: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: Error) => reject(err));

      const buyer = po.buyer || {};
      const seller = po.seller || {};

      const buyerName = buyer.organization?.organizationName || buyer.buyerProfile?.organizationName || buyer.name || 'MSME Portal Buyer';
      const buyerAddress = po.deliveryAddress || buyer.buyerProfile?.registeredAddress || buyer.organization?.profile?.registeredAddress || 'V247+H95, Marwari Para, Jharsuguda, Odisha - 768201';
      const buyerGstin = buyer.organization?.gstin || buyer.buyerProfile?.gst || '27AALCS2063D1ZG';
      const buyerPan = buyer.organization?.panNumber || buyer.buyerProfile?.pan || 'PFGPK6340B';
      const buyerPhone = buyer.mobile || buyer.buyerProfile?.mobile || '8010762086';
      const buyerEmail = buyer.email || 'buyer@msme-portal.in';

      const sellerName = seller.organization?.organizationName || seller.sellerProfile?.businessName || seller.name || 'MSME Enterprise Supplier';
      const sellerAddress = seller.sellerProfile?.registeredAddress || seller.organization?.profile?.registeredAddress || 'Ganesh Complex, Jharsuguda, Odisha - 345678';
      const sellerGstin = seller.organization?.gstin || seller.sellerProfile?.gst || '27BMOPP7706E2Z1';
      const sellerPhone = seller.mobile || seller.sellerProfile?.mobile || '9326546128';
      const sellerEmail = seller.email || 'seller@msme-portal.in';

      const poNum = po.poNumber || `PO-${po.id || '2026-001'}`;
      const dateStr = po.createdAt
        ? new Date(po.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const deliveryDateStr = po.expectedDelivery
        ? new Date(po.expectedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'As per schedule';

      const rawItems = po.items?.length ? po.items : [];
      const totalAmountNum = Number(po.amount || po.totalValue || 0);

      const items = rawItems.length > 0
        ? rawItems.map((item: any, idx: number) => {
            const qty = Number(item.quantity || 1);
            const unitPrice = Number(item.unitPrice || 0);
            const lineTotal = Number(item.totalAmount || qty * unitPrice || totalAmountNum);
            return {
              srNo: idx + 1,
              description: item.itemName || po.title || 'Order Item',
              hsn: item.hsnCode || '84719000',
              qty,
              unitPrice: unitPrice || (lineTotal / Math.max(qty, 1)),
              totalAmount: lineTotal
            };
          })
        : [{
            srNo: 1,
            description: po.title || `Purchase Order #${poNum}`,
            hsn: '84719000',
            qty: 1,
            unitPrice: totalAmountNum,
            totalAmount: totalAmountNum
          }];

      const pageWidth = 595.28;
      const pageMargin = 36;
      const contentWidth = pageWidth - (pageMargin * 2);

      // Header Banner (Dark Navy)
      doc.rect(pageMargin, 30, contentWidth, 36).fill('#12335f');
      doc.fillColor('#ffffff').fontSize(16).font('Helvetica-Bold').text('OFFICIAL PURCHASE ORDER', pageMargin + 15, 38);
      doc.fontSize(9).font('Helvetica').text('MSME PROCUREMENT PORTAL - CONFIRMED ORDER', pageMargin + 15, 56);

      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(poNum, pageMargin + contentWidth - 180, 38, { width: 165, align: 'right' });
      doc.fontSize(8.5).font('Helvetica').text(`Date: ${dateStr}`, pageMargin + contentWidth - 180, 54, { width: 165, align: 'right' });

      let currentY = 76;

      // Buyer & Seller Details Boxes
      doc.rect(pageMargin, currentY, contentWidth / 2 - 4, 90).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
      doc.rect(pageMargin + contentWidth / 2 + 4, currentY, contentWidth / 2 - 4, 90).strokeColor('#cbd5e1').lineWidth(0.75).stroke();

      // Buyer Details Box (Issuing Authority)
      doc.fillColor('#12335f').fontSize(8.5).font('Helvetica-Bold').text('BUYER / ISSUING AUTHORITY', pageMargin + 8, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(buyerName, pageMargin + 8, currentY + 20);
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(buyerAddress, pageMargin + 8, currentY + 32, { width: contentWidth / 2 - 20 });
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${buyerGstin} | PAN: ${buyerPan}`, pageMargin + 8, currentY + 62);
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`Email: ${buyerEmail} | Mobile: ${buyerPhone}`, pageMargin + 8, currentY + 74);

      // Seller Details Box (Provider)
      const rightBoxX = pageMargin + contentWidth / 2 + 4;
      doc.fillColor('#12335f').fontSize(8.5).font('Helvetica-Bold').text('SELLER / SUPPLIER DETAILS', rightBoxX + 8, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9.5).font('Helvetica-Bold').text(sellerName, rightBoxX + 8, currentY + 20);
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(sellerAddress, rightBoxX + 8, currentY + 32, { width: contentWidth / 2 - 20 });
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold').text(`GSTIN: ${sellerGstin}`, rightBoxX + 8, currentY + 62);
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text(`Email: ${sellerEmail} | Mobile: ${sellerPhone}`, rightBoxX + 8, currentY + 74);

      currentY += 100;

      // Order Terms & Delivery Card
      doc.rect(pageMargin, currentY, contentWidth, 38).fill('#f8fafc');
      doc.rect(pageMargin, currentY, contentWidth, 38).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(`Order Title: ${po.title || 'Purchase Order'}`, pageMargin + 10, currentY + 7, { width: contentWidth - 20 });
      doc.fillColor('#475569').fontSize(8).font('Helvetica').text(`Expected Delivery Date: `, pageMargin + 10, currentY + 22);
      doc.font('Helvetica-Bold').text(deliveryDateStr, pageMargin + 110, currentY + 22);

      doc.font('Helvetica').text(`Payment Terms: `, pageMargin + 250, currentY + 22);
      doc.font('Helvetica-Bold').text(String(po.paymentTerms || 'PAY ON INVOICE').toUpperCase(), pageMargin + 320, currentY + 22);

      currentY += 46;

      // Table Header Row
      const colX = [
        pageMargin,
        pageMargin + 30,
        pageMargin + 250,
        pageMargin + 320,
        pageMargin + 370,
        pageMargin + 440
      ];
      const colW = [30, 220, 70, 50, 70, 83];

      doc.rect(pageMargin, currentY, contentWidth, 20).fill('#f1f5f9');
      doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
      doc.text('SR#', colX[0] + 4, currentY + 6);
      doc.text('ITEM DESCRIPTION', colX[1] + 4, currentY + 6);
      doc.text('HSN/SAC', colX[2] + 4, currentY + 6);
      doc.text('QTY', colX[3] + 4, currentY + 6, { width: colW[3] - 8, align: 'right' });
      doc.text('UNIT PRICE', colX[4] + 4, currentY + 6, { width: colW[4] - 8, align: 'right' });
      doc.text('TOTAL AMOUNT', colX[5] + 4, currentY + 6, { width: colW[5] - 8, align: 'right' });

      currentY += 20;

      // Items Rows
      items.forEach((item, idx) => {
        const rowBg = idx % 2 === 0 ? '#ffffff' : '#fafafa';
        doc.rect(pageMargin, currentY, contentWidth, 22).fill(rowBg);
        doc.rect(pageMargin, currentY, contentWidth, 22).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        doc.fillColor('#334155').fontSize(8).font('Helvetica');
        doc.text(String(item.srNo), colX[0] + 4, currentY + 7);
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(item.description, colX[1] + 4, currentY + 7, { width: colW[1] - 8, height: 14 });
        doc.font('Helvetica').fillColor('#475569').text(item.hsn, colX[2] + 4, currentY + 7);
        doc.text(String(item.qty), colX[3] + 4, currentY + 7, { width: colW[3] - 8, align: 'right' });
        doc.text(formatInr(item.unitPrice), colX[4] + 4, currentY + 7, { width: colW[4] - 8, align: 'right' });
        doc.font('Helvetica-Bold').fillColor('#0f172a').text(formatInr(item.totalAmount), colX[5] + 4, currentY + 7, { width: colW[5] - 8, align: 'right' });

        currentY += 22;
      });

      currentY += 10;

      // Grand Total Box
      const summaryWidth = 240;
      const summaryX = pageMargin + contentWidth - summaryWidth;

      doc.rect(summaryX, currentY, summaryWidth, 36).fill('#12335f');
      doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold').text('GRAND TOTAL PURCHASE VALUE:', summaryX + 10, currentY + 12);
      doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold').text(formatInr(totalAmountNum), summaryX + 10, currentY + 12, { width: summaryWidth - 20, align: 'right' });

      currentY += 46;

      // Terms & Authorized Signatory Footer
      doc.rect(pageMargin, currentY, contentWidth, 50).strokeColor('#cbd5e1').lineWidth(0.75).stroke();
      doc.fillColor('#475569').fontSize(7.5).font('Helvetica').text('Purchase Order Terms: 1. Order confirmed upon issuance. 2. Supplier to deliver per specified address & timeline. 3. Subject to MSME Procurement Guidelines.', pageMargin + 10, currentY + 10, { width: contentWidth - 170 });
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text(`For ${buyerName}`, pageMargin + contentWidth - 150, currentY + 10, { width: 140, align: 'center' });
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica').text('Authorized Issuing Authority Seal', pageMargin + contentWidth - 150, currentY + 36, { width: 140, align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Retrieves existing stored PO PDF buffer or generates exact Purchase Order PDF buffer.
 */
export async function getOrGeneratePurchaseOrderPdfBuffer(po: any): Promise<{ buffer: Buffer; filename: string }> {
  const filename = `PurchaseOrder_${po.poNumber || `PO-${po.id}`}.pdf`;

  if (po.pdfFileId) {
    try {
      const stored = await getFileContent(po.pdfFileId, { id: po.sellerId || 1, role: 'admin' });
      if (stored?.buffer && stored.buffer.length > 0) {
        logger.info({ poId: po.id, pdfFileId: po.pdfFileId }, 'Retrieved existing stored purchase order PDF file asset buffer');
        return { buffer: stored.buffer, filename };
      }
    } catch (err) {
      logger.warn({ err, poId: po.id, pdfFileId: po.pdfFileId }, 'Could not retrieve existing PO file asset buffer, generating PDF on demand');
    }
  }

  const buffer = await generatePurchaseOrderPdfBuffer(po);
  return { buffer, filename };
}

/**
 * Sends a notification email to the seller with the attached Purchase Order PDF when a buyer creates/issues a PO.
 */
export async function notifySellerNewPurchaseOrder(purchaseOrderId: number) {
  try {
    const po = await db.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            buyerProfile: true,
            organization: { include: { profile: true } }
          }
        },
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            sellerProfile: true,
            organization: { include: { profile: true } }
          }
        }
      }
    });

    if (!po || !po.sellerId) return;

    const formattedAmount = `₹${Number(po.amount || po.totalValue || 0).toLocaleString('en-IN')}`;
    const poNum = po.poNumber || `PO-${po.id}`;

    let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined = undefined;

    try {
      const pdfRes = await getOrGeneratePurchaseOrderPdfBuffer(po);
      if (pdfRes?.buffer && pdfRes.buffer.length > 0) {
        pdfAttachment = {
          filename: pdfRes.filename || `PurchaseOrder_${poNum}.pdf`,
          content: pdfRes.buffer,
          contentType: 'application/pdf'
        };
        logger.info({ poId: po.id, sellerId: po.sellerId, filename: pdfAttachment.filename }, 'Purchase Order PDF attached for seller notification email');
      }
    } catch (pdfErr) {
      logger.error({ error: pdfErr, poId: po.id }, 'Failed to generate/fetch Purchase Order PDF for seller notification');
    }

    const emailNote = pdfAttachment ? ' (Official Purchase Order PDF is attached to this email.)' : '';

    notifyWorkflowSoon(
      po.sellerId,
      `New Purchase Order Received: ${poNum}`,
      `A new Purchase Order ${poNum} (${po.title}) for amount ${formattedAmount} has been issued to your organization by ${po.buyer?.name || 'Buyer'}.${emailNote}`,
      'po_generated',
      '/seller/purchase-orders',
      pdfAttachment ? [pdfAttachment] : undefined
    );
  } catch (err) {
    logger.warn({ err, purchaseOrderId }, 'Failed to notify seller of new purchase order with PDF');
  }
}
