import { useEffect, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import type { UniversalRow, UniversalSheet } from '../types/audit';
import {
  buildLeadAnalysisPrompt,
  extractNavigableUrl,
  findPrimaryNameColumn,
  getStatusTone,
  getUniqueColumnValues,
  isLongTextColumnName,
  isPromptColumn,
  isStatusColumnName,
  isUrlColumnName,
} from '../utils/cellHelpers';

interface RowInspectorDrawerProps {
  sheet: UniversalSheet;
  row: UniversalRow;
  rowIndex: number;
  totalRows: number;
  allSheetNames: string[];
  onClose: () => void;
  onNavigate: (direction: 'prev' | 'next') => void;
  onUpdateCell: (rowId: string, column: string, value: string) => void;
  onMoveRow: (rowId: string, targetSheetName: string) => void;
  onDeleteRow: (rowId: string) => void;
}

export function RowInspectorDrawer({
  sheet,
  row,
  rowIndex,
  totalRows,
  allSheetNames,
  onClose,
  onNavigate,
  onUpdateCell,
  onMoveRow,
  onDeleteRow,
}: RowInspectorDrawerProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const primaryCol = findPrimaryNameColumn(sheet.columns);
  const leadTitle = (primaryCol ? row.cells[primaryCol] : '')?.trim() || 'Untitled Row';

  const handleCopy = async (key: string, text: string) => {
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

  const handleCopyAllFields = () => {
    const formatted = sheet.columns
      .map((col) => `${col}: ${row.cells[col] ?? ''}`)
      .join('\n');
    handleCopy('all_fields', formatted);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-black/70 backdrop-blur-[1px] flex justify-end"
      onClick={onClose}
    >
      <aside
        aria-label="Row inspector drawer"
        className="w-full max-w-2xl bg-white dark:bg-[#0c121e] border-l border-slate-200 dark:border-slate-800 h-full flex flex-col text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{sheet.name}</span>
              <span aria-hidden="true">·</span>
              <span>
                Row {rowIndex + 1} of {totalRows}
              </span>
              <span aria-hidden="true">·</span>
              <span>{sheet.columns.length} columns</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-1 truncate">
              {leadTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('prev')}
              disabled={rowIndex <= 0}
              title="Previous row"
              aria-label="Previous row"
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('next')}
              disabled={rowIndex >= totalRows - 1}
              title="Next row"
              aria-label="Next row"
              className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close inspector"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Action Strip */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080c14] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {allSheetNames.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="whitespace-nowrap">Move to tab:</span>
                <select
                  value={sheet.name}
                  onChange={(e) => {
                    const target = e.target.value;
                    if (target && target !== sheet.name) {
                      onMoveRow(row.id, target);
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                >
                  {allSheetNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllFields}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors whitespace-nowrap cursor-pointer"
            >
              {copiedKey === 'all_fields' ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied All</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy All Fields</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onDeleteRow(row.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-md hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Row</span>
            </button>
          </div>
        </div>

        {/* All Columns Vertical Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {sheet.columns.map((col, colIdx) => {
            const value = row.cells[col] ?? '';
            const isPrompt = isPromptColumn(col);
            const isStatus = isStatusColumnName(col);
            const navigableUrl = isUrlColumnName(col) || value.includes('http')
              ? extractNavigableUrl(value)
              : null;
            const useTextarea =
              isPrompt ||
              isLongTextColumnName(col) ||
              value.length > 70 ||
              value.includes('\n');
            const suggestions = isStatus ? getUniqueColumnValues(sheet, col) : [];
            const datalistId = isStatus ? `drawer-list-${colIdx}` : undefined;
            const tone = isStatus ? getStatusTone(value) : null;

            return (
              <div key={col} className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <label
                      htmlFor={`drawer-field-${colIdx}`}
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-mono"
                    >
                      {col}
                    </label>
                    {isStatus && value.trim() && tone && (
                      <span
                        className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${tone.badgeClass}`}
                      >
                        {value}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isPrompt && (
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateCell(
                            row.id,
                            col,
                            buildLeadAnalysisPrompt(row, sheet.columns)
                          )
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Draft Lead Analysis</span>
                      </button>
                    )}

                    {navigableUrl && (
                      <a
                        href={navigableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded transition-colors"
                      >
                        <span>Open</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={!value}
                      onClick={() => handleCopy(`field_${colIdx}`, value)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-35 rounded transition-colors cursor-pointer"
                    >
                      {copiedKey === `field_${colIdx}` ? (
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
                  </div>
                </div>

                {useTextarea ? (
                  <textarea
                    id={`drawer-field-${colIdx}`}
                    rows={isPrompt ? 6 : Math.min(8, Math.max(3, Math.ceil(value.length / 75)))}
                    value={value}
                    placeholder={`Enter ${col}...`}
                    onChange={(e) => onUpdateCell(row.id, col, e.target.value)}
                    className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 focus:border-emerald-500/70"
                  />
                ) : (
                  <>
                    <input
                      id={`drawer-field-${colIdx}`}
                      type="text"
                      list={datalistId}
                      value={value}
                      placeholder={`Enter ${col}...`}
                      onChange={(e) => onUpdateCell(row.id, col, e.target.value)}
                      className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 rounded-md placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/35 focus:border-emerald-500/70 ${
                        navigableUrl
                          ? 'text-emerald-700 dark:text-emerald-300 font-mono'
                          : col === primaryCol
                            ? 'text-slate-900 dark:text-white font-semibold'
                            : 'text-slate-900 dark:text-slate-100'
                      }`}
                    />
                    {datalistId && suggestions.length > 0 && (
                      <datalist id={datalistId}>
                        {suggestions.map((opt) => (
                          <option key={opt} value={opt} />
                        ))}
                      </datalist>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
