import ExcelJS from 'exceljs';
import type { UniversalSheet, UniversalWorkbook } from '../types/audit';
import {
  findPrimaryNameColumn,
  getStatusTone,
  isLongTextColumnName,
  isPromptColumn,
  isStatusColumnName,
} from './cellHelpers';

function sanitizeExcelSheetName(name: string, usedNames: Set<string>): string {
  // Excel forbids : \ / ? * [ ] and limits tab names to 31 characters
  let cleaned = name.replace(/[:\\/?*[\]]/g, '-').trim();
  if (!cleaned) cleaned = 'Sheet';
  if (cleaned.length > 31) {
    cleaned = cleaned.slice(0, 31).trim();
  }

  let candidate = cleaned;
  let counter = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const suffix = ` (${counter})`;
    const baseLen = Math.max(1, 31 - suffix.length);
    candidate = `${cleaned.slice(0, baseLen).trim()}${suffix}`;
    counter++;
  }

  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function getColumnWidthBounds(colName: string): { min: number; max: number } {
  const norm = colName.trim().toLowerCase();
  if (norm === '#' || norm === 'id' || norm === 'lead_id' || norm === 'state') {
    return { min: 10, max: 18 };
  }
  if (isPromptColumn(colName)) {
    return { min: 34, max: 54 };
  }
  if (isLongTextColumnName(colName)) {
    return { min: 28, max: 52 };
  }
  if (isStatusColumnName(colName)) {
    return { min: 15, max: 24 };
  }
  return { min: 16, max: 36 };
}

function populateUniversalSheet(
  workbook: ExcelJS.Workbook,
  sheetData: UniversalSheet,
  tabName: string
) {
  const sheet = workbook.addWorksheet(tabName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const columns = sheetData.columns;
  const primaryCol = findPrimaryNameColumn(columns);
  const primaryColIndex = primaryCol ? columns.indexOf(primaryCol) : -1;

  const headerRow = sheet.addRow(columns);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E293B' } },
      bottom: { style: 'medium', color: { argb: 'FF10B981' } },
      left: { style: 'thin', color: { argb: 'FF1E293B' } },
      right: { style: 'thin', color: { argb: 'FF1E293B' } },
    };
  });

  const colBounds = columns.map((c) => getColumnWidthBounds(c));
  const maxLengths = columns.map((h) => h.length + 4);

  sheetData.rows.forEach((row, rowIdx) => {
    const values = columns.map((col) => row.cells[col] ?? '');
    const excelRow = sheet.addRow(values);
    const isEven = rowIdx % 2 === 1;

    let maxLines = 1;
    values.forEach((val, colIdx) => {
      const text = String(val ?? '');
      const targetWrapWidth = Math.max(14, colBounds[colIdx].max - 4);
      const lines = text.split('\n').reduce((acc, part) => {
        return acc + Math.max(1, Math.ceil(part.length / targetWrapWidth));
      }, 0);
      if (lines > maxLines) maxLines = lines;

      const longestLine = Math.max(...text.split('\n').map((l) => l.length), 0);
      if (longestLine + 3 > maxLengths[colIdx]) {
        maxLengths[colIdx] = longestLine + 3;
      }
    });

    excelRow.height = Math.min(180, Math.max(22, maxLines * 14 + 8));

    excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const colIdx = colNumber - 1;
      const colName = columns[colIdx] ?? '';
      const rawVal = String(values[colIdx] ?? '');

      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: colIdx === primaryColIndex,
        color: { argb: 'FF0F172A' },
      };
      cell.alignment = {
        vertical: 'top',
        horizontal: 'left',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      if (isStatusColumnName(colName) && rawVal.trim()) {
        const tone = getStatusTone(rawVal);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: tone.excelFill },
        };
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: tone.excelFont },
        };
        cell.alignment = {
          vertical: 'top',
          horizontal: 'center',
          wrapText: true,
        };
      } else if (isEven) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' },
        };
      }
    });
  });

  if (columns.length > 0) {
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheetData.rows.length + 1), column: columns.length },
    };

    sheet.columns = columns.map((_, idx) => ({
      width: Math.max(
        colBounds[idx].min,
        Math.min(colBounds[idx].max, maxLengths[idx])
      ),
    }));
  }
}

export async function exportUniversalWorkbook(
  workbookData: UniversalWorkbook
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ridge Creative Lead Auditor';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  const usedNames = new Set<string>();
  for (const sheet of workbookData.sheets) {
    const safeName = sanitizeExcelSheetName(sheet.name, usedNames);
    populateUniversalSheet(workbook, sheet, safeName);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'edited_lead_audit.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
