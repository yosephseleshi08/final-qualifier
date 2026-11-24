import type {
  ConsolidatedLead,
  ConsolidationOutput,
  DestinationTab,
  DuplicateMergeRecord,
  ParsedSheet,
  RawSheetRow,
  SheetBreakdown,
  SheetCategory,
} from '../types/audit';
import {
  mergeUrls,
  normalizeLeadName,
  pickCleanestDisplayName,
} from './normalizer';

const SHEET_ORDER: Record<SheetCategory, number> = {
  A1: 1,
  A2: 2,
  A3: 3,
  B: 4,
  C: 5,
  D: 6,
  OTHER: 7,
  SUMMARY: 99,
};

/**
 * Priority Hierarchy Classification for a single row occurrence:
 * Priority 1 -> Confirmed
 * Priority 2 -> Cannot Verify (beats Refuted)
 * Priority 3 -> Refuted
 * Priority 4 -> No Need Result
 */
export function classifyRowResult(row: RawSheetRow): DestinationTab {
  if (row.sheetCategory === 'D' || (!row.hasResultColumn && !row.resultRaw)) {
    return 'No Need Result';
  }

  const res = row.resultRaw.toUpperCase().replace(/\s+/g, ' ').trim();

  if (row.sheetCategory === 'C') {
    if (res.includes('INFLATED')) return 'Confirmed';
    if (res.includes('FAIR') || res.includes('NOT LISTED')) return 'Refuted';
    if (!res || res.includes('CANNOT') || res.includes('UNVERIFIED')) return 'Cannot Verify';
  }

  if (row.sheetCategory === 'B') {
    if (res === 'CONFIRMED' || res.startsWith('CONFIRMED')) return 'Confirmed';
    if (
      res === 'CONFIGURATION' ||
      res.includes('CONFIGURATION') ||
      res === 'REFUTED' ||
      res.startsWith('REFUTED')
    ) {
      return 'Refuted';
    }
    return 'Cannot Verify';
  }

  if (res === 'CONFIRMED' || res.startsWith('CONFIRMED') || res.includes('INFLATED')) {
    return 'Confirmed';
  }
  if (
    res === 'CANNOT VERIFY' ||
    res.includes('CANNOT VERIFY') ||
    res.includes('UNVERIFIED') ||
    res === ''
  ) {
    return 'Cannot Verify';
  }
  if (
    res === 'REFUTED' ||
    res.startsWith('REFUTED') ||
    res === 'CONFIGURATION' ||
    res.includes('FAIR') ||
    res.includes('NOT LISTED')
  ) {
    return 'Refuted';
  }

  return 'Cannot Verify';
}

export function getPriorityRank(status: DestinationTab): number {
  if (status === 'Confirmed') return 1;
  if (status === 'Cannot Verify') return 2;
  if (status === 'Refuted') return 3;
  return 4;
}

/**
 * Extract exact verbatim Claim (verbatim) for a single row occurrence with NO sheet prefixes:
 * - A1-A3 & B Phone Check: Claim (verbatim)
 * - C Marketplace: Apps to search (name+city)
 * - D Rewrite: Reason
 */
function extractRowClaimVerbatim(row: RawSheetRow): string {
  if (row.sheetCategory === 'D') {
    return (row.reasonRaw || row.claimRaw || row.notesRaw || '').trim();
  }
  if (row.sheetCategory === 'C') {
    return (row.claimRaw || '').trim();
  }
  return (row.claimRaw || '').trim();
}

/**
 * Extract full verbatim Result Explanation for a single row occurrence with NO sheet prefixes or filler:
 * - A1-A3: Full verbatim AI Result
 * - B Phone Check & C Marketplace: Explanation (optional)
 * - D Rewrite: Corrected one-sentence pitch angle
 */
function extractRowResultExplanation(row: RawSheetRow): string {
  if (row.sheetCategory === 'D') {
    if (row.pitchRaw.trim()) return row.pitchRaw.trim();
    const candidate = Object.entries(row.rawFields).find(([k, v]) => {
      const kl = k.toLowerCase();
      return (
        v &&
        v !== row.leadRaw &&
        v !== row.urlRaw &&
        v !== row.originalIndex &&
        v !== row.reasonRaw &&
        (kl.includes('pitch') ||
          kl.includes('angle') ||
          kl.includes('rewrite') ||
          kl.includes('corrected') ||
          v.length > 40)
      );
    });
    return candidate ? candidate[1].trim() : (row.explanationRaw || '').trim();
  }

  if (row.sheetCategory === 'B' || row.sheetCategory === 'C') {
    return (row.explanationRaw || row.evidenceRaw || row.aiResultRaw || '').trim();
  }

  // A1, A2, A3, OTHER: Full verbatim AI Result (falling back to Explanation/Evidence only if AI Result is blank)
  return (row.aiResultRaw || row.explanationRaw || row.evidenceRaw || '').trim();
}

function extractTableDIntelligence(rows: RawSheetRow[]): {
  hasTableD: boolean;
  tableDReason: string;
  tableDPitch: string;
} {
  const dRows = rows.filter((r) => r.sheetCategory === 'D');
  if (dRows.length === 0) {
    return { hasTableD: false, tableDReason: '', tableDPitch: '' };
  }

  const reasons = dRows
    .map((r) => extractRowClaimVerbatim(r))
    .filter(Boolean);
  const pitches = dRows
    .map((r) => extractRowResultExplanation(r))
    .filter(Boolean);

  return {
    hasTableD: true,
    tableDReason: Array.from(new Set(reasons)).join('\n'),
    tableDPitch: Array.from(new Set(pitches)).join('\n'),
  };
}

export function consolidateWorkbook(
  fileName: string,
  parsedSheets: ParsedSheet[]
): ConsolidationOutput {
  const dataSheets = parsedSheets.filter((s) => s.category !== 'SUMMARY');

  const sheetBreakdowns: SheetBreakdown[] = dataSheets.map((s) => {
    let confirmedRows = 0;
    let cannotVerifyRows = 0;
    let refutedRows = 0;
    let noNeedResultRows = 0;

    for (const row of s.rows) {
      const cls = classifyRowResult(row);
      if (cls === 'Confirmed') confirmedRows++;
      else if (cls === 'Cannot Verify') cannotVerifyRows++;
      else if (cls === 'Refuted') refutedRows++;
      else noNeedResultRows++;
    }

    return {
      sheetName: s.sheetName,
      category: s.category,
      totalRows: s.rows.length,
      confirmedRows,
      cannotVerifyRows,
      refutedRows,
      noNeedResultRows,
    };
  });

  const grouped = new Map<string, RawSheetRow[]>();
  let totalRawRows = 0;

  for (const sheet of dataSheets) {
    for (const row of sheet.rows) {
      totalRawRows++;
      const key = normalizeLeadName(row.leadRaw);
      if (!key) continue;
      const list = grouped.get(key) || [];
      list.push(row);
      grouped.set(key, list);
    }
  }

  const confirmed: ConsolidatedLead[] = [];
  const cannotVerify: ConsolidatedLead[] = [];
  const refuted: ConsolidatedLead[] = [];
  const noNeedResult: ConsolidatedLead[] = [];
  const duplicates: DuplicateMergeRecord[] = [];

  for (const [normalizedKey, occurrences] of grouped.entries()) {
    const sortedOccurrences = [...occurrences].sort(
      (a, b) => SHEET_ORDER[a.sheetCategory] - SHEET_ORDER[b.sheetCategory]
    );

    const classifiedList = sortedOccurrences.map((row) => ({
      row,
      status: classifyRowResult(row),
    }));

    let finalStatus: DestinationTab = 'No Need Result';
    let bestRank = 4;
    for (const item of classifiedList) {
      const rank = getPriorityRank(item.status);
      if (rank < bestRank) {
        bestRank = rank;
        finalStatus = item.status;
      }
    }

    const name = pickCleanestDisplayName(sortedOccurrences.map((o) => o.leadRaw));
    const url = mergeUrls(sortedOccurrences.map((o) => o.urlRaw));
    const sourceTabs = Array.from(new Set(sortedOccurrences.map((o) => o.sheetName)));
    const { hasTableD, tableDReason, tableDPitch } = extractTableDIntelligence(sortedOccurrences);

    const relevantItems = classifiedList.filter((i) => i.status === finalStatus);

    // Exact verbatim Claim (verbatim) without sheet prefixes
    const claimValues = Array.from(
      new Set(
        relevantItems
          .map(({ row }) => extractRowClaimVerbatim(row))
          .filter(Boolean)
      )
    );
    const fallbackClaimValues =
      claimValues.length > 0
        ? claimValues
        : Array.from(
            new Set(
              sortedOccurrences
                .map((row) => extractRowClaimVerbatim(row))
                .filter(Boolean)
            )
          );

    // Full verbatim Result Explanation without sheet prefixes or filler text
    const explanationValues = Array.from(
      new Set(
        relevantItems
          .map(({ row }) => extractRowResultExplanation(row))
          .filter(Boolean)
      )
    );
    const fallbackExplanationValues =
      explanationValues.length > 0
        ? explanationValues
        : Array.from(
            new Set(
              sortedOccurrences
                .map((row) => extractRowResultExplanation(row))
                .filter(Boolean)
            )
          );

    const record: ConsolidatedLead = {
      id: `lead_${normalizedKey}`,
      rowNumber: 0,
      normalizedKey,
      name,
      url,
      destination: finalStatus,
      claimVerbatim: fallbackClaimValues.join('\n'),
      resultExplanation: fallbackExplanationValues.join('\n'),
      correctedPrompt: '',
      sourceTabs,
      hasTableD,
      tableDReason,
      tableDPitch,
      sourceAppearances: classifiedList.map(({ row, status }) => ({
        sheetName: row.sheetName,
        sheetCategory: row.sheetCategory,
        rawLead: row.leadRaw,
        rawResult:
          row.resultRaw ||
          (row.sheetCategory === 'D' || !row.hasResultColumn ? 'No Need Result' : 'Unverified'),
        rowClassification: status,
        claimVerbatim: extractRowClaimVerbatim(row),
        resultExplanation: extractRowResultExplanation(row),
        rawFields: row.rawFields,
      })),
    };

    if (finalStatus === 'Confirmed') confirmed.push(record);
    else if (finalStatus === 'Cannot Verify') cannotVerify.push(record);
    else if (finalStatus === 'Refuted') refuted.push(record);
    else noNeedResult.push(record);

    if (occurrences.length > 1) {
      const hasMultipleStatuses = new Set(classifiedList.map((c) => c.status)).size > 1;
      const winningSources = relevantItems.map((i) => i.row.sheetName).join(', ');
      duplicates.push({
        normalizedKey,
        chosenDisplayName: name,
        rawNames: Array.from(new Set(sortedOccurrences.map((o) => o.leadRaw))),
        sourceTabs,
        winningStatus: finalStatus,
        winningReason: hasMultipleStatuses
          ? `Priority ${bestRank} (${finalStatus}) from ${winningSources} overrode lower-priority tab(s)`
          : `Merged ${occurrences.length} matching entries across ${sourceTabs.join(', ')}`,
        occurrencesCount: occurrences.length,
      });
    }
  }

  const sortAndNumber = (list: ConsolidatedLead[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    list.forEach((item, idx) => {
      item.rowNumber = idx + 1;
    });
  };

  sortAndNumber(confirmed);
  sortAndNumber(cannotVerify);
  sortAndNumber(refuted);
  sortAndNumber(noNeedResult);
  duplicates.sort(
    (a, b) => b.occurrencesCount - a.occurrencesCount || a.chosenDisplayName.localeCompare(b.chosenDisplayName)
  );

  const totalUniqueLeads =
    confirmed.length + cannotVerify.length + refuted.length + noNeedResult.length;

  return {
    fileName,
    processedAt: new Date().toISOString(),
    totalRawRows,
    totalUniqueLeads,
    duplicatesRemoved: Math.max(0, totalRawRows - totalUniqueLeads),
    confirmed,
    cannotVerify,
    refuted,
    noNeedResult,
    duplicates,
    sheetBreakdowns,
    parsedSheets,
  };
}
