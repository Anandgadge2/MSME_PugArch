import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TaxInvoiceItem {
  srNo: number | string;
  description: string;
  hsn: string;
  qty: number | string;
  unit?: string;
  priceUnit: number | string;
  amount: number | string;
}

export interface TaxInvoiceData {
  copyType?: string; // 'Original Copy' | 'Duplicate Copy' | 'Triplicate Copy' | 'Quadruplicate Copy'
  invoiceNumber: string;
  dateStr: string;
  placeOfSupply?: string;
  seller: {
    name: string;
    address: string;
    gstin?: string;
    phone?: string;
    email?: string;
    cin?: string;
    logoUrl?: string | null;
    stampUrl?: string | null;
    signatureUrl?: string | null;
  };
  billTo: {
    name: string;
    address: string;
    pan?: string;
    gstin?: string;
  };
  shipTo: {
    name: string;
    address: string;
  };
  items: TaxInvoiceItem[];
  subtotal: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  otherTaxAmount?: number;
  totalAmount: number;
  bankDetails: {
    bankName: string;
    accountNo: string;
    ifscCode: string;
    accountName: string;
  };
}

/**
 * Safely converts an image URL or SVG to a base64 PNG data URL via Canvas.
 */
export async function loadImageAsDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url || typeof window === 'undefined') return null;
  if (url.startsWith('data:image/')) return url;

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
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export function formatInr(val: number | string | undefined | null): string {
  const num = Number(val || 0);
  if (!Number.isFinite(num)) return '-';
  if (num === 0) return ' -';
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Generates the precision A4 Tax Invoice PDF matching the exact ERP format.
 */
export async function generateTaxInvoicePdf(data: TaxInvoiceData): Promise<jsPDF> {
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    orientation: 'p'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const marginX = 14;
  const contentWidth = pageWidth - (marginX * 2); // 182mm
  const rightX = marginX + contentWidth; // 196mm
  const midX = marginX + (contentWidth / 2); // 105mm

  // Pre-load images only if explicitly provided (logo, stamp, signature)
  const logoDataUrl = data.seller.logoUrl ? await loadImageAsDataUrl(data.seller.logoUrl) : null;
  const stampDataUrl = data.seller.stampUrl ? await loadImageAsDataUrl(data.seller.stampUrl) : null;
  const signatureDataUrl = data.seller.signatureUrl ? await loadImageAsDataUrl(data.seller.signatureUrl) : null;

  let currentY = 16;
  const startBoxY = currentY;

  doc.setDrawColor(30, 41, 59); // Crisp slate-800 border
  doc.setLineWidth(0.35);

  // ─────────────────────────────────────────────────────────────
  // 1. TOP HEADER BOX: Seller details (left) & Logo + CIN (right)
  // ─────────────────────────────────────────────────────────────
  const headerBoxHeight = 36;
  doc.rect(marginX, currentY, contentWidth, headerBoxHeight);

  // Left Side: Seller Info
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(data.seller.name || 'PugArch Technology Pvt Ltd', marginX + 3.5, currentY + 6.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  const sellerAddressLines = doc.splitTextToSize(data.seller.address || 'L-18,Laxman Nagar,Manewada,Nagpur,440034', (contentWidth / 2) + 10);
  doc.text(sellerAddressLines, marginX + 3.5, currentY + 11.5);

  const addressOffset = Math.min(sellerAddressLines.length * 3.6, 7.5);
  let detailY = currentY + 11.5 + addressOffset + 1;

  const sellerGstin = data.seller.gstin || '27AAOCP3437H1Z4';
  doc.setFont('helvetica', 'bold');
  doc.text(`GST NO: ${sellerGstin}`, marginX + 3.5, detailY);
  detailY += 4.2;

  const sellerPhone = data.seller.phone || '7887858594';
  doc.setFont('helvetica', 'normal');
  doc.text(sellerPhone, marginX + 3.5, detailY);
  detailY += 4.2;

  const sellerEmail = data.seller.email || 'Info@pugarch.in';
  doc.setFont('helvetica', 'normal');
  doc.text(sellerEmail, marginX + 3.5, detailY);

  // Right Side: Dynamic Logo and CIN as per respective company
  const logoBoxWidth = 46;
  const logoBoxHeight = 17;
  const logoBoxX = rightX - logoBoxWidth - 3.5;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', logoBoxX, currentY + 3.5, logoBoxWidth, logoBoxHeight);
    } catch {
      // If image draw fails, show company name text
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12.5);
      doc.setTextColor(30, 58, 138);
      doc.text(data.seller.name || 'PugArch Technology Pvt Ltd', rightX - 3.5, currentY + 12, { align: 'right' });
    }
  } else if (data.seller.name) {
    // Elegant seller brand title if no logo uploaded
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(30, 58, 138);
    doc.text(data.seller.name, rightX - 3.5, currentY + 12, { align: 'right' });
  }

  // CIN Text below Logo
  const sellerCin = data.seller.cin || 'U62013MH2023PTC416118';
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`CIN : ${sellerCin}`, rightX - 3.5, currentY + 28, { align: 'right' });

  currentY += headerBoxHeight;

  // ─────────────────────────────────────────────────────────────
  // 2. TITLE BAR: Tax Invoice - [Copy Type]
  // ─────────────────────────────────────────────────────────────
  const copyTypeTitle = data.copyType ? `Tax Invoice - ${data.copyType}` : 'Tax Invoice - Original Copy';
  const titleBoxHeight = 8;
  doc.rect(marginX, currentY, contentWidth, titleBoxHeight);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(copyTypeTitle, midX, currentY + 5.5, { align: 'center' });

  currentY += titleBoxHeight;

  // ─────────────────────────────────────────────────────────────
  // 3. METADATA ROW: INV No & Date (left), Place of Supply (right)
  // ─────────────────────────────────────────────────────────────
  const metaBoxHeight = 11;
  doc.rect(marginX, currentY, contentWidth, metaBoxHeight);
  doc.line(midX - 10, currentY, midX - 10, currentY + metaBoxHeight);

  // Left Meta: Invoice No & Date
  doc.setFontSize(8.2);
  doc.setFont('helvetica', 'bold');
  doc.text(`INV No:${data.invoiceNumber || 'PUG2026I1404001'}`, marginX + 3.5, currentY + 4.5);
  doc.text(`Date: ${data.dateStr || '14-04-2026'}`, marginX + 3.5, currentY + 9);

  // Right Meta: Place Of Supply
  const posText = `Place Of Supply : ${data.placeOfSupply || 'Maharashtra(27)'}`;
  doc.text(posText, midX - 6.5, currentY + 6.5);

  currentY += metaBoxHeight;

  // ─────────────────────────────────────────────────────────────
  // 4. BILL TO & SHIP TO SECTION (2 Equal Columns with Divider)
  // ─────────────────────────────────────────────────────────────
  const billShipBoxHeight = 36;
  doc.rect(marginX, currentY, contentWidth, billShipBoxHeight);
  doc.line(midX - 10, currentY, midX - 10, currentY + billShipBoxHeight);

  // Left Column: Bill To
  let bY = currentY + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Bill To', marginX + 3.5, bY);
  bY += 4;
  doc.text(data.billTo.name || 'Rattan India Power Limited', marginX + 3.5, bY);
  bY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const billAddressLines = doc.splitTextToSize(
    data.billTo.address || 'Plot no. D-2 & D-2 (PART) , Additional Industrial area, MIDC\nNandgaon peth Amravati Maharashtra',
    (contentWidth / 2) - 18
  );
  doc.text(billAddressLines, marginX + 3.5, bY);
  bY += (billAddressLines.length * 3.4) + 1.2;

  const billPan = data.billTo.pan || 'AALCS2063D';
  doc.setFont('helvetica', 'bold');
  doc.text(`PAN No: ${billPan}`, marginX + 3.5, bY);
  bY += 3.8;

  const billGst = data.billTo.gstin || '27AALCS2063D1ZG';
  doc.setFont('helvetica', 'bold');
  doc.text(`GST No: ${billGst}`, marginX + 3.5, bY);

  // Right Column: Ship To
  let sY = currentY + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Ship To', midX - 6.5, sY);
  sY += 4;
  doc.text(data.shipTo.name || data.billTo.name || 'RattanIndia Power Limited', midX - 6.5, sY);
  sY += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const shipAddressLines = doc.splitTextToSize(
    data.shipTo.address || data.billTo.address || 'Amravati O&M Phase1, Amravati Thermal Power Plant, Phase I Plot no. D-2 & D-2 (PART), Additional Industrial area, MIDC, Nandgaon peth, Amravati 444901 AMRAVATI INDIA',
    (contentWidth / 2) + 4
  );
  doc.text(shipAddressLines, midX - 6.5, sY);

  currentY += billShipBoxHeight;

  // ─────────────────────────────────────────────────────────────
  // 5. ITEMS TABLE (Exact ERP Columns & Grid Lines)
  // ─────────────────────────────────────────────────────────────
  const tableData = data.items.map((item, idx) => [
    String(item.srNo || idx + 1),
    item.description || 'MSME Goods / Services Delivery',
    item.hsn || '84719000',
    item.qty ? `${item.qty}${item.unit ? ` ${item.unit}` : ''}` : '-',
    typeof item.priceUnit === 'number' ? formatInr(item.priceUnit) : (item.priceUnit || '-'),
    typeof item.amount === 'number' ? formatInr(item.amount) : (item.amount || '-')
  ]);

  // If table is short, add blank rows or pad to maintain aesthetic proportion
  const targetRows = Math.max(tableData.length, 3);
  while (tableData.length < targetRows) {
    tableData.push(['', '', '', '', '', '']);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { left: marginX, right: marginX },
    tableWidth: contentWidth,
    theme: 'grid',
    head: [['Sr. No.', 'Description', 'HSN', 'Qty', 'Price/Unit', 'Amount']],
    body: tableData,
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      lineColor: [30, 41, 59],
      lineWidth: 0.35
    },
    styles: {
      fontSize: 8,
      cellPadding: { top: 4, right: 3, bottom: 4, left: 3 },
      textColor: [15, 23, 42],
      lineColor: [30, 41, 59],
      lineWidth: 0.35,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 14, halign: 'center' },
      1: { cellWidth: 70, halign: 'left' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 30, halign: 'right' }
    }
  });

  currentY = (doc as any).lastAutoTable.finalY;

  // ─────────────────────────────────────────────────────────────
  // 6. SUBTOTAL & TAX CALCULATIONS (Integrated Rows)
  // ─────────────────────────────────────────────────────────────
  const calcRowHeight = 6.2;
  const drawCalcRow = (label: string, valueStr: string, isBold = false) => {
    doc.rect(marginX, currentY, contentWidth, calcRowHeight);
    doc.line(rightX - 30, currentY, rightX - 30, currentY + calcRowHeight);

    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text(label, rightX - 34, currentY + 4.5, { align: 'right' });
    doc.text(valueStr, rightX - 3.5, currentY + 4.5, { align: 'right' });
    currentY += calcRowHeight;
  };

  drawCalcRow('Sub Total', formatInr(data.subtotal));

  if (data.igstAmount && data.igstAmount > 0) {
    const rate = data.igstRate || 18;
    drawCalcRow(`IGST @ ${rate}%`, formatInr(data.igstAmount));
  } else {
    const cgstRate = data.cgstRate || 9;
    const sgstRate = data.sgstRate || 9;
    drawCalcRow(`CGST @ ${cgstRate}%`, formatInr(data.cgstAmount));
    drawCalcRow(`SGST @ ${sgstRate}%`, formatInr(data.sgstAmount));
  }

  if (data.otherTaxAmount && data.otherTaxAmount > 0) {
    drawCalcRow('Other Tax / Cess', formatInr(data.otherTaxAmount));
  }

  drawCalcRow('Total Amount', formatInr(data.totalAmount), true);

  // ─────────────────────────────────────────────────────────────
  // 7. FOOTER SECTION: Bank Details (left) & Stamp/Signature (right)
  // ─────────────────────────────────────────────────────────────
  const footerBoxHeight = 36;
  doc.rect(marginX, currentY, contentWidth, footerBoxHeight);
  doc.line(midX + 20, currentY, midX + 20, currentY + footerBoxHeight);

  // Left Side: Bank Details
  let bankY = currentY + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(15, 23, 42);
  doc.text('Bank Details:', marginX + 3.5, bankY);
  bankY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.text(`Bank Name: ${data.bankDetails.bankName || '-'}`, marginX + 3.5, bankY);
  bankY += 4.2;
  doc.text(`Bank Account No: ${data.bankDetails.accountNo || '-'}`, marginX + 3.5, bankY);
  bankY += 4.2;
  doc.text(`IFSC CODE: ${data.bankDetails.ifscCode || '-'}`, marginX + 3.5, bankY);
  bankY += 4.2;
  doc.text(`Account Name: ${data.bankDetails.accountName || data.seller.name || '-'}`, marginX + 3.5, bankY);

  // Right Side: Signatory Box (For [Seller Name], Optional Stamp & Sign, Authorized Signatory)
  const stampBoxX = midX + 22;
  const stampBoxWidth = rightX - stampBoxX;

  // Header "For [Company Name]"
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  const forSellerText = doc.splitTextToSize(`For ${data.seller.name || 'Seller Enterprise'}`, stampBoxWidth - 6);
  doc.text(forSellerText, rightX - 4, currentY + 5, { align: 'right' });

  // Render Official Stamp if provided
  if (stampDataUrl) {
    try {
      doc.addImage(stampDataUrl, 'PNG', stampBoxX + 8, currentY + 7, 24, 24);
    } catch {
      // ignore if image format not supported
    }
  }

  // Render Authorized Signature if provided
  if (signatureDataUrl) {
    try {
      doc.addImage(signatureDataUrl, 'PNG', rightX - 32, currentY + 16, 26, 12);
    } catch {
      // ignore if image format not supported
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Authorized Signatory', rightX - 4, currentY + footerBoxHeight - 3, { align: 'right' });

  return doc;
}
