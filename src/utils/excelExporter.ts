import ExcelJS from 'exceljs';
import type { ConsolidatedLead, ConsolidationOutput } from '../types/audit';

const HEADERS = [
  'Name',
  'URL',
  'Destination',
  'Claim (verbatim)',
  'Result Explanation',
  'Corrected Prompt',
];

function populateDataSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: ConsolidatedLead[],
  statusColors: { fill: string; font: string }
) {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  const headerRow = sheet.addRow(HEADERS);
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

  const maxLengths = HEADERS.map((h) => h.length + 4);

  rows.forEach((item, idx) => {
    const values = [
      item.name,
      item.url,
      item.destination,
      item.claimVerbatim,
      item.resultExplanation,
      item.correctedPrompt ?? '',
    ];

    const dataRow = sheet.addRow(values);
    const isEven = idx % 2 === 1;

    let maxLines = 1;
    values.forEach((val, colIdx) => {
      const text = String(val ?? '');
      const colMaxWidth = [28, 34, 18, 46, 54, 42][colIdx] || 30;
      const lines = text.split('\n').reduce((acc, part) => {
        return acc + Math.max(1, Math.ceil(part.length / Math.max(10, colMaxWidth - 3)));
      }, 0);
      if (lines > maxLines) maxLines = lines;

      const longestLine = Math.max(...text.split('\n').map((l) => l.length), 0);
      if (longestLine + 3 > maxLengths[colIdx]) {
        maxLengths[colIdx] = longestLine + 3;
      }
    });

    dataRow.height = Math.min(200, Math.max(22, maxLines * 15 + 8));

    dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
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

      if (colNumber === 3) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: statusColors.fill },
        };
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: statusColors.font },
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

      if (colNumber === 1) {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FF0F172A' },
        };
      }
    });
  });

  // Excel Dropdown Data Validation on Column C (Destination)
  const validationEndRow = Math.max(rows.length + 250, 500);
  for (let r = 2; r <= validationEndRow; r++) {
    sheet.getCell(`C${r}`).dataValidation = {
      type: 'list',
      allowBlank: false,
      formulae: ['"Confirmed,Cannot Verify,Refuted,No Need Result"'],
      showErrorMessage: true,
      errorStyle: 'warning',
      errorTitle: 'Invalid Destination',
      error: 'Select Confirmed, Cannot Verify, Refuted, or No Need Result.',
    };
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, rows.length + 1), column: HEADERS.length },
  };

  const minWidths = [24, 28, 18, 38, 44, 34];
  const maxWidths = [36, 44, 22, 56, 64, 48];
  sheet.columns = HEADERS.map((_, i) => ({
    width: Math.max(minWidths[i], Math.min(maxWidths[i], maxLengths[i])),
  }));
}

function populateSummarySheet(
  workbook: ExcelJS.Workbook,
  output: ConsolidationOutput
) {
  const sheet = workbook.addWorksheet('Summary', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const titleRow = sheet.addRow(['Restaurant Lead Audit Consolidator — Final Output']);
  titleRow.height = 30;
  sheet.mergeCells('A1:E1');
  const titleCell = titleRow.getCell(1);
  titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  const metaRow = sheet.addRow([
    `Source file: ${output.fileName}  |  Raw rows parsed: ${output.totalRawRows}  |  Duplicates merged: ${output.duplicatesRemoved}`,
  ]);
  metaRow.height = 22;
  sheet.mergeCells('A2:E2');
  metaRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF475569' } };
  metaRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  sheet.addRow([]);

  const tblHeader = sheet.addRow([
    'Destination Tab',
    'Unique Leads (COUNTA)',
    'Share of Total',
    'Priority Level',
    'Deduplication & Classification Rule',
  ]);
  tblHeader.height = 26;
  tblHeader.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 2 || col === 3 ? 'right' : 'left',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF10B981' } },
    };
  });

  const confirmedEnd = Math.max(2, output.confirmed.length + 1000);
  const cannotEnd = Math.max(2, output.cannotVerify.length + 1000);
  const refutedEnd = Math.max(2, output.refuted.length + 1000);
  const noNeedEnd = Math.max(2, output.noNeedResult.length + 1000);

  const summaryDefinitions = [
    {
      label: 'Confirmed',
      countaFormula: `COUNTA(Confirmed!A2:A${confirmedEnd})`,
      shareFormula: 'B5/$B$9',
      priority: 'Priority 1 (Highest)',
      rule: 'CONFIRMED in A1–A3 or B Phone Check, OR LISTED - INFLATED in C Marketplace. Excludes lead from all lower tabs.',
      fill: 'FFDCFCE7',
      font: 'FF166534',
      resultCount: output.confirmed.length,
    },
    {
      label: 'Cannot Verify',
      countaFormula: `COUNTA('Cannot Verify'!A2:A${cannotEnd})`,
      shareFormula: 'B6/$B$9',
      priority: 'Priority 2 (Beats Refuted)',
      rule: 'CANNOT VERIFY in A1–A3 or blank/unverified status in B Phone Check (when not in Priority 1).',
      fill: 'FFFEF3C7',
      font: 'FF92400E',
      resultCount: output.cannotVerify.length,
    },
    {
      label: 'Refuted',
      countaFormula: `COUNTA(Refuted!A2:A${refutedEnd})`,
      shareFormula: 'B7/$B$9',
      priority: 'Priority 3',
      rule: 'REFUTED in A1–A3, CONFIGURATION in B Phone Check, or LISTED - FAIR PRICES / NOT LISTED in C Marketplace (with no Priority 1 or 2 match).',
      fill: 'FFFEE2E2',
      font: 'FF991B1B',
      resultCount: output.refuted.length,
    },
    {
      label: 'No Need Result',
      countaFormula: `COUNTA('No Need Result'!A2:A${noNeedEnd})`,
      shareFormula: 'B8/$B$9',
      priority: 'Priority 4',
      rule: 'Rows from Table D (rewrite / no verify) or tabs without a Result column not already captured in Priorities 1–3.',
      fill: 'FFE0F2FE',
      font: 'FF075985',
      resultCount: output.noNeedResult.length,
    },
  ];

  summaryDefinitions.forEach((def) => {
    const r = sheet.addRow([
      def.label,
      { formula: def.countaFormula, result: def.resultCount },
      {
        formula: def.shareFormula,
        result: output.totalUniqueLeads > 0 ? def.resultCount / output.totalUniqueLeads : 0,
      },
      def.priority,
      def.rule,
    ]);
    r.height = 30;
    r.eachCell((cell, col) => {
      cell.alignment = {
        vertical: 'middle',
        horizontal: col === 2 || col === 3 ? 'right' : 'left',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      if (col === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: def.fill } };
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: def.font } };
      } else {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: col === 2,
          color: { argb: 'FF0F172A' },
        };
      }
      if (col === 2) cell.numFmt = '#,##0';
      if (col === 3) cell.numFmt = '0.0%';
    });
  });

  const totalRow = sheet.addRow([
    'Total Unique Leads',
    { formula: 'SUM(B5:B8)', result: output.totalUniqueLeads },
    { formula: 'SUM(C5:C8)', result: output.totalUniqueLeads > 0 ? 1 : 0 },
    '—',
    'Zero duplication enforced across Confirmed, Cannot Verify, Refuted, and No Need Result.',
  ]);
  totalRow.height = 26;
  totalRow.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 2 || col === 3 ? 'right' : 'left',
      wrapText: true,
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    };
    if (col === 2) cell.numFmt = '#,##0';
    if (col === 3) cell.numFmt = '0.0%';
  });

  sheet.addRow([]);

  const srcTitle = sheet.addRow(['Source Sheet Breakdown (Pre-Deduplication)']);
  srcTitle.height = 24;
  srcTitle.getCell(1).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  const srcHeader = sheet.addRow([
    'Source Sheet',
    'Total Rows',
    'Confirmed / Inflated',
    'Cannot Verify / Blank',
    'Refuted / Config / Fair',
  ]);
  srcHeader.height = 24;
  srcHeader.eachCell((cell, col) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col === 1 ? 'left' : 'right',
    };
  });

  const srcStartRow = sheet.rowCount + 1;
  output.sheetBreakdowns.forEach((b) => {
    const row = sheet.addRow([
      b.sheetName,
      b.totalRows,
      b.confirmedRows,
      b.cannotVerifyRows,
      b.refutedRows,
    ]);
    row.height = 20;
    row.eachCell((cell, col) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (col > 1) cell.numFmt = '#,##0';
    });
  });
  const srcEndRow = sheet.rowCount;

  if (output.sheetBreakdowns.length > 0) {
    const srcTotalRow = sheet.addRow([
      'Total Raw Rows Across Sheets',
      { formula: `SUM(B${srcStartRow}:B${srcEndRow})`, result: output.totalRawRows },
      {
        formula: `SUM(C${srcStartRow}:C${srcEndRow})`,
        result: output.sheetBreakdowns.reduce((a, b) => a + b.confirmedRows, 0),
      },
      {
        formula: `SUM(D${srcStartRow}:D${srcEndRow})`,
        result: output.sheetBreakdowns.reduce((a, b) => a + b.cannotVerifyRows, 0),
      },
      {
        formula: `SUM(E${srcStartRow}:E${srcEndRow})`,
        result: output.sheetBreakdowns.reduce((a, b) => a + b.refutedRows, 0),
      },
    ]);
    srcTotalRow.height = 22;
    srcTotalRow.eachCell((cell, col) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'right' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF0F172A' } },
      };
      if (col > 1) cell.numFmt = '#,##0';
    });
  }

  sheet.columns = [
    { width: 26 },
    { width: 22 },
    { width: 18 },
    { width: 26 },
    { width: 68 },
  ];
}

export async function exportConsolidatedWorkbook(output: ConsolidationOutput): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Restaurant Lead Audit Consolidator';
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  // 1. Summary tab (with live dynamic COUNTA formulas on Column A of each tab)
  populateSummarySheet(workbook, output);

  // 2. Confirmed tab
  populateDataSheet(workbook, 'Confirmed', output.confirmed, {
    fill: 'FFDCFCE7',
    font: 'FF166534',
  });

  // 3. Cannot Verify tab
  populateDataSheet(workbook, 'Cannot Verify', output.cannotVerify, {
    fill: 'FFFEF3C7',
    font: 'FF92400E',
  });

  // 4. Refuted tab
  populateDataSheet(workbook, 'Refuted', output.refuted, {
    fill: 'FFFEE2E2',
    font: 'FF991B1B',
  });

  // 5. No Need Result tab
  populateDataSheet(workbook, 'No Need Result', output.noNeedResult, {
    fill: 'FFE0F2FE',
    font: 'FF075985',
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'final_clean_audit_tracker.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
