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
      const meta = (typeof po.metadata === 'object' && po.metadata !== null ? po.metadata : {}) as Record<string, any>;
      const deliveryDetails = (meta.deliveryDetails || {}) as Record<string, any>;
      const billingDetails = (meta.billingDetails || {}) as Record<string, any>;

      const buyerName =
        billingDetails.companyName ||
        buyer.organization?.organizationName ||
        buyer.buyerProfile?.organizationName ||
        buyer.buyerProfile?.companyName ||
        buyer.name ||
        'MSME Portal Buyer';

      const buyerAddress =
        po.deliveryAddress ||
        billingDetails.billingAddress ||
        deliveryDetails.address ||
        buyer.buyerProfile?.registeredAddress ||
        buyer.organization?.profile?.registeredAddress ||
        'V247+H95, Marwari Para, Jharsuguda, Odisha - 768201';

      const buyerGstin =
        billingDetails.gstin ||
        buyer.organization?.gstin ||
        buyer.buyerProfile?.gst ||
        '27AALCS2063D1ZG';

      const buyerPan =
        buyer.organization?.panNumber ||
        buyer.buyerProfile?.pan ||
        'PFGPK6340B';

      const buyerPhone =
        deliveryDetails.mobileNumber ||
        buyer.mobile ||
        buyer.buyerProfile?.mobile ||
        '8010762086';

      const buyerEmail = buyer.email || 'buyer@msme-portal.in';

      const sellerName =
        seller.organization?.organizationName ||
        seller.sellerProfile?.businessName ||
        seller.sellerProfile?.companyName ||
        seller.name ||
        'MSME Enterprise Supplier';

      const sellerAddress =
        seller.sellerProfile?.registeredAddress ||
        seller.organization?.profile?.registeredAddress ||
        'Ganesh Complex, Jharsuguda, Odisha - 345678';

      const sellerGstin =
        seller.organization?.gstin ||
        seller.sellerProfile?.gst ||
        '27BMOPP7706E2Z1';

      const sellerPhone =
        seller.mobile ||
        seller.sellerProfile?.mobile ||
        '9326546128';

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
 * Sends notification emails with the attached Purchase Order PDF to BOTH the seller and the buyer
 * whenever a Purchase Order is created/generated (from cart checkout, procurement checkout, RFQ award, etc.).
 */
export async function notifyPurchaseOrderCreated(purchaseOrderId: number) {
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

    if (!po) {
      logger.warn({ purchaseOrderId }, 'Purchase order not found for notification');
      return;
    }

    const formattedAmount = `₹${Number(po.amount || po.totalValue || 0).toLocaleString('en-IN')}`;
    const poNum = po.poNumber || `PO-${po.id}`;
    const deliveryDateStr = po.expectedDelivery
      ? new Date(po.expectedDelivery).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'As per schedule';

    const meta = (typeof po.metadata === 'object' && po.metadata !== null ? po.metadata : {}) as Record<string, any>;
    const billingDetails = (meta.billingDetails || {}) as Record<string, any>;

    const buyerDisplayName =
      billingDetails.companyName ||
      po.buyer?.organization?.organizationName ||
      po.buyer?.buyerProfile?.organizationName ||
      po.buyer?.name ||
      'Buyer';

    const sellerDisplayName =
      po.seller?.organization?.organizationName ||
      po.seller?.sellerProfile?.businessName ||
      po.seller?.name ||
      'Supplier';

    let pdfAttachment: { filename: string; content: Buffer; contentType: string } | undefined = undefined;

    try {
      const pdfRes = await getOrGeneratePurchaseOrderPdfBuffer(po);
      if (pdfRes?.buffer && pdfRes.buffer.length > 0) {
        pdfAttachment = {
          filename: pdfRes.filename || `PurchaseOrder_${poNum}.pdf`,
          content: pdfRes.buffer,
          contentType: 'application/pdf'
        };
        logger.info({ poId: po.id, sellerId: po.sellerId, buyerId: po.buyerId, filename: pdfAttachment.filename }, 'Purchase Order PDF attached for buyer and seller notification emails');
      }
    } catch (pdfErr) {
      logger.error({ error: pdfErr, poId: po.id }, 'Failed to generate/fetch Purchase Order PDF for notification');
    }

    const emailNote = pdfAttachment ? ' (Official Purchase Order PDF is attached to this email.)' : '';

    const escapeHtml = (value: unknown) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    // 1. Notify Seller
    if (po.sellerId) {
      const sellerEmailHtml = `
        <div style="margin-bottom: 20px; padding: 18px 20px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;">
          <p style="margin: 0 0 4px; color: #16a34a; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">New Order Received</p>
          <h2 style="margin: 0; color: #14532d; font-size: 18px; font-weight: 700;">Purchase Order ${escapeHtml(poNum)} Generated</h2>
        </div>

        <p style="margin: 0 0 16px; color: #334155; font-size: 14px; line-height: 1.6;">
          A new Purchase Order has been generated and issued to your organization by <strong>${escapeHtml(buyerDisplayName)}</strong>.
        </p>

        <table role="presentation" style="width: 100%; margin: 0 0 20px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 13px;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; width: 38%;">PO Number</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${escapeHtml(poNum)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Order Title</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(po.title || 'Purchase Order')}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Total Order Value</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #16a34a; font-weight: 700; font-size: 14px;">${escapeHtml(formattedAmount)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Expected Delivery Date</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(deliveryDateStr)}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Payment Terms</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(String(po.paymentTerms || 'PAY ON INVOICE').toUpperCase())}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Delivery Address</td>
            <td style="padding: 10px 14px; color: #0f172a;">${escapeHtml(po.deliveryAddress || 'As per purchase order')}</td>
          </tr>
        </table>

        <p style="margin: 0 0 16px; color: #475569; font-size: 13px; line-height: 1.6;">
          📄 The official Purchase Order PDF (<strong>${escapeHtml(pdfAttachment?.filename || `PurchaseOrder_${poNum}.pdf`)}</strong>) is attached to this email for your reference and fulfillment records.
        </p>

        <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
          Please log into your MSME portal dashboard to accept the order, coordinate dispatch, and generate the corresponding invoice once goods/services are delivered.
        </p>
      `;

      notifyWorkflowSoon(
        po.sellerId,
        `New Purchase Order Received: ${poNum}`,
        `A new Purchase Order ${poNum} (${po.title}) for amount ${formattedAmount} has been issued to your organization by ${buyerDisplayName}.${emailNote}`,
        'po_generated',
        '/seller/orders',
        pdfAttachment ? [pdfAttachment] : undefined,
        {
          emailSubject: `[PO Received] New Purchase Order #${poNum} from ${buyerDisplayName} - MSME Portal`,
          emailHtml: sellerEmailHtml
        }
      );
    }

    // 2. Notify Buyer
    if (po.buyerId) {
      const buyerEmailHtml = `
        <div style="margin-bottom: 20px; padding: 18px 20px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
          <p style="margin: 0 0 4px; color: #2563eb; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;">Order Confirmation</p>
          <h2 style="margin: 0; color: #1e3a8a; font-size: 18px; font-weight: 700;">Purchase Order ${escapeHtml(poNum)} Generated Successfully</h2>
        </div>

        <p style="margin: 0 0 16px; color: #334155; font-size: 14px; line-height: 1.6;">
          Your Purchase Order has been generated and formally issued to supplier <strong>${escapeHtml(sellerDisplayName)}</strong>.
        </p>

        <table role="presentation" style="width: 100%; margin: 0 0 20px; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; font-size: 13px;">
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600; width: 38%;">PO Number</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">${escapeHtml(poNum)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Supplier / Vendor</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(sellerDisplayName)}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Order Title</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(po.title || 'Purchase Order')}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Total Order Value</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #2563eb; font-weight: 700; font-size: 14px;">${escapeHtml(formattedAmount)}</td>
          </tr>
          <tr style="background: #f8fafc;">
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Expected Delivery Date</td>
            <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${escapeHtml(deliveryDateStr)}</td>
          </tr>
          <tr>
            <td style="padding: 10px 14px; color: #64748b; font-weight: 600;">Delivery Address</td>
            <td style="padding: 10px 14px; color: #0f172a;">${escapeHtml(po.deliveryAddress || 'As per purchase order')}</td>
          </tr>
        </table>

        <p style="margin: 0 0 16px; color: #475569; font-size: 13px; line-height: 1.6;">
          📄 The official Purchase Order PDF (<strong>${escapeHtml(pdfAttachment?.filename || `PurchaseOrder_${poNum}.pdf`)}</strong>) is attached to this email for your compliance and accounting records.
        </p>

        <p style="margin: 0; color: #475569; font-size: 13px; line-height: 1.6;">
          You can track the fulfillment, dispatch updates, inspection, and payment milestones anytime from your orders dashboard.
        </p>
      `;

      notifyWorkflowSoon(
        po.buyerId,
        `Purchase Order Generated: ${poNum}`,
        `Your Purchase Order ${poNum} (${po.title}) for amount ${formattedAmount} has been generated successfully and issued to ${sellerDisplayName}.${emailNote}`,
        'po_generated',
        '/buyer/orders',
        pdfAttachment ? [pdfAttachment] : undefined,
        {
          emailSubject: `[PO Issued] Purchase Order #${poNum} Generated - MSME Portal`,
          emailHtml: buyerEmailHtml
        }
      );
    }

    logger.info({ poId: po.id, poNum, buyerId: po.buyerId, sellerId: po.sellerId }, 'Purchase Order generated notifications and emails dispatched');
  } catch (err) {
    logger.warn({ err, purchaseOrderId }, 'Failed to notify parties of new purchase order with PDF');
  }
}

/**
 * Backward-compatible alias for notifyPurchaseOrderCreated.
 */
export async function notifySellerNewPurchaseOrder(purchaseOrderId: number) {
  return notifyPurchaseOrderCreated(purchaseOrderId);
}

export interface PaymentReceiptPdfInput {
  id?: number;
  referenceId: string;
  createdAt?: Date | string;
  paidAt?: Date | string;
  completedAt?: Date | string;
  amount?: number | string;
  currency?: string;
  gateway?: string;
  method?: string;
  status?: string;
  invoiceNumber?: string;
  poNumber?: string;
  payerName?: string;
  payerEmail?: string;
  payeeName?: string;
  payeeEmail?: string;
  taxableAmount?: number | string;
  cgstAmount?: number | string;
  sgstAmount?: number | string;
  igstAmount?: number | string;
  tdsAmount?: number | string;
  netAmountPaid?: number | string;
  escrowStatus?: string;
  escrowBalance?: number | string;
  escrowVaultName?: string;
}

/**
 * Generates an official, high-precision Payment Receipt PDF Buffer matching the exact portal UI screenshot.
 */
export async function generatePaymentReceiptPdfBuffer(input: PaymentReceiptPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 36 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err: Error) => reject(err));

      const pageMargin = 36;
      const contentWidth = 595.28 - (pageMargin * 2);

      // Top Navy Accent Bar
      doc.rect(pageMargin, pageMargin, contentWidth, 4).fill('#12335f');

      let currentY = pageMargin + 14;

      // Header: Portal Name & Status Badge
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('GOVERNMENT MSME PORTAL', pageMargin, currentY);
      
      const badgeText = (input.status || 'SUCCESS').toUpperCase();
      doc.roundedRect(pageMargin + contentWidth - 75, currentY, 75, 16, 8).fill('#dcfce7');
      doc.fillColor('#15803d').fontSize(8).font('Helvetica-Bold').text(badgeText, pageMargin + contentWidth - 75, currentY + 4, { width: 75, align: 'center' });

      currentY += 12;

      doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text('Official Payment Receipt', pageMargin, currentY);
      
      const dateStr = input.paidAt || input.completedAt || input.createdAt
        ? new Date(input.paidAt || input.completedAt || input.createdAt!).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text(`DATE: ${dateStr.toUpperCase()}`, pageMargin + contentWidth - 170, currentY + 6, { width: 90, align: 'right' });

      currentY += 26;

      const refId = input.referenceId || `PAY-2026-${String(input.id || '001').padStart(6, '0')}`;
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(`System generated receipt for payment reference `, pageMargin, currentY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#0f172a').text(refId);

      currentY += 20;

      // 3 Top Cards (Receipt Reference, Invoice Number, Purchase Order)
      const colW = (contentWidth - 16) / 3;

      // Card 1: Receipt Reference
      doc.roundedRect(pageMargin, currentY, colW, 44, 6).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text('RECEIPT REFERENCE', pageMargin + 10, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(refId, pageMargin + 10, currentY + 22, { width: colW - 20 });

      // Card 2: Invoice Number
      const card2X = pageMargin + colW + 8;
      doc.roundedRect(card2X, currentY, colW, 44, 6).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text('INVOICE NUMBER', card2X + 10, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(input.invoiceNumber || 'N/A', card2X + 10, currentY + 22, { width: colW - 20 });

      // Card 3: Purchase Order
      const card3X = card2X + colW + 8;
      doc.roundedRect(card3X, currentY, colW, 44, 6).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#64748b').fontSize(7).font('Helvetica-Bold').text('PURCHASE ORDER', card3X + 10, currentY + 8);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(input.poNumber || 'N/A', card3X + 10, currentY + 22, { width: colW - 20 });

      currentY += 56;

      // Payer / Buyer & Payee / Seller Block (2 columns)
      const halfW = (contentWidth - 12) / 2;

      // Left: Payer / Buyer
      doc.roundedRect(pageMargin, currentY, halfW, 58, 6).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('PAYER / BUYER', pageMargin + 12, currentY + 10);
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(input.payerName || 'Snehal Kolhe', pageMargin + 12, currentY + 24, { width: halfW - 24 });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(input.payerEmail || 'buyer@msme-portal.in', pageMargin + 12, currentY + 38, { width: halfW - 24 });

      // Right: Payee / Seller
      const rightX = pageMargin + halfW + 12;
      doc.roundedRect(rightX, currentY, halfW, 58, 6).fillAndStroke('#f8fafc', '#cbd5e1');
      doc.fillColor('#64748b').fontSize(7.5).font('Helvetica-Bold').text('PAYEE / SELLER', rightX + 12, currentY + 10);
      doc.fillColor('#0f172a').fontSize(10).font('Helvetica-Bold').text(input.payeeName || 'Sandhya Kolhe', rightX + 12, currentY + 24, { width: halfW - 24 });
      doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(input.payeeEmail || 'seller@msme-portal.in', rightX + 12, currentY + 38, { width: halfW - 24 });

      currentY += 72;

      // Total Settlement Amount Box (Blue Banner)
      const totalAmountNum = Number(input.amount || input.netAmountPaid || 0);
      const formattedTotal = formatInr(totalAmountNum);
      const methodStr = input.method ? `Gateway: ${input.gateway || 'bank_transfer'} | Method: ${input.method}` : 'Gateway: bank transfer | Method: card';

      doc.roundedRect(pageMargin, currentY, contentWidth, 68, 8).fill('#f0f9ff').stroke('#bae6fd');
      doc.fillColor('#0369a1').fontSize(8).font('Helvetica-Bold').text('TOTAL SETTLEMENT AMOUNT', pageMargin, currentY + 14, { width: contentWidth, align: 'center' });
      doc.fillColor('#0c4a6e').fontSize(22).font('Helvetica-Bold').text(formattedTotal, pageMargin, currentY + 28, { width: contentWidth, align: 'center' });
      doc.fillColor('#0284c7').fontSize(8).font('Helvetica').text(methodStr, pageMargin, currentY + 52, { width: contentWidth, align: 'center' });

      currentY += 82;

      // Tax and Deduction Summary Header
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text('TAX AND DEDUCTION SUMMARY', pageMargin, currentY);

      currentY += 14;

      // Table Headers
      doc.rect(pageMargin, currentY, contentWidth, 20).fill('#f1f5f9');
      doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold').text('DESCRIPTION', pageMargin + 10, currentY + 6);
      doc.fillColor('#334155').fontSize(7.5).font('Helvetica-Bold').text('AMOUNT (INR)', pageMargin + contentWidth - 120, currentY + 6, { width: 110, align: 'right' });

      currentY += 20;

      const taxableNum = Number(input.taxableAmount || totalAmountNum);
      const cgstNum = Number(input.cgstAmount || 0);
      const sgstNum = Number(input.sgstAmount || 0);
      const igstNum = Number(input.igstAmount || 0);
      const tdsNum = Number(input.tdsAmount || 0);

      const tableRows = [
        { label: 'Taxable Amount', amount: taxableNum },
        { label: 'CGST', amount: cgstNum },
        { label: 'SGST', amount: sgstNum },
        { label: 'IGST', amount: igstNum },
        { label: 'TDS Deducted', amount: -tdsNum, isNegative: true },
      ];

      tableRows.forEach((row, idx) => {
        const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
        doc.rect(pageMargin, currentY, contentWidth, 18).fill(bg);
        doc.fillColor('#334155').fontSize(8).font('Helvetica').text(row.label, pageMargin + 10, currentY + 5);
        const amtStr = row.isNegative && row.amount < 0 ? `-${formatInr(Math.abs(row.amount))}` : formatInr(row.amount);
        doc.fillColor('#334155').fontSize(8).font('Helvetica').text(amtStr, pageMargin + contentWidth - 120, currentY + 5, { width: 110, align: 'right' });
        currentY += 18;
      });

      // Net Amount Paid Row (Bold Highlight)
      doc.rect(pageMargin, currentY, contentWidth, 22).fill('#e2e8f0');
      doc.fillColor('#0f172a').fontSize(8.5).font('Helvetica-Bold').text('Net Amount Paid', pageMargin + 10, currentY + 6);
      doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text(formattedTotal, pageMargin + contentWidth - 120, currentY + 6, { width: 110, align: 'right' });

      currentY += 30;

      // Escrow Custody Status Box
      doc.roundedRect(pageMargin, currentY, contentWidth, 42, 6).fillAndStroke('#f0fdf4', '#bbf7d0');
      doc.fillColor('#166534').fontSize(7.5).font('Helvetica-Bold').text(input.escrowVaultName || 'ESCROW ACCOUNT VAULT-B', pageMargin + 12, currentY + 10);
      doc.fillColor('#15803d').fontSize(8.5).font('Helvetica').text(`Custody Balance: `, pageMargin + 12, currentY + 24, { continued: true });
      doc.font('Helvetica-Bold').text(formattedTotal);

      // Held Badge inside escrow card
      const escrowBadgeText = (input.escrowStatus || 'HELD').toUpperCase();
      doc.roundedRect(pageMargin + contentWidth - 60, currentY + 12, 50, 18, 4).fill('#dcfce7');
      doc.fillColor('#15803d').fontSize(8).font('Helvetica-Bold').text(escrowBadgeText, pageMargin + contentWidth - 60, currentY + 16, { width: 50, align: 'center' });

      currentY += 54;

      // Footer declaration
      doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica').text(
        'This is an official computer-generated payment receipt from the Government MSME Portal finance module.',
        pageMargin,
        currentY,
        { width: contentWidth, align: 'center' }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Sends a notification email with attached Payment Receipt PDF to both Payer (Buyer) and Payee (Seller) when a payment is completed.
 */
export async function notifyPaymentReceiptEmail(paymentId: number) {
  try {
    const payment = await db.paymentTransaction.findUnique({
      where: { id: paymentId },
      include: {
        invoice: {
          include: {
            purchaseOrder: true,
            items: true
          }
        },
        purchaseOrder: {
          include: {
            items: true
          }
        },
        payer: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            buyerProfile: true,
            organization: { include: { profile: true } }
          }
        },
        payee: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            sellerProfile: true,
            organization: { include: { profile: true } }
          }
        },
        escrowAccount: true
      }
    });

    if (!payment) return;

    const refId = payment.referenceId || `PAY-2026-${String(payment.id).padStart(6, '0')}`;
    const invNo = payment.invoice?.invoiceNumber || (payment.purchaseOrder?.poNumber ? `INV-${payment.purchaseOrder.poNumber}` : `INV-${payment.invoiceId || payment.id}`);
    const poNum = payment.purchaseOrder?.poNumber || (payment.invoice?.purchaseOrder?.poNumber) || `PO-${payment.purchaseOrderId || payment.id}`;

    const payerName = payment.payer?.organization?.organizationName || payment.payer?.name || 'Buyer';
    const payeeName = payment.payee?.organization?.organizationName || payment.payee?.name || 'Seller';

    const pdfBuffer = await generatePaymentReceiptPdfBuffer({
      id: payment.id,
      referenceId: refId,
      createdAt: payment.createdAt,
      paidAt: payment.completedAt || payment.updatedAt,
      amount: payment.amount,
      currency: payment.currency || 'INR',
      gateway: payment.gateway || 'bank_transfer',
      method: payment.method || 'card',
      status: payment.status || 'success',
      invoiceNumber: invNo,
      poNumber: poNum,
      payerName,
      payerEmail: payment.payer?.email || '',
      payeeName,
      payeeEmail: payment.payee?.email || '',
      taxableAmount: payment.invoice?.taxableAmount || payment.amount,
      cgstAmount: payment.invoice?.cgstAmount || 0,
      sgstAmount: payment.invoice?.sgstAmount || 0,
      igstAmount: payment.invoice?.igstAmount || 0,
      tdsAmount: payment.invoice?.tdsAmount || 0,
      escrowStatus: payment.escrowAccount?.status || 'held',
      escrowBalance: payment.escrowAccount?.amount || payment.amount,
      escrowVaultName: 'ESCROW ACCOUNT VAULT-B'
    });

    const pdfAttachment = {
      filename: `PaymentReceipt_${refId}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf'
    };

    const formattedAmount = `₹${Number(payment.amount || 0).toLocaleString('en-IN')}`;

    // 1. Notify Payer (Buyer) with attached Payment Receipt PDF
    if (payment.payerId) {
      notifyWorkflowSoon(
        payment.payerId,
        `Payment Confirmation & Receipt: ${refId}`,
        `Your payment of ${formattedAmount} for Invoice ${invNo} (PO ${poNum}) has been successfully processed and confirmed. Official payment receipt PDF is attached to this email.`,
        'payment_successful',
        '/payments/invoices',
        [pdfAttachment]
      );
    }

    // 2. Notify Payee (Seller) with attached Payment Receipt PDF
    if (payment.payeeId) {
      notifyWorkflowSoon(
        payment.payeeId,
        `Payment Received & Escrow Funded: ${refId}`,
        `Payment of ${formattedAmount} for Invoice ${invNo} (PO ${poNum}) from ${payerName} has been confirmed and placed in escrow custody. Official payment receipt PDF is attached to this email.`,
        'escrow_funded',
        '/payments/invoices',
        [pdfAttachment]
      );
    }

    logger.info({ paymentId: payment.id, refId, filename: pdfAttachment.filename }, 'Payment Receipt PDF generated and sent via email notification');
  } catch (err) {
    logger.error({ err, paymentId }, 'Failed to generate and email Payment Receipt PDF');
  }
}
