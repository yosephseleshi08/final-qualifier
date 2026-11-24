import * as XLSX from 'xlsx';
import type { ColumnMapping, ParsedSheet, RawSheetRow, SheetCategory } from '../types/audit';

export function classifySheetName(name: string): SheetCategory {
  const lower = name.toLowerCase().trim();
  if (lower.includes('summary') || lower.includes('instruction') || lower.includes('readme')) {
    return 'SUMMARY';
  }
  if (/\ba1\b/.test(lower) || lower.includes('a1 high') || lower.startsWith('a1')) return 'A1';
  if (/\ba2\b/.test(lower) || lower.includes('a2 partial') || lower.startsWith('a2')) return 'A2';
  if (/\ba3\b/.test(lower) || lower.includes('a3 low') || lower.startsWith('a3')) return 'A3';
  if (/\bb\b/.test(lower) || lower.includes('phone')) return 'B';
  if (/\bc\b/.test(lower) || lower.includes('marketplace')) return 'C';
  if (lower.includes('table d') || /\bd\b/.test(lower) || lower.includes('rewrite') || lower.includes('no verify')) {
    return 'D';
  }
  return 'OTHER';
}

function normalizeHeader(h: string): string {
  return String(h || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectHeaderRowIndex(matrix: string[][]): number {
  const headerTokens = [
    '#',
    'lead',
    'restaurant',
    'business',
    'name',
    'result',
    'status',
    'verdict',
    'claim',
    'apps to search',
    'question',
    'url',
    'social',
    'pitch',
    'angle',
    'explanation',
    'evidence',
    'reason',
    'ai result',
  ];

  let bestRow = 0;
  let bestScore = -1;

  const limit = Math.min(matrix.length, 15);
  for (let r = 0; r < limit; r++) {
    const row = matrix[r] || [];
    let score = 0;
    const nonEmpty = row.filter((c) => String(c || '').trim().length > 0);
    if (nonEmpty.length < 2) continue;

    for (const cell of nonEmpty) {
      const norm = normalizeHeader(cell);
      if (norm === '#' || norm === 'lead' || norm === 'restaurant' || norm === 'result' || norm === 'name') {
        score += 4;
      } else if (headerTokens.some((t) => norm === t || norm.includes(t))) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
  }

  return bestRow;
}

function findBestHeader(
  headers: string[],
  exactPriority: string[],
  includesPriority: string[],
  excludeTerms: string[] = []
): string | null {
  const cleaned = headers.map((h) => ({ raw: h, norm: normalizeHeader(h) })).filter((h) => h.norm);

  for (const target of exactPriority) {
    const found = cleaned.find((h) => h.norm === target);
    if (found) return found.raw;
  }

  for (const target of includesPriority) {
    const found = cleaned.find(
      (h) =>
        h.norm.includes(target) &&
        !excludeTerms.some((ex) => h.norm.includes(ex))
    );
    if (found) return found.raw;
  }

  return null;
}

export function inferColumnMapping(headers: string[], category: SheetCategory): ColumnMapping {
  const indexCol = findBestHeader(
    headers,
    ['#', 'id', 'no', 'no.', 'row'],
    ['row #', 'index']
  );

  const leadCol = findBestHeader(
    headers,
    ['lead', 'name', 'restaurant', 'restaurant name', 'business', 'business name', 'venue', 'client'],
    ['lead', 'restaurant', 'business', 'venue', 'name'],
    ['file', 'tab', 'sheet', 'platform', 'apps to search', 'name+city']
  );

  const urlCol = findBestHeader(
    headers,
    ['url', 'url / social', 'url/social', 'website', 'social', 'link', 'domain'],
    ['url', 'website', 'social', 'link', 'instagram', 'domain']
  );

  const aiResultCol = findBestHeader(
    headers,
    ['ai result', 'ai_result', 'ai answer', 'raw result', 'raw answer'],
    ['ai result', 'ai answer']
  );

  const resultCol = findBestHeader(
    headers,
    ['result', 'final result', 'verdict', 'status', 'audit result'],
    ['result', 'verdict', 'status'],
    ['ai result', 'ai_result', 'final status', 'result explanation']
  );

  // C Marketplace uses "Apps to search (name+city)" as Claim (verbatim)
  const claimCol =
    category === 'C'
      ? findBestHeader(
          headers,
          [
            'apps to search (name+city)',
            'apps to search',
            'claim (verbatim)',
            'claim',
            'marketplace finding',
            'finding',
          ],
          ['apps to search', 'name+city', 'claim', 'finding', 'apps']
        )
      : findBestHeader(
          headers,
          [
            'claim (verbatim)',
            'claim',
            'question',
            'audit claim',
            'original claim',
            'prompt',
            'marketplace finding',
            'finding',
          ],
          ['claim (verbatim)', 'claim', 'question', 'finding', 'apps to search'],
          ['corrected']
        );

  const evidenceCol = findBestHeader(
    headers,
    ['evidence', 'proof', 'source', 'verification', 'can/cant note', "can/can't note"],
    ['evidence', 'proof', 'can/can', 'limitation', 'verif']
  );

  const explanationCol = findBestHeader(
    headers,
    [
      'explanation (optional)',
      'explanation',
      'result explanation',
      'details',
      'detail',
      'comment',
      'comments',
    ],
    ['explanation', 'detail']
  );

  const reasonCol = findBestHeader(
    headers,
    ['reason', 'table d reason', 'why', 'no verify reason', 'rewrite reason', 'rationale'],
    ['reason', 'rationale', 'why']
  );

  const pitchCol = findBestHeader(
    headers,
    [
      'corrected one-sentence pitch angle',
      'one-sentence pitch angle',
      'corrected pitch angle',
      'rewritten pitch angle',
      'recommended pitch angle',
      'pitch angle',
      'rewritten pitch',
      'corrected pitch',
      'rewrite',
      'pitch',
      'angle',
      'hook',
      'new pitch',
      'outreach angle',
    ],
    ['pitch', 'angle', 'rewrite', 'hook', 'outreach', 'one-sentence']
  );

  const notesCol = findBestHeader(
    headers,
    ['notes', 'note', 'rule', 'rules', 'constraint', 'category', 'cuisine'],
    ['note', 'rule', 'constraint', 'category', 'cuisine', 'dining'],
    ['pitch', 'angle', 'corrected prompt']
  );

  if (category === 'D' && !pitchCol) {
    const fallbackPitch = headers.find((h) => {
      const n = normalizeHeader(h);
      return (
        n !== normalizeHeader(indexCol || '') &&
        n !== normalizeHeader(leadCol || '') &&
        n !== normalizeHeader(urlCol || '') &&
        n !== normalizeHeader(reasonCol || '') &&
        (n.includes('copy') || n.includes('message') || n.includes('script') || n.includes('text') || n.includes('body'))
      );
    });
    if (fallbackPitch) {
      return {
        indexCol,
        leadCol,
        urlCol,
        resultCol,
        aiResultCol,
        claimCol,
        evidenceCol,
        explanationCol,
        pitchCol: fallbackPitch,
        reasonCol,
        notesCol,
      };
    }
  }

  return {
    indexCol,
    leadCol,
    urlCol,
    resultCol,
    aiResultCol,
    claimCol,
    evidenceCol,
    explanationCol,
    pitchCol,
    reasonCol,
    notesCol,
  };
}

export function extractRowsWithMapping(
  sheetName: string,
  category: SheetCategory,
  rawMatrix: string[][],
  headerRowIndex: number,
  headers: string[],
  mapping: ColumnMapping
): RawSheetRow[] {
  const headerIndexMap = new Map<string, number>();
  headers.forEach((h, idx) => {
    if (h) headerIndexMap.set(h, idx);
  });

  const getCell = (row: string[], colName: string | null): string => {
    if (!colName) return '';
    const idx = headerIndexMap.get(colName);
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  const hasResultColumn = Boolean(mapping.resultCol);
  const rows: RawSheetRow[] = [];

  for (let r = headerRowIndex + 1; r < rawMatrix.length; r++) {
    const row = rawMatrix[r] || [];
    if (row.every((c) => !String(c ?? '').trim())) continue;

    const leadRaw = getCell(row, mapping.leadCol);
    if (!leadRaw) continue;
    const lowerLead = leadRaw.toLowerCase();
    if (lowerLead === 'total' || lowerLead === 'totals' || lowerLead.startsWith('total (')) continue;

    const rawFields: Record<string, string> = {};
    headers.forEach((h, idx) => {
      const val = String(row[idx] ?? '').trim();
      if (h && val) {
        rawFields[h] = val;
      }
    });

    rows.push({
      sheetName,
      sheetCategory: category,
      hasResultColumn,
      rowNumber: r + 1,
      originalIndex: getCell(row, mapping.indexCol),
      leadRaw,
      urlRaw: getCell(row, mapping.urlCol),
      resultRaw: getCell(row, mapping.resultCol),
      aiResultRaw: getCell(row, mapping.aiResultCol),
      claimRaw: getCell(row, mapping.claimCol),
      evidenceRaw: getCell(row, mapping.evidenceCol),
      explanationRaw: getCell(row, mapping.explanationCol),
      pitchRaw: getCell(row, mapping.pitchCol),
      reasonRaw: getCell(row, mapping.reasonCol),
      notesRaw: getCell(row, mapping.notesCol),
      rawFields,
    });
  }

  return rows;
}

function makeUniqueHeaders(rawHeaderRow: string[]): string[] {
  const counts = new Map<string, number>();
  return rawHeaderRow.map((cell, idx) => {
    const base = String(cell ?? '').trim() || `Column ${idx + 1}`;
    const count = counts.get(base) || 0;
    counts.set(base, count + 1);
    return count === 0 ? base : `${base} (${count + 1})`;
  });
}

export async function parseUploadedFiles(files: File[]): Promise<ParsedSheet[]> {
  const parsedSheets: ParsedSheet[] = [];

  for (const file of files) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });

    for (const rawSheetName of workbook.SheetNames) {
      let effectiveSheetName = rawSheetName;
      if (workbook.SheetNames.length === 1 && file.name.toLowerCase().endsWith('.csv')) {
        effectiveSheetName = file.name
          .replace(/\.csv$/i, '')
          .replace(/^.*_-_/i, '')
          .replace(/_/g, ' ')
          .trim();
      }

      const worksheet = workbook.Sheets[rawSheetName];
      const matrix = XLSX.utils.sheet_to_json<string[]>(worksheet, {
        header: 1,
        defval: '',
        raw: false,
      }) as string[][];

      if (!matrix || matrix.length === 0) continue;

      const category = classifySheetName(effectiveSheetName);
      const headerRowIndex = detectHeaderRowIndex(matrix);
      const rawHeaderRow = matrix[headerRowIndex] || [];
      const headers = makeUniqueHeaders(rawHeaderRow);
      const mapping = inferColumnMapping(headers, category);

      const isInstructionSheet =
        category === 'SUMMARY' || (!mapping.leadCol && headers.length <= 3);

      const rows = isInstructionSheet
        ? []
        : extractRowsWithMapping(
            effectiveSheetName,
            category,
            matrix,
            headerRowIndex,
            headers,
            mapping
          );

      parsedSheets.push({
        sheetName: effectiveSheetName,
        category: isInstructionSheet ? 'SUMMARY' : category,
        headers,
        headerRowIndex,
        mapping,
        rows,
        rawMatrix: matrix,
      });
    }
  }

  return parsedSheets;
}
