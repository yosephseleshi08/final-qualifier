import * as XLSX from 'xlsx';
import type { UniversalRow, UniversalSheet, UniversalWorkbook } from '../types/audit';

const COMMON_HEADER_TOKENS = new Set([
  '#',
  'id',
  'lead_id',
  'lead',
  'name',
  'display_name',
  'lead_name',
  'business_name',
  'restaurant',
  'city',
  'state',
  'website',
  'url',
  'secondary_channel',
  'platformlink',
  'verdict',
  'status',
  'result',
  'proof_strength',
  'brand_anchor',
  'proven_fact',
  'target_trigger',
  'channel',
  'contact_value',
  'contact_flag',
  'batch',
  'prompt',
  'email',
  'phone',
  'claim',
  'evidence',
  'explanation',
  'reason',
  'notes',
  'note',
  'category',
  'tier',
  'priority',
]);

function normalizeToken(val: string): string {
  return String(val ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isUrlLike(val: string): boolean {
  const s = val.trim().toLowerCase();
  return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('www.');
}

function isNumericOnly(val: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(val.trim());
}

/**
 * Smart header row detection: scans up to the first 25 rows of a sheet,
 * skipping blank top rows or single-cell title banners, and scoring rows
 * by column count, identifier-like header syntax, and uniqueness.
 */
export function detectHeaderRowIndex(matrix: string[][]): number {
  const limit = Math.min(matrix.length, 25);
  let bestRow = -1;
  let bestScore = -Infinity;

  for (let r = 0; r < limit; r++) {
    const row = matrix[r] || [];
    const nonEmptyCells = row
      .map((cell) => String(cell ?? '').trim())
      .filter((cell) => cell.length > 0);

    if (nonEmptyCells.length === 0) continue;

    // Penalize single-cell title/banner rows when multi-column rows exist below
    if (nonEmptyCells.length === 1) {
      const hasWiderRowBelow = matrix
        .slice(r + 1, limit)
        .some((below) => (below || []).filter((c) => String(c ?? '').trim().length > 0).length >= 2);
      if (hasWiderRowBelow) continue;
    }

    let score = 0;
    const seen = new Set<string>();

    // Reward wider structured rows
    score += Math.min(nonEmptyCells.length, 25) * 3;

    for (const cell of nonEmptyCells) {
      const norm = normalizeToken(cell);

      if (seen.has(norm)) {
        score -= 4;
      } else {
        seen.add(norm);
        score += 1;
      }

      if (COMMON_HEADER_TOKENS.has(norm)) {
        score += 6;
      } else if (/^[a-z][a-z0-9_]{1,35}$/.test(norm)) {
        // snake_case / identifier header
        score += 4;
      } else if (cell.length <= 42 && !isUrlLike(cell) && !cell.includes('@') && !isNumericOnly(cell)) {
        score += 2;
      }

      if (isUrlLike(cell) || cell.includes('@')) {
        score -= 6;
      }
      if (cell.length > 75) {
        score -= 6;
      }
      if (isNumericOnly(cell) && norm !== '#') {
        score -= 4;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  if (bestRow !== -1) return bestRow;

  // Fallback to first non-empty row
  const firstNonEmpty = matrix.findIndex((row) =>
    (row || []).some((cell) => String(cell ?? '').trim().length > 0)
  );
  return firstNonEmpty === -1 ? 0 : firstNonEmpty;
}

function makeUniqueHeaders(rawHeaders: string[]): string[] {
  const counts = new Map<string, number>();
  return rawHeaders.map((raw, idx) => {
    const trimmed = String(raw ?? '').replace(/\r?\n/g, ' ').trim();
    const base = trimmed || `Column ${idx + 1}`;
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

function isRepeatedHeaderRow(row: string[], originalHeaders: string[]): boolean {
  if (originalHeaders.length < 2) return false;

  let comparableCols = 0;
  let exactMatches = 0;
  let mismatches = 0;

  for (let c = 0; c < originalHeaders.length; c++) {
    const headerNorm = normalizeToken(originalHeaders[c]);
    const cellNorm = normalizeToken(row[c] ?? '');
    if (!headerNorm) continue;
    comparableCols++;
    if (cellNorm === headerNorm) {
      exactMatches++;
    } else if (cellNorm !== '') {
      mismatches++;
    }
  }

  return (
    comparableCols >= 2 &&
    exactMatches >= Math.max(2, Math.ceil(comparableCols * 0.65)) &&
    mismatches === 0
  );
}

function formatCsvSheetName(fileName: string): string {
  const stripped = fileName.replace(/\.(csv|xlsx|xls|xlsm)$/i, '').trim();
  return stripped || 'Sheet1';
}

export async function parseUniversalFiles(files: File[]): Promise<UniversalWorkbook> {
  const sheets: UniversalSheet[] = [];
  const usedSheetNames = new Map<string, number>();

  const claimUniqueSheetName = (rawName: string): string => {
    const base = rawName.trim() || 'Sheet1';
    const count = usedSheetNames.get(base) || 0;
    usedSheetNames.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  };

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const isCsv = /\.csv$/i.test(file.name);

    for (const rawSheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[rawSheetName];
      if (!worksheet) continue;

      const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][];

      if (!matrix || matrix.length === 0) continue;

      const hasAnyContent = matrix.some((row) =>
        (row || []).some((cell) => String(cell ?? '').trim().length > 0)
      );
      if (!hasAnyContent) continue;

      const headerRowIndex = detectHeaderRowIndex(matrix);
      const rawHeaderRow = matrix[headerRowIndex] || [];

      // Find the rightmost column index that has content in header or any data row
      let maxColIdx = -1;
      for (let r = headerRowIndex; r < matrix.length; r++) {
        const row = matrix[r] || [];
        for (let c = row.length - 1; c > maxColIdx; c--) {
          if (String(row[c] ?? '').trim().length > 0) {
            maxColIdx = c;
            break;
          }
        }
      }

      if (maxColIdx < 0) continue;

      const slicedRawHeaders = Array.from({ length: maxColIdx + 1 }, (_, idx) =>
        String(rawHeaderRow[idx] ?? '')
      );
      const originalHeaders = makeUniqueHeaders(slicedRawHeaders);

      const hasPromptCol = originalHeaders.some(
        (h) => h.trim().toLowerCase() === 'prompt'
      );
      const columns = hasPromptCol ? originalHeaders : [...originalHeaders, 'Prompt'];

      const sheetName = claimUniqueSheetName(
        isCsv && workbook.SheetNames.length === 1
          ? formatCsvSheetName(file.name)
          : rawSheetName
      );

      const sheetId = `sheet_${sheets.length}_${Date.now()}`;
      const rows: UniversalRow[] = [];

      for (let r = headerRowIndex + 1; r < matrix.length; r++) {
        const row = matrix[r] || [];
        const slicedRow = Array.from({ length: originalHeaders.length }, (_, idx) =>
          String(row[idx] ?? '').replace(/\r\n/g, '\n').trim()
        );

        if (slicedRow.every((cell) => cell.length === 0)) continue;
        if (isRepeatedHeaderRow(slicedRow, originalHeaders)) continue;

        const cells: Record<string, string> = {};
        originalHeaders.forEach((header, idx) => {
          cells[header] = slicedRow[idx] ?? '';
        });

        if (!hasPromptCol) {
          cells['Prompt'] = '';
        }

        rows.push({
          id: `${sheetId}_row_${rows.length}_${r}`,
          cells,
        });
      }

      sheets.push({
        id: sheetId,
        name: sheetName,
        columns,
        promptInjected: !hasPromptCol,
        rows,
      });
    }
  }

  const displayFileName =
    files.length === 1
      ? files[0].name
      : `${files.length} files (${files.map((f) => f.name).join(', ')})`;

  const now = new Date().toISOString();
  return {
    fileName: displayFileName,
    loadedAt: now,
    updatedAt: now,
    sheets,
  };
}
