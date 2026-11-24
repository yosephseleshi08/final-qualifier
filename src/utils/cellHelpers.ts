import type { UniversalRow, UniversalSheet } from '../types/audit';

export function isPromptColumn(colName: string): boolean {
  return colName.trim().toLowerCase() === 'prompt';
}

export function findPromptColumn(columns: string[]): string | null {
  return columns.find((c) => isPromptColumn(c)) ?? null;
}

export function findPrimaryNameColumn(columns: string[]): string | null {
  if (columns.length === 0) return null;

  const exactPriority = [
    'display_name',
    'display name',
    'lead_name',
    'lead name',
    'restaurant',
    'restaurant name',
    'business_name',
    'business name',
    'name',
    'lead',
    'company',
    'company_name',
    'venue',
    'client',
    'title',
  ];

  const normalized = columns.map((raw) => ({
    raw,
    norm: raw.trim().toLowerCase(),
  }));

  for (const target of exactPriority) {
    const found = normalized.find((c) => c.norm === target);
    if (found) return found.raw;
  }

  const partialPriority = ['display', 'name', 'lead', 'restaurant', 'business', 'company'];
  for (const target of partialPriority) {
    const found = normalized.find(
      (c) =>
        c.norm.includes(target) &&
        !c.norm.includes('id') &&
        !c.norm.includes('file') &&
        !c.norm.includes('sheet')
    );
    if (found) return found.raw;
  }

  return columns.find((c) => !/^(#|id|lead_id|row|index)$/i.test(c.trim())) ?? columns[0];
}

export function isUrlColumnName(colName: string): boolean {
  const norm = colName.trim().toLowerCase();
  return (
    norm === 'url' ||
    norm === 'website' ||
    norm === 'site' ||
    norm === 'domain' ||
    norm === 'link' ||
    norm === 'secondary_channel' ||
    norm === 'platformlink' ||
    norm.includes('url') ||
    norm.includes('website') ||
    norm.includes('link') ||
    norm.includes('social') ||
    norm.includes('instagram') ||
    norm.includes('facebook')
  );
}

export function extractNavigableUrl(value: string): string | null {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '—' || raw === '-') return null;

  // Split multi-value cells like "url1 | url2" and inspect the first candidate
  const firstCandidate = raw.split(/\s*\|\s*|\n+/)[0]?.trim() ?? '';
  if (!firstCandidate || firstCandidate.includes(' ')) return null;
  if (firstCandidate.includes('@') && !/^https?:\/\//i.test(firstCandidate)) return null;

  if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(firstCandidate)) {
    return firstCandidate;
  }

  if (/^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(firstCandidate)) {
    return `https://${firstCandidate}`;
  }

  return null;
}

export function isStatusColumnName(colName: string): boolean {
  const norm = colName.trim().toLowerCase();
  return (
    norm === 'verdict' ||
    norm === 'batch' ||
    norm === 'proof_strength' ||
    norm === 'contact_flag' ||
    norm === 'status' ||
    norm === 'result' ||
    norm === 'destination' ||
    norm === 'channel' ||
    norm === 'tier' ||
    norm === 'priority' ||
    norm === 'stage' ||
    norm === 'decision' ||
    norm.endsWith('_flag') ||
    norm.endsWith('_status') ||
    norm.endsWith('_verdict') ||
    norm.endsWith('_strength') ||
    norm.endsWith('_tier')
  );
}

export function isLongTextColumnName(colName: string): boolean {
  const norm = colName.trim().toLowerCase();
  return (
    isPromptColumn(colName) ||
    norm.includes('fact') ||
    norm.includes('trigger') ||
    norm.includes('anchor') ||
    norm.includes('claim') ||
    norm.includes('explanation') ||
    norm.includes('reason') ||
    norm.includes('pitch') ||
    norm.includes('note') ||
    norm.includes('detail') ||
    norm.includes('comment') ||
    norm.includes('evidence') ||
    norm.includes('description') ||
    norm.includes('summary') ||
    norm.includes('ai result') ||
    norm.includes('ai_result')
  );
}

export interface StatusTone {
  badgeClass: string;
  excelFill: string;
  excelFont: string;
}

export function getStatusTone(value: string): StatusTone {
  const norm = String(value ?? '').trim().toLowerCase();

  if (
    !norm ||
    norm === '—' ||
    norm === '-' ||
    norm === 'n/a' ||
    norm === 'none'
  ) {
    return {
      badgeClass:
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700',
      excelFill: 'FFF1F5F9',
      excelFont: 'FF475569',
    };
  }

  // Positive / Ready / Confirmed / Strong
  if (
    /\b(send[-\s_]?now|confirmed|strong|verified|ready|approved|pass|passed|valid|clean|yes|high|listed\s*-\s*inflated|active|ok)\b/.test(
      norm
    )
  ) {
    return {
      badgeClass:
        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/35',
      excelFill: 'FFDCFCE7',
      excelFont: 'FF166534',
    };
  }

  // Caution / Verify / Hold / Medium / Partial
  if (
    /\b(verify[-\s_]?first|hold|cannot\s*verify|partial|medium|moderate|pending|review|needs?\s*check|warning|caution|unclear|unverified|missing|check)\b/.test(
      norm
    )
  ) {
    return {
      badgeClass:
        'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35',
      excelFill: 'FFFEF3C7',
      excelFont: 'FF92400E',
    };
  }

  // Negative / Drop / Refuted / Weak / Blocked
  if (
    /\b(drop|refuted|weak|reject|rejected|fail|failed|invalid|bounce|bounced|dnc|blocked|no|low|not\s*listed|listed\s*-\s*fair)\b/.test(
      norm
    )
  ) {
    return {
      badgeClass:
        'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/35',
      excelFill: 'FFFEE2E2',
      excelFont: 'FF991B1B',
    };
  }

  // Informational / Channel / Batch / Config
  if (
    /\b(batch|email|phone|call|dm|instagram|facebook|web|form|sms|configuration|linkedin|no\s*need)\b/.test(
      norm
    ) ||
    /^b\d+/i.test(norm)
  ) {
    return {
      badgeClass:
        'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:border-sky-500/35',
      excelFill: 'FFE0F2FE',
      excelFont: 'FF075985',
    };
  }

  return {
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
    excelFill: 'FFF1F5F9',
    excelFont: 'FF334155',
  };
}

export interface FilterableColumnOption {
  column: string;
  values: string[];
}

export function getFilterableColumns(sheet: UniversalSheet): FilterableColumnOption[] {
  const candidates: { column: string; values: string[]; priority: number }[] = [];

  for (const col of sheet.columns) {
    if (isPromptColumn(col)) continue;
    const norm = col.trim().toLowerCase();
    if (norm === 'lead_id' || norm === 'id' || norm === '#' || isUrlColumnName(col)) {
      continue;
    }

    const distinct = new Set<string>();
    let hasLongValue = false;

    for (const row of sheet.rows) {
      const val = (row.cells[col] ?? '').trim();
      if (!val) continue;
      if (val.length > 42 || val.includes('\n')) {
        hasLongValue = true;
        break;
      }
      distinct.add(val);
      if (distinct.size > 28) break;
    }

    if (hasLongValue || distinct.size < 2 || distinct.size > 28) continue;

    let priority = 0;
    if (isStatusColumnName(col)) priority += 10;
    if (norm === 'verdict' || norm === 'batch' || norm === 'channel') priority += 5;
    if (norm === 'state' || norm === 'proof_strength' || norm === 'contact_flag') priority += 4;

    if (priority > 0 || distinct.size <= 12) {
      candidates.push({
        column: col,
        values: Array.from(distinct).sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' })
        ),
        priority,
      });
    }
  }

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5)
    .map(({ column, values }) => ({ column, values }));
}

export function getUniqueColumnValues(sheet: UniversalSheet, column: string): string[] {
  const seen = new Set<string>();
  for (const row of sheet.rows) {
    const val = (row.cells[column] ?? '').trim();
    if (val && val.length <= 60) {
      seen.add(val);
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function buildLeadAnalysisPrompt(row: UniversalRow, columns: string[]): string {
  const getField = (aliases: string[]): string => {
    for (const alias of aliases) {
      const exact = columns.find((c) => c.trim().toLowerCase() === alias);
      if (exact && row.cells[exact]?.trim()) return row.cells[exact].trim();
    }
    for (const alias of aliases) {
      const partial = columns.find((c) => c.trim().toLowerCase().includes(alias));
      if (partial && row.cells[partial]?.trim()) return row.cells[partial].trim();
    }
    return '';
  };

  const displayName =
    getField([
      'display_name',
      'display name',
      'lead_name',
      'restaurant',
      'business_name',
      'name',
      'lead',
      'company',
    ]) || '[Business Name]';
  const city = getField(['city', 'town']);
  const state = getField(['state', 'region', 'province']);
  const location = [city, state].filter(Boolean).join(', ');
  const website =
    getField(['website', 'url', 'site', 'domain', 'platformlink', 'secondary_channel']) ||
    '[Website]';
  const brandAnchor = getField(['brand_anchor', 'brand anchor', 'anchor', 'brand']);
  const provenFact = getField([
    'proven_fact',
    'proven fact',
    'evidence',
    'claim (verbatim)',
    'claim',
    'fact',
  ]);
  const targetTrigger = getField([
    'target_trigger',
    'target trigger',
    'trigger',
    'corrected pitch angle',
    'pitch',
    'angle',
    'result explanation',
  ]);

  const lines = [
    `🏢 Lead Analysis — Ridge Creative Web Studio`,
    `Business: ${displayName}${location ? ` (${location})` : ''}`,
    `Website: ${website}`,
  ];

  if (brandAnchor) lines.push(`Brand Anchor: ${brandAnchor}`);
  if (provenFact) lines.push(`Proven Fact: ${provenFact}`);
  if (targetTrigger) lines.push(`Target Trigger: ${targetTrigger}`);

  lines.push(
    '',
    `Objective: Draft a concise, tailored Ridge Creative Web Studio outreach message for ${displayName} anchored in the verified observation above without exaggerating or inventing claims.`
  );

  return lines.join('\n');
}
