export type SheetCategory = 'A1' | 'A2' | 'A3' | 'B' | 'C' | 'D' | 'SUMMARY' | 'OTHER';

export type DestinationTab = 'Confirmed' | 'Cannot Verify' | 'Refuted' | 'No Need Result';

export interface ColumnMapping {
  indexCol: string | null;
  leadCol: string | null;
  urlCol: string | null;
  resultCol: string | null;
  aiResultCol: string | null;
  claimCol: string | null;
  evidenceCol: string | null;
  explanationCol: string | null;
  pitchCol: string | null;
  reasonCol: string | null;
  notesCol: string | null;
}

export interface RawSheetRow {
  sheetName: string;
  sheetCategory: SheetCategory;
  hasResultColumn: boolean;
  rowNumber: number;
  originalIndex: string;
  leadRaw: string;
  urlRaw: string;
  resultRaw: string;
  aiResultRaw: string;
  claimRaw: string;
  evidenceRaw: string;
  explanationRaw: string;
  pitchRaw: string;
  reasonRaw: string;
  notesRaw: string;
  rawFields: Record<string, string>;
}

export interface ParsedSheet {
  sheetName: string;
  category: SheetCategory;
  headers: string[];
  headerRowIndex: number;
  mapping: ColumnMapping;
  rows: RawSheetRow[];
  rawMatrix: string[][];
}

export interface SourceAppearance {
  sheetName: string;
  sheetCategory: SheetCategory;
  rawLead: string;
  rawResult: string;
  rowClassification: DestinationTab;
  claimVerbatim: string;
  resultExplanation: string;
  rawFields: Record<string, string>;
}

export interface ConsolidatedLead {
  id: string;
  rowNumber: number;
  normalizedKey: string;
  name: string;
  url: string;
  destination: DestinationTab;
  claimVerbatim: string;
  resultExplanation: string;
  correctedPrompt: string;
  sourceTabs: string[];
  hasTableD: boolean;
  tableDReason: string;
  tableDPitch: string;
  sourceAppearances: SourceAppearance[];
}

export interface DuplicateMergeRecord {
  normalizedKey: string;
  chosenDisplayName: string;
  rawNames: string[];
  sourceTabs: string[];
  winningStatus: DestinationTab;
  winningReason: string;
  occurrencesCount: number;
}

export interface SheetBreakdown {
  sheetName: string;
  category: SheetCategory;
  totalRows: number;
  confirmedRows: number;
  cannotVerifyRows: number;
  refutedRows: number;
  noNeedResultRows: number;
}

export interface ConsolidationOutput {
  fileName: string;
  processedAt: string;
  totalRawRows: number;
  totalUniqueLeads: number;
  duplicatesRemoved: number;
  confirmed: ConsolidatedLead[];
  cannotVerify: ConsolidatedLead[];
  refuted: ConsolidatedLead[];
  noNeedResult: ConsolidatedLead[];
  duplicates: DuplicateMergeRecord[];
  sheetBreakdowns: SheetBreakdown[];
  parsedSheets: ParsedSheet[];
}
