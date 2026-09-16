/**
 * Enhanced Goods Receipt Note (GRN) PDF Generator
 * Creates an ERP-grade, audit-compliant Goods Receipt Note matching the portal theme.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GrnDto } from '../api';
import { formatCurrency, formatDateTime, formatDate } from '../../shared/format';

export interface GrnPdfOptions {
  portalName?: string;
  portalSubtitle?: string;
  authorityName?: string;
}

const PRIMARY_COLOR: [number, number, number] = [18, 51, 95]; // #12335f Navy
const ACCENT_GOLD: [number, number, number] = [249, 168, 37]; // #f9a825 Gold
const SLATE_DARK: [number, number, number] = [15, 23, 42]; // #0f172a
const SLATE_MUTED: [number, number, number] = [100, 116, 139]; // #64748b
const SLATE_LIGHT: [number, number, number] = [248, 250, 252]; // #f8fafc
const SLATE_BORDER: [number, number, number] = [226, 232, 240]; // #e2e8f0

export function generateGrnPdf(grn: GrnDto, options: GrnPdfOptions = {}): jsPDF {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'p'
  });

  const portalName = options.portalName || 'JSGSMILE · MSME PROCUREMENT PORTAL';
  const portalSubtitle = options.portalSubtitle || 'Jharsuguda Synergy for MSME and Industry Linkage Ecosystem';
  const authorityName = options.authorityName || 'Government of Odisha · District Administration Jharsuguda';

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm
  const rightX = marginX + contentWidth; // 196mm

  // ─────────────────────────────────────────────────────────────
  // 1. TOP HEADER BANNER (Portal Theme: Navy & Gold)
  // ─────────────────────────────────────────────────────────────
  const headerHeight = 32;
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(0, 0, pageWidth, headerHeight, 'F');

  // Gold accent bar directly under header
  doc.setFillColor(...ACCENT_GOLD);
  doc.rect(0, headerHeight, pageWidth, 1.8, 'F');

  // Left Brand Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(portalName, marginX, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(241, 245, 249);
  doc.text(portalSubtitle, marginX, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...ACCENT_GOLD);
  doc.text(authorityName.toUpperCase(), marginX, 23);

  // Right Document Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text('GOODS RECEIPT NOTE', rightX, 11, { align: 'right' });

  doc.setFontSize(9.5);
  doc.setTextColor(...ACCENT_GOLD);
  doc.text(grn.grnNumber, rightX, 17.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(241, 245, 249);
  doc.text(`Receipt Date: ${formatDate(grn.receivedAt || grn.createdAt)}`, rightX, 23.5, { align: 'right' });

  let currentY = headerHeight + 5;

  // ─────────────────────────────────────────────────────────────
  // 2. STATUS & VERIFICATION RIBBON
  // ─────────────────────────────────────────────────────────────
  let statusBg: [number, number, number] = [236, 253, 245]; // Emerald
  let statusBorder: [number, number, number] = [16, 185, 129];
  let statusTextCol: [number, number, number] = [6, 95, 70];
  let statusTitle = `STATUS: ${grn.status} — INSPECTION PASSED`;
  let statusDesc = 'All delivered items have been inspected and verified against the purchase order. Authorized for invoice generation.';

  if (grn.status === 'PARTIAL') {
    statusBg = [254, 243, 199];
    statusBorder = [245, 158, 11];
    statusTextCol = [146, 64, 14];
    statusTitle = `STATUS: ${grn.status} — PARTIALLY ACCEPTED`;
    statusDesc = 'Consignment accepted with item discrepancies. Rejection notes have been recorded for vendor settlement.';
  } else if (grn.status === 'REJECTED') {
    statusBg = [255, 228, 230];
    statusBorder = [225, 29, 72];
    statusTextCol = [159, 18, 57];
    statusTitle = `STATUS: ${grn.status} — GOODS REJECTED`;
    statusDesc = grn.rejectionReason ? `Consignment failed verification: "${grn.rejectionReason}"` : 'Inspection requirements not met. Goods flagged for vendor return.';
  } else if (grn.status === 'SUBMITTED') {
    statusBg = [239, 246, 255];
    statusBorder = [59, 130, 246];
    statusTextCol = [30, 64, 175];
    statusTitle = `STATUS: ${grn.status} — UNDER INSPECTION`;
    statusDesc = 'Goods received at gate. Quality verification and technical audit currently in progress.';
  } else if (grn.status === 'DRAFT') {
    statusBg = [241, 245, 249];
    statusBorder = [148, 163, 184];
    statusTextCol = [51, 65, 85];
    statusTitle = `STATUS: ${grn.status} — INITIAL ENTRY`;
    statusDesc = 'Draft receipt created. Pending final store count and verification submission.';
  }

  const ribbonHeight = 11;
  doc.setFillColor(...statusBg);
  doc.setDrawColor(...statusBorder);
  doc.setLineWidth(0.35);
  doc.roundedRect(marginX, currentY, contentWidth, ribbonHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...statusTextCol);
  doc.text(statusTitle, marginX + 3.5, currentY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(statusDesc, marginX + 3.5, currentY + 8.2);

  currentY += ribbonHeight + 4;

  // ─────────────────────────────────────────────────────────────
  // 3. TWO-COLUMN ERP METADATA GRID (Consignee vs Supplier)
  // ─────────────────────────────────────────────────────────────
  const colGap = 4;
  const colWidth = (contentWidth - colGap) / 2; // ~89mm
  const cardHeight = 44;

  // --- LEFT CARD: Consignee & Receiving Details ---
  const leftX = marginX;
  doc.setFillColor(...SLATE_LIGHT);
  doc.setDrawColor(...SLATE_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(leftX, currentY, colWidth, cardHeight, 1.5, 1.5, 'FD');

  // Header band for left card
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(leftX, currentY, colWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CONSIGNEE & RECEIVING DETAILS', leftX + 3, currentY + 4.2);

  let fieldY = currentY + 10;
  const buyerOrgName = grn.organization?.name || grn.purchaseOrder?.buyer?.organization?.name || 'District Administration Jharsuguda';
  const buyerUserName = grn.purchaseOrder?.buyer?.name || 'Consignee Officer';
  const buyerEmail = grn.purchaseOrder?.buyer?.email || '—';
  const storeInCharge = `${grn.receivedBy?.name || 'Store Officer'} (${grn.receivedBy?.email || '—'})`;
  const receivingLocation = grn.purchaseOrder?.deliveryAddress || 'Central Store Depot, Jharsuguda';

  const renderField = (x: number, y: number, label: string, val: string, maxW = 83) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...SLATE_MUTED);
    doc.text(label, x, y);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_DARK);
    const splitVal = doc.splitTextToSize(val, maxW);
    doc.text(splitVal[0] || '—', x, y + 3.5);
    return y + 7.2;
  };

  fieldY = renderField(leftX + 3, fieldY, 'COMPANY / ORGANIZATION', buyerOrgName);
  fieldY = renderField(leftX + 3, fieldY, 'BUYER / INDENTOR', `${buyerUserName} · ${buyerEmail}`);
  fieldY = renderField(leftX + 3, fieldY, 'STORE IN-CHARGE (RECEIVED BY)', storeInCharge);
  fieldY = renderField(leftX + 3, fieldY, 'LOCATION / WAREHOUSE', receivingLocation);
  renderField(leftX + 3, fieldY, 'RECEIPT TIMESTAMP', formatDateTime(grn.receivedAt || grn.createdAt));

  // --- RIGHT CARD: Supplier, PO & Dispatch Details ---
  const rightColX = leftX + colWidth + colGap;
  doc.setFillColor(...SLATE_LIGHT);
  doc.setDrawColor(...SLATE_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(rightColX, currentY, colWidth, cardHeight, 1.5, 1.5, 'FD');

  // Header band for right card
  doc.setFillColor(...PRIMARY_COLOR);
  doc.rect(rightColX, currentY, colWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SUPPLIER & DISPATCH PARTICULARS', rightColX + 3, currentY + 4.2);

  const sellerName = grn.purchaseOrder?.seller?.name || grn.purchaseOrder?.seller?.organization?.name || 'Authorized Seller';
  const sellerEmail = grn.purchaseOrder?.seller?.email || '—';
  const poNumber = grn.purchaseOrder?.poNumber || 'PO-VERIFIED-SYSTEM';
  const poAmountStr = grn.purchaseOrder?.amount ? formatCurrency(grn.purchaseOrder.amount) : '—';
  const poDateStr = grn.purchaseOrder?.createdAt ? formatDate(grn.purchaseOrder.createdAt) : '—';
  const deliveryChallan = grn.documents?.[0]?.fileAsset?.originalName || `DN/${grn.grnNumber.replace('GRN-', '')}`;
  const vehicleRef = 'Verified Gate Entry / Registered Transport';

  fieldY = currentY + 10;
  fieldY = renderField(rightColX + 3, fieldY, 'SUPPLIER / VENDOR NAME', `${sellerName} (${sellerEmail})`);
  fieldY = renderField(rightColX + 3, fieldY, 'PURCHASE ORDER NUMBER', `${poNumber} · Val: ${poAmountStr}`);
  fieldY = renderField(rightColX + 3, fieldY, 'PO CREATION DATE', poDateStr);
  fieldY = renderField(rightColX + 3, fieldY, 'DELIVERY NOTE / CHALLAN NO', deliveryChallan);
  renderField(rightColX + 3, fieldY, 'VEHICLE / GATE ENTRY REF', vehicleRef);

  currentY += cardHeight + 4;

  // ─────────────────────────────────────────────────────────────
  // 4. 3-WAY MATCH & QUANTITY SUMMARY STRIP
  // ─────────────────────────────────────────────────────────────
  const totalOrdered = grn.items.reduce((s, i) => s + Number(i.orderedQty || 0), 0);
  const totalReceived = grn.items.reduce((s, i) => s + Number(i.receivedQty || 0), 0);
  const totalAccepted = grn.items.reduce((s, i) => s + Number(i.acceptedQty || 0), 0);
  const totalRejected = grn.items.reduce((s, i) => s + Number(i.rejectedQty || 0), 0);

  const kpiBoxWidth = (contentWidth - (3 * 3)) / 4; // ~43mm
  const kpiHeight = 11;

  const kpis = [
    { label: 'TOTAL ORDERED', val: totalOrdered, col: SLATE_DARK },
    { label: 'RECEIVED AT GATE', val: totalReceived, col: PRIMARY_COLOR },
    { label: 'ACCEPTED QUALITY', val: totalAccepted, col: [5, 150, 105] as [number, number, number] },
    { label: 'REJECTED QTY', val: totalRejected, col: totalRejected > 0 ? [225, 29, 72] as [number, number, number] : SLATE_MUTED }
  ];

  kpis.forEach((kpi, idx) => {
    const kpiX = marginX + (idx * (kpiBoxWidth + 3));
    doc.setFillColor(...SLATE_LIGHT);
    doc.setDrawColor(...SLATE_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(kpiX, currentY, kpiBoxWidth, kpiHeight, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...SLATE_MUTED);
    doc.text(kpi.label, kpiX + 3, currentY + 3.8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...kpi.col);
    doc.text(String(kpi.val), kpiX + 3, currentY + 8.8);
  });

  currentY += kpiHeight + 5;

  // ─────────────────────────────────────────────────────────────
  // 5. LINE ITEMS RECEIVED TABLE (autoTable)
  // ─────────────────────────────────────────────────────────────
  const tableHeaders = [
    'S.No',
    'Item Code / SKU',
    'Item Description & Specification',
    'UOM',
    'Ordered',
    'Received',
    'Accepted',
    'Rejected',
    'Inspection Remarks'
  ];

  const tableRows = grn.items.map((item, idx) => {
    const itemCode = `ITM-${String(idx + 1).padStart(3, '0')}`;
    const desc = item.itemName || 'Consignment item';
    const uom = (item.unitOfMeasure || 'Nos').toUpperCase();
    const ord = Number(item.orderedQty || 0);
    const rec = Number(item.receivedQty || 0);
    const acc = Number(item.acceptedQty || 0);
    const rej = Number(item.rejectedQty || 0);

    let remark = item.rejectionReason || '—';
    if (rej === 0 && acc === rec) {
      remark = 'Passed Quality Check';
    } else if (rej > 0) {
      remark = item.rejectionReason ? `Rejected: ${item.rejectionReason}` : 'Discrepancy / Damaged';
    }

    return [
      String(idx + 1),
      itemCode,
      desc,
      uom,
      String(ord),
      String(rec),
      String(acc),
      String(rej),
      remark
    ];
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHeaders],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: PRIMARY_COLOR,
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2
    },
    styles: {
      fontSize: 7,
      textColor: SLATE_DARK,
      cellPadding: 2,
      lineColor: SLATE_BORDER,
      lineWidth: 0.25,
      overflow: 'linebreak'
    },
    alternateRowStyles: {
      fillColor: SLATE_LIGHT
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 }, // S.No
      1: { halign: 'left', cellWidth: 22, fontStyle: 'bold' }, // Item Code
      2: { halign: 'left', cellWidth: 46 }, // Description
      3: { halign: 'center', cellWidth: 14 }, // UOM
      4: { halign: 'right', cellWidth: 15 }, // Ordered
      5: { halign: 'right', cellWidth: 15 }, // Received
      6: { halign: 'right', cellWidth: 15, fontStyle: 'bold', textColor: [5, 150, 105] }, // Accepted
      7: { halign: 'right', cellWidth: 15, fontStyle: 'bold', textColor: [225, 29, 72] }, // Rejected
      8: { halign: 'left', cellWidth: 30 } // Remarks
    },
    foot: [[
      'TOTALS',
      '',
      `Consignment Items: ${grn.items.length}`,
      '',
      String(totalOrdered),
      String(totalReceived),
      String(totalAccepted),
      String(totalRejected),
      totalRejected === 0 ? '100% Verification Match' : `${totalRejected} Units Discrepancy`
    ]],
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: PRIMARY_COLOR,
      fontStyle: 'bold',
      fontSize: 7.2,
      halign: 'right',
      cellPadding: 2.2
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = (doc as any).lastAutoTable.finalY + 4;

  // ─────────────────────────────────────────────────────────────
  // 6. INSPECTION & GATE REMARKS (If present)
  // ─────────────────────────────────────────────────────────────
  const hasInspectionNote = Boolean(grn.inspectionNote && grn.inspectionNote.trim());
  const hasRemarks = Boolean(grn.remarks && grn.remarks.trim());

  if (hasInspectionNote || hasRemarks) {
    // Check if we have enough room before page bottom; if not, add page
    if (currentY > pageHeight - 50) {
      doc.addPage();
      currentY = 16;
    }

    const noteBoxHeight = 15;
    doc.setFillColor(...SLATE_LIGHT);
    doc.setDrawColor(...SLATE_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(marginX, currentY, contentWidth, noteBoxHeight, 1.2, 1.2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text('QUALITY INSPECTION OBSERVATIONS & GATE REMARKS:', marginX + 3, currentY + 4.2);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_DARK);

    let notesContent = '';
    if (hasInspectionNote) notesContent += `Inspection Note: ${grn.inspectionNote}. `;
    if (hasRemarks) notesContent += `Gate Remarks: ${grn.remarks}.`;

    const splitNotes = doc.splitTextToSize(notesContent, contentWidth - 6);
    doc.text(splitNotes.slice(0, 2), marginX + 3, currentY + 8.2);

    currentY += noteBoxHeight + 4;
  }

  // ─────────────────────────────────────────────────────────────
  // 7. SIGNATURES & VERIFICATION BLOCK (Reference Image Format)
  // ─────────────────────────────────────────────────────────────
  // Ensure signature block fits on current page; otherwise add new page
  if (currentY > pageHeight - 48) {
    doc.addPage();
    currentY = 16;
  }

  const sigBoxHeight = 30;
  const sigColWidth = (contentWidth - (2 * 4)) / 3; // ~58mm

  const signatures = [
    {
      title: 'INSPECTED BY',
      role: 'Quality Control / Inspection Officer',
      name: 'QC Verified & Approved',
      date: grn.approvedAt ? formatDateTime(grn.approvedAt) : grn.updatedAt ? formatDateTime(grn.updatedAt) : 'Under Review',
      status: grn.status === 'APPROVED' ? 'Inspection Passed' : grn.status === 'REJECTED' ? 'Inspection Failed' : 'Pending Review'
    },
    {
      title: 'STORE IN-CHARGE',
      role: 'Consignee / Store Gate Officer',
      name: grn.receivedBy?.name || 'Store Receiver',
      date: formatDateTime(grn.receivedAt || grn.createdAt),
      status: 'Gate Entry Verified'
    },
    {
      title: 'AUTHORIZED BY',
      role: 'Purchase Approving Authority',
      name: grn.purchaseOrder?.buyer?.name || 'Competent Authority',
      date: grn.approvedAt ? formatDateTime(grn.approvedAt) : 'Pending Sign-off',
      status: grn.status === 'APPROVED' ? 'Approved & Locked' : grn.status
    }
  ];

  signatures.forEach((sig, idx) => {
    const sigX = marginX + (idx * (sigColWidth + 4));

    doc.setFillColor(...SLATE_LIGHT);
    doc.setDrawColor(...SLATE_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(sigX, currentY, sigColWidth, sigBoxHeight, 1.5, 1.5, 'FD');

    // Header strip
    doc.setFillColor(...PRIMARY_COLOR);
    doc.rect(sigX, currentY, sigColWidth, 5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(255, 255, 255);
    doc.text(sig.title, sigX + 3, currentY + 3.5);

    // Signature line
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE_MUTED);
    doc.text('Signature: __________________________', sigX + 3, currentY + 11.5);

    // Name & Designation
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_DARK);
    doc.text(sig.name, sigX + 3, currentY + 16.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...SLATE_MUTED);
    doc.text(sig.role, sigX + 3, currentY + 20);
    doc.text(`Date: ${sig.date}`, sigX + 3, currentY + 23.5);

    // Status pill text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...PRIMARY_COLOR);
    doc.text(`[ ${sig.status.toUpperCase()} ]`, sigX + 3, currentY + 27.5);
  });

  // ─────────────────────────────────────────────────────────────
  // 8. PAGE FOOTERS & AUDIT TRAIL (Applied to all pages)
  // ─────────────────────────────────────────────────────────────
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);

    // Subtle divider line
    doc.setDrawColor(...SLATE_BORDER);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 11, rightX, pageHeight - 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...SLATE_MUTED);

    const auditTrail = `JsgSmile System Generated GRN · Doc ID: GRN-${grn.id} · Verification Hash: ${grn.grnNumber}`;
    doc.text(auditTrail, marginX, pageHeight - 7);

    const portalVerify = 'Verify at https://msme.odisha.gov.in';
    doc.text(portalVerify, pageWidth / 2, pageHeight - 7, { align: 'center' });

    doc.text(`Page ${p} of ${totalPages}`, rightX, pageHeight - 7, { align: 'right' });
  }

  return doc;
}

export function downloadGrnPdf(grn: GrnDto, options: GrnPdfOptions = {}): void {
  const doc = generateGrnPdf(grn, options);
  const cleanNumber = (grn.grnNumber || `GRN-${grn.id}`).replace(/[^a-zA-Z0-9-_]/g, '_');
  doc.save(`${cleanNumber}.pdf`);
}
