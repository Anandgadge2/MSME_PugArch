import React from 'react';
import { formatCurrency, formatDate } from '../../shared/format';

export interface TaxInvoiceCardProps {
  copyType: string;
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
  items: Array<{
    srNo: number | string;
    description: string;
    hsn: string;
    qty: number | string;
    unit?: string;
    priceUnit: number | string;
    amount: number | string;
  }>;
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
  logoUrl?: string | null;
  stampUrl?: string | null;
  signatureUrl?: string | null;
  onOpenUploadBranding?: () => void;
}

export function TaxInvoiceCard({
  copyType,
  invoiceNumber,
  dateStr,
  placeOfSupply = 'Maharashtra(27)',
  seller,
  billTo,
  shipTo,
  items,
  subtotal,
  cgstRate = 9,
  cgstAmount,
  sgstRate = 9,
  sgstAmount,
  igstRate = 18,
  igstAmount,
  otherTaxAmount,
  totalAmount,
  bankDetails,
  logoUrl = null,
  stampUrl = null,
  signatureUrl = null,
  onOpenUploadBranding
}: TaxInvoiceCardProps) {
  const displayItems = items.length > 0 ? items : [
    {
      srNo: 1,
      description: 'MSME Goods / Services Delivery',
      hsn: '84719000',
      qty: 1,
      priceUnit: subtotal || totalAmount,
      amount: subtotal || totalAmount
    }
  ];

  const formatNumber = (val: number | string | undefined | null) => {
    const num = Number(val || 0);
    if (!Number.isFinite(num) || num === 0) return '-';
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white border-2 border-slate-900 shadow-xl text-slate-950 font-sans text-xs selection:bg-slate-200">
      {/* 1. TOP HEADER BOX: Seller details (left) & Logo + CIN (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 p-4 border-b-2 border-slate-900 gap-4 items-start">
        {/* Left: Seller Information */}
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-950 tracking-tight">
            {seller.name || 'PugArch Technology Pvt Ltd'}
          </h2>
          <p className="text-xs text-slate-800 leading-tight font-medium max-w-md whitespace-pre-line">
            {seller.address || 'L-18,Laxman Nagar,Manewada,Nagpur,440034'}
          </p>
          <p className="text-xs font-bold text-slate-900">
            GST NO: <span className="font-mono">{seller.gstin || '27AAOCP3437H1Z4'}</span>
          </p>
          <p className="text-xs font-semibold text-slate-800">{seller.phone || '7887858594'}</p>
          <p className="text-xs font-semibold text-slate-800">{seller.email || 'Info@pugarch.in'}</p>
        </div>

        {/* Right: Company Logo & CIN */}
        <div className="flex flex-col items-start md:items-end justify-between h-full space-y-2">
          <div className="group relative flex items-center justify-end">
            {logoUrl ? (
              <div className="h-16 w-52 max-w-[220px] flex items-center justify-end">
                <img
                  src={logoUrl}
                  alt={`${seller.name || 'Company'} Logo`}
                  className="max-h-16 max-w-full object-contain cursor-pointer transition-transform hover:scale-105"
                  onClick={onOpenUploadBranding}
                  title="Click to change logo"
                />
              </div>
            ) : (
              <div 
                onClick={onOpenUploadBranding}
                className="cursor-pointer border border-dashed border-slate-300 hover:border-[#12335f] bg-slate-50 hover:bg-slate-100/80 px-3.5 py-2 rounded-lg flex items-center gap-2 transition"
                title="Click to upload company logo"
              >
                <div className="h-7 w-7 rounded bg-[#12335f]/10 text-[#12335f] flex items-center justify-center font-black text-sm">
                  {(seller.name || 'C').charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {seller.name || 'Upload Logo'}
                </span>
              </div>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-900 tracking-wide font-mono mt-1">
            CIN : {seller.cin || 'U62013MH2023PTC416118'}
          </p>
        </div>
      </div>

      {/* 2. TITLE BAR: Tax Invoice - [Copy Type] */}
      <div className="py-2.5 px-4 text-center border-b-2 border-slate-900 bg-white">
        <h1 className="text-sm md:text-base font-black text-slate-950 uppercase tracking-wide">
          Tax Invoice - {copyType || 'Original Copy'}
        </h1>
      </div>

      {/* 3. METADATA ROW: INV No, Date (left), Place Of Supply (right) */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b-2 border-slate-900">
        <div className="p-2.5 px-4 border-b md:border-b-0 md:border-r-2 border-slate-900 space-y-0.5">
          <p className="font-bold text-xs">
            INV No: <span className="font-mono font-black">{invoiceNumber || 'PUG2026I1404001'}</span>
          </p>
          <p className="font-bold text-xs">
            Date: <span className="font-semibold">{dateStr || '14-04-2026'}</span>
          </p>
        </div>
        <div className="p-2.5 px-4 flex items-center">
          <p className="font-bold text-xs">
            Place Of Supply : <span className="font-semibold">{placeOfSupply || 'Maharashtra(27)'}</span>
          </p>
        </div>
      </div>

      {/* 4. BILL TO & SHIP TO SECTION (2 Equal Columns with Divider) */}
      <div className="grid grid-cols-1 md:grid-cols-2 border-b-2 border-slate-900">
        {/* Left Column: Bill To */}
        <div className="p-3.5 px-4 border-b md:border-b-0 md:border-r-2 border-slate-900 space-y-1.5">
          <p className="font-black text-xs uppercase tracking-wider text-slate-950 underline decoration-slate-400 underline-offset-2">
            Bill To
          </p>
          <p className="font-black text-xs text-slate-900">{billTo.name || 'Rattan India Power Limited'}</p>
          <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-line">
            {billTo.address || 'Plot no. D-2 & D-2 (PART) , Additional Industrial area, MIDC\nNandgaon peth Amravati Maharashtra'}
          </p>
          <p className="text-[11px] font-bold text-slate-900">
            PAN No: <span className="font-mono font-semibold">{billTo.pan || 'AALCS2063D'}</span>
          </p>
          <p className="text-[11px] font-bold text-slate-900">
            GST No: <span className="font-mono font-semibold">{billTo.gstin || '27AALCS2063D1ZG'}</span>
          </p>
        </div>

        {/* Right Column: Ship To */}
        <div className="p-3.5 px-4 space-y-1.5">
          <p className="font-black text-xs uppercase tracking-wider text-slate-950 underline decoration-slate-400 underline-offset-2">
            Ship To
          </p>
          <p className="font-black text-xs text-slate-900">{shipTo.name || billTo.name || 'RattanIndia Power Limited'}</p>
          <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-line">
            {shipTo.address || billTo.address || 'Amravati O&M Phase1\nAmravati Thermal Power Plant, Phase I Plot no. D-2 & D-2 (PART), Additional Industrial area, MIDC\nNandgaon peth, Amravati 444901 AMRAVATI INDIA'}
          </p>
        </div>
      </div>

      {/* 5. ITEM DETAILS TABLE */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-900 bg-slate-50/50 text-[11px] font-black text-slate-950">
              <th className="p-2.5 text-center border-r-2 border-slate-900 w-12">Sr. No.</th>
              <th className="p-2.5 border-r-2 border-slate-900">Description</th>
              <th className="p-2.5 text-center border-r-2 border-slate-900 w-24">HSN</th>
              <th className="p-2.5 text-center border-r-2 border-slate-900 w-16">Qty</th>
              <th className="p-2.5 text-right border-r-2 border-slate-900 w-28">Price/Unit</th>
              <th className="p-2.5 text-right w-32">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-300">
            {displayItems.map((item, idx) => (
              <tr key={idx} className="min-h-[48px] text-xs">
                <td className="p-3 text-center font-bold border-r-2 border-slate-900 align-top">
                  {item.srNo || idx + 1}
                </td>
                <td className="p-3 border-r-2 border-slate-900 align-top">
                  <p className="font-black text-slate-900">{item.description}</p>
                </td>
                <td className="p-3 text-center font-mono font-bold text-slate-800 border-r-2 border-slate-900 align-top">
                  {item.hsn || '84719000'}
                </td>
                <td className="p-3 text-center font-bold border-r-2 border-slate-900 align-top">
                  {item.qty ? `${item.qty}${item.unit ? ` ${item.unit}` : ''}` : '-'}
                </td>
                <td className="p-3 text-right font-mono font-bold border-r-2 border-slate-900 align-top">
                  {formatNumber(item.priceUnit)}
                </td>
                <td className="p-3 text-right font-mono font-bold align-top">
                  {formatNumber(item.amount)}
                </td>
              </tr>
            ))}

            {/* Empty space filler rows if item count is low */}
            {displayItems.length === 1 && (
              <tr className="h-16">
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td className="border-r-2 border-slate-900"></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 6. SUBTOTAL & TAX CALCULATIONS (Full Width Integrated Table Rows) */}
      <div className="border-t-2 border-slate-900">
        <div className="flex justify-end border-b border-slate-900">
          <div className="w-full md:w-80 flex">
            <div className="flex-1 p-2 px-3 text-right font-bold text-xs border-r-2 border-slate-900">
              Sub Total
            </div>
            <div className="w-32 p-2 px-3 text-right font-mono font-bold text-xs">
              {formatNumber(subtotal)}
            </div>
          </div>
        </div>

        {igstAmount && igstAmount > 0 ? (
          <div className="flex justify-end border-b border-slate-900">
            <div className="w-full md:w-80 flex">
              <div className="flex-1 p-2 px-3 text-right font-bold text-xs border-r-2 border-slate-900">
                IGST @ {igstRate || 18} %
              </div>
              <div className="w-32 p-2 px-3 text-right font-mono font-bold text-xs">
                {formatNumber(igstAmount)}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end border-b border-slate-900">
              <div className="w-full md:w-80 flex">
                <div className="flex-1 p-2 px-3 text-right font-bold text-xs border-r-2 border-slate-900">
                  CGST @ {cgstRate || 9} %
                </div>
                <div className="w-32 p-2 px-3 text-right font-mono font-bold text-xs">
                  {formatNumber(cgstAmount)}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-b border-slate-900">
              <div className="w-full md:w-80 flex">
                <div className="flex-1 p-2 px-3 text-right font-bold text-xs border-r-2 border-slate-900">
                  SGST @ {sgstRate || 9} %
                </div>
                <div className="w-32 p-2 px-3 text-right font-mono font-bold text-xs">
                  {formatNumber(sgstAmount)}
                </div>
              </div>
            </div>
          </>
        )}

        {otherTaxAmount && otherTaxAmount > 0 && (
          <div className="flex justify-end border-b border-slate-900">
            <div className="w-full md:w-80 flex">
              <div className="flex-1 p-2 px-3 text-right font-bold text-xs border-r-2 border-slate-900">
                Other Tax / Cess
              </div>
              <div className="w-32 p-2 px-3 text-right font-mono font-bold text-xs">
                {formatNumber(otherTaxAmount)}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end border-b-2 border-slate-900 bg-slate-50/50">
          <div className="w-full md:w-80 flex">
            <div className="flex-1 p-2.5 px-3 text-right font-black text-xs border-r-2 border-slate-900">
              Total Amount
            </div>
            <div className="w-32 p-2.5 px-3 text-right font-mono font-black text-xs text-slate-950">
              {formatNumber(totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* 7. FOOTER SECTION: Bank Details (Left) & Stamp / Signature (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left Side: Bank Details */}
        <div className="p-4 border-b md:border-b-0 md:border-r-2 border-slate-900 space-y-1">
          <p className="font-black text-xs uppercase tracking-wider text-slate-950 underline decoration-slate-400 underline-offset-2 mb-2">
            Bank Details:
          </p>
          <p className="text-xs">
            <span className="font-bold">Bank Name: </span>
            <span className="font-semibold text-slate-800">{bankDetails.bankName || '-'}</span>
          </p>
          <p className="text-xs">
            <span className="font-bold">Bank Account No: </span>
            <span className="font-mono font-semibold text-slate-800">{bankDetails.accountNo || '-'}</span>
          </p>
          <p className="text-xs">
            <span className="font-bold">IFSC CODE: </span>
            <span className="font-mono font-semibold text-slate-800">{bankDetails.ifscCode || '-'}</span>
          </p>
          <p className="text-xs">
            <span className="font-bold">Account Name: </span>
            <span className="font-semibold text-slate-800">{bankDetails.accountName || seller.name || '-'}</span>
          </p>
        </div>

        {/* Right Side: Stamp & Signature */}
        <div className="p-4 flex flex-col items-end justify-between min-h-[125px] relative">
          <p className="text-[11px] font-bold text-slate-900 text-right w-full">
            For <span className="font-black">{seller.name || 'Seller Enterprise'}</span>
          </p>

          <div
            onClick={onOpenUploadBranding}
            className="group relative my-auto flex items-center justify-center min-h-[64px] min-w-[140px] px-3 py-1 rounded-xl hover:bg-slate-50 transition cursor-pointer border border-dashed border-transparent hover:border-slate-300"
            title="Click to configure stamp and signature"
          >
            {stampUrl && (
              <img
                src={stampUrl}
                alt="Authorized Stamp"
                className="h-16 w-16 object-contain transition-transform group-hover:scale-105"
              />
            )}
            {signatureUrl && (
              <img
                src={signatureUrl}
                alt="Authorized Signature"
                className={stampUrl ? "absolute h-10 w-auto object-contain mix-blend-multiply" : "h-10 w-auto object-contain"}
              />
            )}
            {!stampUrl && !signatureUrl && (
              <div className="text-center py-2 text-slate-400 group-hover:text-slate-600 transition">
                <span className="text-[10px] font-bold block">+ Optional Stamp / Sign</span>
                <span className="text-[8px] text-slate-400">Click to upload or leave blank</span>
              </div>
            )}
            <div className="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/5 rounded-xl transition flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 text-[9px] font-black uppercase tracking-wider bg-white/95 px-2 py-0.5 rounded shadow-sm text-[#12335f] transition">
                {stampUrl || signatureUrl ? 'Change Stamp / Sign' : 'Upload Stamp / Sign'}
              </span>
            </div>
          </div>

          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider mt-1 text-right w-full">
            Authorized Signatory
          </p>
        </div>
      </div>
    </div>
  );
}
