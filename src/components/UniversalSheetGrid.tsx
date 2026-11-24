import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { SheetFilterState, UniversalRow, UniversalSheet } from '../types/audit';
import {
  buildLeadAnalysisPrompt,
  extractNavigableUrl,
  findPrimaryNameColumn,
  getFilterableColumns,
  getStatusTone,
  getUniqueColumnValues,
  isLongTextColumnName,
  isPromptColumn,
  isStatusColumnName,
  isUrlColumnName,
} from '../utils/cellHelpers';
import { RowInspectorDrawer } from './RowInspectorDrawer';

interface UniversalSheetGridProps {
  sheet: UniversalSheet;
  allSheetNames: string[];
  filterState: SheetFilterState;
  onFilterChange: (next: SheetFilterState) => void;
  onAddRow: () => void;
  onUpdateCell: (rowId: string, column: string, value: string) => void;
  onMoveRows: (rowIds: string[], targetSheetName: string) => void;
  onDeleteRows: (rowIds: string[]) => void;
}

function AutoTextarea({
  value,
  placeholder,
  ariaLabel,
  onChange,
  minRows = 2,
}: {
  value: string;
  placeholder?: string;
  ariaLabel: string;
  onChange: (val: string) => void;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(220, Math.max(38, el.scrollHeight))}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-xs leading-relaxed bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-600/70 dark:focus:border-emerald-500/70 focus:bg-white dark:focus:bg-[#080c14] rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-none transition-colors"
    />
  );
}

function StatusEditableCell({
  rowId,
  column,
  value,
  suggestions,
  onCommit,
}: {
  rowId: string;
  column: string;
  value: string;
  suggestions: string[];
  onCommit: (nextValue: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listId = `status-dl-${rowId}-${column.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <div>
        <input
          ref={inputRef}
          type="text"
          list={listId}
          value={value}
          aria-label={`Edit ${column}`}
          onChange={(e) => onCommit(e.target.value)}
          onBlur={() => setIsEditing(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') {
              setIsEditing(false);
            }
          }}
          className="w-full px-2 py-1 text-xs font-medium bg-white dark:bg-[#080c14] border border-emerald-500/70 rounded text-slate-900 dark:text-white focus:outline-none"
        />
        {suggestions.length > 0 && (
          <datalist id={listId}>
            {suggestions.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        )}
      </div>
    );
  }

  const tone = getStatusTone(value);

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      title={`Click to edit ${column}`}
      className="w-full text-left py-0.5 cursor-text group"
    >
      {value.trim() ? (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-semibold rounded border transition-opacity group-hover:opacity-90 whitespace-nowrap ${tone.badgeClass}`}
        >
          {value}
        </span>
      ) : (
        <span className="inline-block px-2 py-0.5 text-xs text-slate-400 dark:text-slate-600 rounded border border-dashed border-transparent group-hover:border-slate-300 dark:group-hover:border-slate-700">
          —
        </span>
      )}
    </button>
  );
}

function getColumnMinWidth(colName: string, isPrimary: boolean): string {
  const norm = colName.trim().toLowerCase();
  if (isPrimary) return 'min-w-[220px]';
  if (norm === '#' || norm === 'id' || norm === 'lead_id') return 'min-w-[96px]';
  if (norm === 'state') return 'min-w-[76px]';
  if (norm === 'city') return 'min-w-[125px]';
  if (isPromptColumn(colName)) return 'min-w-[300px]';
  if (isLongTextColumnName(colName)) return 'min-w-[260px]';
  if (isUrlColumnName(colName)) return 'min-w-[210px]';
  if (isStatusColumnName(colName)) return 'min-w-[140px]';
  return 'min-w-[155px]';
}

export function UniversalSheetGrid({
  sheet,
  allSheetNames,
  filterState,
  onFilterChange,
  onAddRow,
  onUpdateCell,
  onMoveRows,
  onDeleteRows,
}: UniversalSheetGridProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectedRowId, setInspectedRowId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bulkMoveTarget, setBulkMoveTarget] = useState<string>('');

  const primaryCol = useMemo(
    () => findPrimaryNameColumn(sheet.columns),
    [sheet.columns]
  );
  const primaryColIndex = primaryCol ? sheet.columns.indexOf(primaryCol) : -1;

  // Determine sticky left columns without altering original column order
  const stickyColumnMap = useMemo(() => {
    const map = new Map<number, string>();
    if (sheet.columns.length === 0) return map;

    if (primaryColIndex === 0) {
      map.set(0, 'md:sticky md:left-[42px] md:z-20');
    } else if (primaryColIndex === 1) {
      map.set(0, 'md:sticky md:left-[42px] md:z-20 w-[96px] min-w-[96px] max-w-[96px]');
      map.set(1, 'md:sticky md:left-[138px] md:z-20');
    } else {
      map.set(0, 'md:sticky md:left-[42px] md:z-20');
    }
    return map;
  }, [sheet.columns.length, primaryColIndex]);

  const rightmostStickyIndex = useMemo(() => {
    if (stickyColumnMap.size === 0) return -1;
    return Math.max(...Array.from(stickyColumnMap.keys()));
  }, [stickyColumnMap]);

  const filterableColumns = useMemo(() => getFilterableColumns(sheet), [sheet]);

  const statusSuggestionsByCol = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const col of sheet.columns) {
      if (isStatusColumnName(col)) {
        map.set(col, getUniqueColumnValues(sheet, col));
      }
    }
    return map;
  }, [sheet]);

  useEffect(() => {
    const validIds = new Set(sheet.rows.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
    if (inspectedRowId && !validIds.has(inspectedRowId)) {
      setInspectedRowId(null);
    }
  }, [sheet.rows, inspectedRowId]);

  const otherSheetNames = useMemo(
    () => allSheetNames.filter((name) => name !== sheet.name),
    [allSheetNames, sheet.name]
  );

  useEffect(() => {
    setBulkMoveTarget(otherSheetNames[0] ?? '');
  }, [otherSheetNames]);

  const filteredRows = useMemo(() => {
    const q = filterState.search.trim().toLowerCase();
    const activeFilters = Object.entries(filterState.columnFilters).filter(
      ([, val]) => val && val !== 'ALL'
    );

    return sheet.rows.filter((row) => {
      for (const [col, targetVal] of activeFilters) {
        if ((row.cells[col] ?? '').trim() !== targetVal) {
          return false;
        }
      }
      if (!q) return true;
      return sheet.columns.some((col) =>
        (row.cells[col] ?? '').toLowerCase().includes(q)
      );
    });
  }, [sheet.rows, sheet.columns, filterState]);

  const hasActiveFilters =
    filterState.search.trim().length > 0 ||
    Object.values(filterState.columnFilters).some((v) => v && v !== 'ALL');

  const inspectedIndex = useMemo(
    () =>
      inspectedRowId
        ? filteredRows.findIndex((r) => r.id === inspectedRowId)
        : -1,
    [filteredRows, inspectedRowId]
  );

  const inspectedRow: UniversalRow | null =
    inspectedIndex >= 0 ? filteredRows[inspectedIndex] : null;

  const visibleIds = useMemo(() => filteredRows.map((r) => r.id), [filteredRows]);
  const selectedVisibleCount = useMemo(
    () => visibleIds.filter((id) => selectedIds.has(id)).length,
    [visibleIds, selectedIds]
  );
  const allVisibleSelected =
    visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected =
    selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((curr) => (curr === key ? null : curr));
      }, 1800);
    } catch {
      // Clipboard blocked in restricted frames
    }
  };

  const handleDrawerNavigate = (direction: 'prev' | 'next') => {
    if (inspectedIndex < 0) return;
    const nextIdx = direction === 'prev' ? inspectedIndex - 1 : inspectedIndex + 1;
    if (nextIdx >= 0 && nextIdx < filteredRows.length) {
      setInspectedRowId(filteredRows[nextIdx].id);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filterState.search}
                onChange={(e) =>
                  onFilterChange({ ...filterState, search: e.target.value })
                }
                placeholder={`Search across all ${sheet.columns.length} columns in ${sheet.name}...`}
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
              />
              {filterState.search && (
                <button
                  type="button"
                  onClick={() => onFilterChange({ ...filterState, search: '' })}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {filterableColumns.map(({ column, values }) => {
              const current = filterState.columnFilters[column] || 'ALL';
              return (
                <select
                  key={column}
                  aria-label={`Filter by ${column}`}
                  value={current}
                  onChange={(e) =>
                    onFilterChange({
                      ...filterState,
                      columnFilters: {
                        ...filterState.columnFilters,
                        [column]: e.target.value,
                      },
                    })
                  }
                  className={`px-2.5 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                    current !== 'ALL'
                      ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                      : 'bg-slate-50 dark:bg-[#080c14] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <option value="ALL">{column}: All</option>
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {column}: {v}
                    </option>
                  ))}
                </select>
              );
            })}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: '', columnFilters: {} })}
                className="px-2.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline underline-offset-2 whitespace-nowrap cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {filteredRows.length.toLocaleString()} of{' '}
              {sheet.rows.length.toLocaleString()} rows
            </span>
            <button
              type="button"
              onClick={onAddRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row</span>
            </button>
          </div>
        </div>

        {/* Bulk Selection Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 rounded-md">
            <div className="text-xs font-medium text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
              {selectedIds.size} row{selectedIds.size === 1 ? '' : 's'} selected
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {otherSheetNames.length > 0 && (
                <div className="inline-flex items-center gap-1.5">
                  <select
                    aria-label="Destination sheet for selected rows"
                    value={bulkMoveTarget}
                    onChange={(e) => setBulkMoveTarget(e.target.value)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-[#080c14] border border-emerald-300 dark:border-emerald-500/40 rounded text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    {otherSheetNames.map((name) => (
                      <option key={name} value={name}>
                        Move to {name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!bulkMoveTarget) return;
                      onMoveRows(Array.from(selectedIds), bulkMoveTarget);
                      setSelectedIds(new Set());
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Move ({selectedIds.size})
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Clear Selection
              </button>

              <button
                type="button"
                onClick={() => {
                  onDeleteRows(Array.from(selectedIds));
                  setSelectedIds(new Set());
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Spreadsheet Grid */}
      {filteredRows.length === 0 ? (
        <div className="px-6 py-16 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {sheet.rows.length === 0
              ? `No rows in "${sheet.name}" yet`
              : `No rows in "${sheet.name}" match your search or filters`}
          </p>
          <div className="flex items-center justify-center gap-3">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => onFilterChange({ search: '', columnFilters: {} })}
                className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={onAddRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Row to {sheet.name}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto overflow-y-auto max-h-[68vh]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-30">
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0d1422] text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-3 px-2.5 w-[42px] min-w-[42px] text-center md:sticky md:left-0 md:z-30 bg-slate-50 dark:bg-[#0d1422]">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible rows"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#080c14] text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/40 cursor-pointer accent-emerald-600 dark:accent-emerald-500"
                  />
                </th>

                {sheet.columns.map((col, colIdx) => {
                  const stickyClass = stickyColumnMap.get(colIdx) ?? '';
                  const isFreezeEdge = colIdx === rightmostStickyIndex;
                  const isPrimary = col === primaryCol;
                  const isPrompt = isPromptColumn(col);

                  return (
                    <th
                      key={col}
                      className={`py-3 px-3 whitespace-nowrap ${getColumnMinWidth(col, isPrimary)} ${stickyClass} bg-slate-50 dark:bg-[#0d1422] ${
                        isFreezeEdge
                          ? 'md:border-r md:border-slate-200 md:dark:border-slate-700/80 md:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.35)]'
                          : ''
                      }`}
                    >
                      <span
                        className={
                          isPrompt
                            ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                            : ''
                        }
                      >
                        {col}
                      </span>
                    </th>
                  );
                })}

                <th className="py-3 px-3 text-right whitespace-nowrap md:sticky md:right-0 md:z-30 bg-slate-50 dark:bg-[#0d1422] md:border-l md:border-slate-200 md:dark:border-slate-700/80 md:shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.35)]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-sm align-top">
              {filteredRows.map((row) => {
                const isChecked = selectedIds.has(row.id);
                const rowBgClass = isChecked
                  ? 'bg-emerald-50 dark:bg-[#0b1f1a]'
                  : 'bg-white dark:bg-[#0c121e] group-hover/row:bg-slate-50 dark:group-hover/row:bg-[#11192a]';

                return (
                  <tr
                    key={row.id}
                    className={`group/row transition-colors ${
                      isChecked
                        ? 'bg-emerald-50 dark:bg-[#0b1f1a]'
                        : 'hover:bg-slate-50 dark:hover:bg-[#11192a]'
                    }`}
                  >
                    <td
                      className={`py-2.5 px-2.5 text-center md:sticky md:left-0 md:z-20 ${rowBgClass}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRowSelection(row.id)}
                        aria-label={`Select row ${primaryCol ? row.cells[primaryCol] : row.id}`}
                        className="w-4 h-4 mt-1 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-[#080c14] text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/40 cursor-pointer accent-emerald-600 dark:accent-emerald-500"
                      />
                    </td>

                    {sheet.columns.map((col, colIdx) => {
                      const val = row.cells[col] ?? '';
                      const stickyClass = stickyColumnMap.get(colIdx) ?? '';
                      const isFreezeEdge = colIdx === rightmostStickyIndex;
                      const isPrimary = col === primaryCol;
                      const isPrompt = isPromptColumn(col);
                      const isStatus = isStatusColumnName(col);
                      const navigableUrl =
                        isUrlColumnName(col) || val.includes('http')
                          ? extractNavigableUrl(val)
                          : null;
                      const useTextarea =
                        isPrompt ||
                        isLongTextColumnName(col) ||
                        val.length > 65 ||
                        val.includes('\n');

                      return (
                        <td
                          key={col}
                          className={`py-1.5 px-2 ${getColumnMinWidth(col, isPrimary)} ${stickyClass} ${
                            stickyClass ? rowBgClass : ''
                          } ${
                            isFreezeEdge
                              ? 'md:border-r md:border-slate-200 md:dark:border-slate-700/80 md:shadow-[4px_0_12px_-6px_rgba(0,0,0,0.35)]'
                              : ''
                          }`}
                        >
                          {isPrompt ? (
                            <div className="space-y-1">
                              <AutoTextarea
                                value={val}
                                placeholder="Type or draft prompt..."
                                ariaLabel={`${col} for row`}
                                onChange={(next) => onUpdateCell(row.id, col, next)}
                              />
                              <div className="px-1 flex items-center justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateCell(
                                      row.id,
                                      col,
                                      buildLeadAnalysisPrompt(row, sheet.columns)
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/25 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>Draft Lead Analysis</span>
                                </button>

                                {val.trim() && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopyText(`prompt_${row.id}`, val)
                                    }
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 rounded transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    {copiedKey === `prompt_${row.id}` ? (
                                      <>
                                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-emerald-700 dark:text-emerald-300">
                                          Copied
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3 h-3" />
                                        <span>Copy</span>
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : isStatus ? (
                            <StatusEditableCell
                              rowId={row.id}
                              column={col}
                              value={val}
                              suggestions={statusSuggestionsByCol.get(col) ?? []}
                              onCommit={(next) => onUpdateCell(row.id, col, next)}
                            />
                          ) : useTextarea ? (
                            <AutoTextarea
                              value={val}
                              placeholder="—"
                              ariaLabel={`${col} for row`}
                              onChange={(next) => onUpdateCell(row.id, col, next)}
                            />
                          ) : (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={val}
                                placeholder="—"
                                aria-label={`${col} for row`}
                                onChange={(e) =>
                                  onUpdateCell(row.id, col, e.target.value)
                                }
                                className={`w-full px-2 py-1.5 text-xs bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-600/70 dark:focus:border-emerald-500/70 focus:bg-white dark:focus:bg-[#080c14] rounded placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-colors ${
                                  isPrimary
                                    ? 'font-semibold text-slate-900 dark:text-white'
                                    : navigableUrl
                                      ? 'text-emerald-700 dark:text-emerald-300/90'
                                      : 'text-slate-800 dark:text-slate-200'
                                }`}
                              />
                              {navigableUrl && (
                                <a
                                  href={navigableUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title={`Open ${navigableUrl}`}
                                  aria-label={`Open ${col}`}
                                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-300 shrink-0"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              {isPrimary && (
                                <button
                                  type="button"
                                  onClick={() => setInspectedRowId(row.id)}
                                  title="Inspect & edit full row"
                                  aria-label="Inspect full row"
                                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-300 shrink-0 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Sticky Right Actions */}
                    <td
                      className={`py-2 px-2.5 text-right whitespace-nowrap md:sticky md:right-0 md:z-20 ${rowBgClass} md:border-l md:border-slate-200 md:dark:border-slate-700/80 md:shadow-[-4px_0_12px_-6px_rgba(0,0,0,0.35)]`}
                    >
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectedRowId(row.id)}
                          title="Expand / View Full Row"
                          aria-label="Expand / View Full Row"
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {otherSheetNames.length > 0 && (
                          <select
                            aria-label="Move row to another sheet"
                            title="Move row to another sheet"
                            value=""
                            onChange={(e) => {
                              const target = e.target.value;
                              if (target) onMoveRows([row.id], target);
                            }}
                            className="max-w-[94px] px-1.5 py-1 text-[11px] font-medium bg-slate-100 dark:bg-[#080c14] border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300 hover:border-emerald-500/60 focus:outline-none cursor-pointer"
                          >
                            <option value="">Move →</option>
                            {otherSheetNames.map((name) => (
                              <option key={name} value={name}>
                                {name}
                              </option>
                            ))}
                          </select>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteRows([row.id])}
                          title="Delete row"
                          aria-label="Delete row"
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inspectedRow && (
        <RowInspectorDrawer
          sheet={sheet}
          row={inspectedRow}
          rowIndex={inspectedIndex}
          totalRows={filteredRows.length}
          allSheetNames={allSheetNames}
          onClose={() => setInspectedRowId(null)}
          onNavigate={handleDrawerNavigate}
          onUpdateCell={onUpdateCell}
          onMoveRow={(rowId, targetSheet) => {
            onMoveRows([rowId], targetSheet);
            setInspectedRowId(null);
          }}
          onDeleteRow={(rowId) => {
            onDeleteRows([rowId]);
            setInspectedRowId(null);
          }}
        />
      )}
    </div>
  );
}
