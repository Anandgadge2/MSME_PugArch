import prisma from '../../lib/prisma.js';

export interface SapInvoiceExportRow {
  MANDT?: string;         // SAP Client (e.g., 100)
  BLDAT: string;          // Document Date (YYYYMMDD)
  BUDAT: string;          // Posting Date (YYYYMMDD)
  BLART: string;          // Document Type (RE = Invoice, KR = Vendor Invoice)
  BUKRS: string;          // Company Code
  WAERS: string;          // Currency (INR)
  XBLNR: string;          // Reference / Supplier Tax Invoice No
  BKTXT: string;          // Document Header Text (MSME Portal Verified)
  LIFNR: string;          // Vendor Account Number (ERP Vendor Code)
  WRBTR: string;          // Gross Amount in Document Currency
  WMWST: string;          // Tax Amount
  MWSKZ: string;          // Tax on sales/purchases code (e.g. S1 / GST18)
  EBELN: string;          // Purchase Order Number
  EBELP: string;          // PO Item Number (00010, 00020...)
  WERKS: string;          // Plant Code
  MENGE: string;          // Quantity
  MEINS: string;          // Base Unit of Measure
  TXZ01: string;          // Short Text / Description
  HSN: string;            // HSN / SAC Code
}

/**
 * Generate standard SAP MIRO / MIGO compatible CSV dataset for an Invoice / Purchase Order
 */
export async function generateSapInvoiceExport(invoiceId: number, buyerOrgId?: number): Promise<{
  csvContent: string;
  filename: string;
  summary: {
    invoiceNumber: string;
    poNumber: string;
    erpVendorCode: string;
    grandTotal: number;
    itemCount: number;
  };
}> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      purchaseOrder: {
        include: {
          items: true,
          seller: {
            include: {
              organization: true,
              sellerProfile: true
            }
          },
          buyer: {
            include: {
              organization: true
            }
          }
        }
      },
      items: true
    }
  });

  if (!invoice) {
    throw new Error(`Invoice #${invoiceId} not found`);
  }

  const po = invoice.purchaseOrder;
  if (!po) {
    throw new Error(`Purchase order for invoice #${invoiceId} not found`);
  }

  // Resolve ERP Vendor Code from PO, BuyerVendorAlias, or seller profile
  let erpVendorCode = po.erpVendorCode;
  const effectiveBuyerOrgId = buyerOrgId || po.buyer?.organizationId;
  const sellerOrgId = po.seller?.organizationId;

  if (!erpVendorCode && effectiveBuyerOrgId && sellerOrgId) {
    const alias = await prisma.buyerVendorAlias.findUnique({
      where: {
        buyerOrgId_sellerOrgId: {
          buyerOrgId: effectiveBuyerOrgId,
          sellerOrgId
        }
      }
    });
    if (alias) {
      erpVendorCode = alias.erpVendorCode;
    }
  }

  if (!erpVendorCode) {
    erpVendorCode = po.seller?.organization?.panNumber || po.seller?.organization?.gstin || `VEN-${po.sellerId}`;
  }

  const docDate = (invoice.createdAt || new Date()).toISOString().slice(0, 10).replace(/-/g, '');
  const postingDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const invoiceRef = invoice.invoiceNumber || `INV-${invoice.id}`;
  const poRef = po.externalPoNumber || po.poNumber;
  const headerText = `MSME-PORTAL-PO-${po.id}`;

  const rows: SapInvoiceExportRow[] = [];
  const lineItems = (invoice.items && invoice.items.length > 0)
    ? invoice.items
    : (po.items && po.items.length > 0)
    ? po.items.map((pi: any) => ({
        itemName: pi.itemName,
        quantity: pi.quantity,
        unitOfMeasure: pi.unitOfMeasure,
        unitPrice: pi.unitPrice,
        taxRate: pi.taxRate,
        totalAmount: pi.totalAmount,
        hsnCode: (pi as any).hsnCode || ''
      }))
    : [
        {
          itemName: po.title || 'Procurement Item',
          quantity: 1,
          unitOfMeasure: 'NOS',
          unitPrice: Number(invoice.amount || po.amount),
          taxRate: 18,
          totalAmount: Number(invoice.amount || po.amount),
          hsnCode: ''
        }
      ];

  lineItems.forEach((item: any, index: number) => {
    const itemNumber = String((index + 1) * 10).padStart(5, '0');
    const taxRate = Number(item.taxRate || 18);
    const taxCode = taxRate === 0 ? 'V0' : taxRate === 5 ? 'V1' : taxRate === 12 ? 'V2' : taxRate === 18 ? 'V3' : taxRate === 28 ? 'V4' : 'GST';
    const totalAmt = Number(item.totalAmount || (Number(item.quantity || 1) * Number(item.unitPrice || 0)));
    const taxableAmt = taxRate > 0 ? Math.round((totalAmt / (1 + taxRate / 100)) * 100) / 100 : totalAmt;
    const itemTax = Math.max(0, Math.round((totalAmt - taxableAmt) * 100) / 100);

    rows.push({
      BLDAT: docDate,
      BUDAT: postingDate,
      BLART: 'RE',
      BUKRS: '1000',
      WAERS: 'INR',
      XBLNR: invoiceRef,
      BKTXT: headerText,
      LIFNR: erpVendorCode || 'MSME_VENDOR',
      WRBTR: totalAmt.toFixed(2),
      WMWST: itemTax.toFixed(2),
      MWSKZ: taxCode,
      EBELN: poRef,
      EBELP: itemNumber,
      WERKS: '1001',
      MENGE: String(Number(item.quantity || 1)),
      MEINS: String(item.unitOfMeasure || 'NOS').toUpperCase(),
      TXZ01: String(item.itemName || 'Item').replace(/[\r\n,"]/g, ' ').slice(0, 40),
      HSN: String(item.hsnCode || '').trim()
    });
  });

  const headers = [
    'BLDAT (Doc Date)',
    'BUDAT (Posting Date)',
    'BLART (Doc Type)',
    'BUKRS (Co Code)',
    'WAERS (Currency)',
    'XBLNR (Invoice Ref)',
    'BKTXT (Header Text)',
    'LIFNR (Vendor Code)',
    'WRBTR (Gross Amount)',
    'WMWST (Tax Amount)',
    'MWSKZ (Tax Code)',
    'EBELN (PO Number)',
    'EBELP (PO Item)',
    'WERKS (Plant)',
    'MENGE (Quantity)',
    'MEINS (UoM)',
    'TXZ01 (Description)',
    'HSN (HSN/SAC Code)'
  ];

  const csvLines = [headers.join(',')];
  for (const row of rows) {
    const line = [
      row.BLDAT,
      row.BUDAT,
      row.BLART,
      row.BUKRS,
      row.WAERS,
      `"${row.XBLNR}"`,
      `"${row.BKTXT}"`,
      `"${row.LIFNR}"`,
      row.WRBTR,
      row.WMWST,
      row.MWSKZ,
      `"${row.EBELN}"`,
      row.EBELP,
      row.WERKS,
      row.MENGE,
      row.MEINS,
      `"${row.TXZ01}"`,
      `"${row.HSN}"`
    ].join(',');
    csvLines.push(line);
  }

  const csvContent = csvLines.join('\r\n');
  const filename = `SAP_MIRO_${invoiceRef}_${docDate}.csv`;

  return {
    csvContent,
    filename,
    summary: {
      invoiceNumber: invoiceRef,
      poNumber: poRef,
      erpVendorCode: erpVendorCode || 'MSME_VENDOR',
      grandTotal: Number(invoice.amount || po.amount),
      itemCount: rows.length
    }
  };
}
