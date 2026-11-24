export interface UniversalRow {
  id: string;
  cells: Record<string, string>;
}

export interface UniversalSheet {
  id: string;
  name: string;
  columns: string[];
  promptInjected: boolean;
  rows: UniversalRow[];
}

export interface UniversalWorkbook {
  fileName: string;
  loadedAt: string;
  updatedAt: string;
  sheets: UniversalSheet[];
}

export interface SheetFilterState {
  search: string;
  columnFilters: Record<string, string>;
}
