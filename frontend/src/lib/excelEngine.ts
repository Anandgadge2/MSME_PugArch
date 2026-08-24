import ExcelJS from 'exceljs';
import { formatDateTime } from '../features/shared/format';

/**
 * Enterprise Excel Engine for MSME Procurement Portal
 * Generates properly formatted `.xlsx` reports.
 */

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  isCurrency?: boolean;
}

export interface ExcelDocumentConfig {
  documentTitle: string;
  documentNumber: string;
  dateStr: string;
  infoGrid?: Record<string, string>;
  columns: ExcelColumn[];
  data: any[];
  notes?: string[];
}

// Colors
const NAVY_BG = 'FF12335F';
const WHITE_TEXT = 'FFFFFFFF';
const LIGHT_BG = 'FFF8FAFC';
const ALT_ROW_BG = 'FFF1F5F9';

// Status Colors
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  DELIVERED: { bg: 'FFDCFCE7', text: 'FF166534' }, // Green
  APPROVED: { bg: 'FFDCFCE7', text: 'FF166534' },
  'ESCROW HELD': { bg: 'FFFEF3C7', text: 'FF92400E' }, // Amber
  PENDING: { bg: 'FFFFEDD5', text: 'FF9A3412' }, // Yellow/Orange
  'INVOICE SUBMITTED': { bg: 'FFDBEAFE', text: 'FF1E40AF' }, // Blue
  REJECTED: { bg: 'FFFEE2E2', text: 'FF991B1B' }, // Red
  CANCELLED: { bg: 'FFFEE2E2', text: 'FF991B1B' }, // Red
  FAILED: { bg: 'FFFEE2E2', text: 'FF991B1B' }, // Red
};

const getStatusColor = (status: string) => {
  const norm = String(status || '').toUpperCase();
  return STATUS_COLORS[norm] || { bg: 'FFF1F5F9', text: 'FF334155' }; // Default Slate
};

export class ExcelEngine {
  public async generate(config: ExcelDocumentConfig): Promise<Blob> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'JSG SMILE MSME Procurement';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Report', {
      views: [{ showGridLines: false }]
    });

    let currentRow = 1;

    // 1. TOP REPORT HEADER
    sheet.mergeCells(`A${currentRow}:L${currentRow + 1}`);
    const titleCell = sheet.getCell(`A${currentRow}`);
    titleCell.value = `JSG SMILE\nMSME Marketplace Portal\n\nPROCUREMENT / PURCHASE ORDER REPORT\nGenerated On: ${config.dateStr}`;
    titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE_TEXT } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_BG } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    currentRow += 3;

    // 2. SUMMARY SECTION
    if (config.infoGrid) {
      const keys = Object.keys(config.infoGrid);
      const vals = Object.values(config.infoGrid);

      keys.forEach((key, idx) => {
        const col = String.fromCharCode(65 + idx); // A, B, C...
        
        // Header
        const headerCell = sheet.getCell(`${col}${currentRow}`);
        headerCell.value = key;
        headerCell.font = { bold: true, color: { argb: 'FF1E293B' } };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        headerCell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        headerCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        // Value
        const valCell = sheet.getCell(`${col}${currentRow + 1}`);
        valCell.value = vals[idx];
        valCell.font = { color: { argb: 'FF334155' } };
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        valCell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
        valCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      });
      currentRow += 3;
    }

    // 3. DATA TABLE
    const tableStartRow = currentRow;

    // Configure Columns
    sheet.columns = config.columns.map(col => ({
      header: col.header,
      key: col.key,
      width: col.width || 15
    }));

    // Reset column headers to be at the correct row
    sheet.getRow(tableStartRow).values = config.columns.map(c => c.header);

    // Style Table Header
    const headerRow = sheet.getRow(tableStartRow);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: WHITE_TEXT } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY_BG } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'medium', color: { argb: NAVY_BG } },
        left: { style: 'thin', color: { argb: 'FF334155' } },
        bottom: { style: 'medium', color: { argb: NAVY_BG } },
        right: { style: 'thin', color: { argb: 'FF334155' } },
      };
    });

    currentRow++;

    // Add Data
    config.data.forEach((rowData, index) => {
      const row = sheet.getRow(currentRow);
      row.height = 25; // Comfortable height

      config.columns.forEach((col, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        const val = rowData[col.key];

        cell.value = val;
        
        // Currency Formatting
        if (col.isCurrency) {
          cell.numFmt = '[$₹-en-IN] #,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: true, indent: 1 };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: colIdx === 0 ? 'center' : 'left', wrapText: true, indent: 1 };
        }

        // Alternating row background
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: index % 2 === 0 ? WHITE_TEXT : ALT_ROW_BG } };

        // Status Colors
        if (col.key.toLowerCase().includes('status')) {
          const colors = getStatusColor(val as string);
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.bg } };
          cell.font = { color: { argb: colors.text }, bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }

        // Borders
        cell.border = {
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      currentRow++;
    });

    // Freeze table header row
    sheet.views = [
      { state: 'frozen', xSplit: 0, ySplit: tableStartRow, activeCell: 'A' + (tableStartRow + 1) }
    ];

    // Enable Autofilter
    sheet.autoFilter = {
      from: { row: tableStartRow, column: 1 },
      to: { row: tableStartRow, column: config.columns.length }
    };

    // 4. FOOTER
    currentRow += 2;
    const footerCell = sheet.getCell(`A${currentRow}`);
    footerCell.value = 'Notes / Remarks:\n• ' + (config.notes?.join('\n\n• ') || '');
    footerCell.font = { italic: true, color: { argb: 'FF64748B' }, size: 10 };
    footerCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    sheet.mergeCells(`A${currentRow}:L${currentRow + 3}`);

    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  public download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }
}
