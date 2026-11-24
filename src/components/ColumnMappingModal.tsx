import { useState } from 'react';
import { X } from 'lucide-react';
import type { ColumnMapping, ParsedSheet, SheetCategory } from '../types/audit';
import { extractRowsWithMapping } from '../utils/workbookParser';

interface ColumnMappingModalProps {
  sheets: ParsedSheet[];
  onClose: () => void;
  onApplyMappings: (updatedSheets: ParsedSheet[]) => void;
}

const MAPPING_FIELDS: { key: keyof ColumnMapping; label: string }[] = [
  { key: 'leadCol', label: 'Lead / Restaurant' },
  { key: 'resultCol', label: 'Result / Verdict' },
  { key: 'urlCol', label: 'URL / Social' },
  { key: 'claimCol', label: 'Claim / Finding' },
  { key: 'evidenceCol', label: 'Evidence' },
  { key: 'explanationCol', label: 'Explanation' },
  { key: 'aiResultCol', label: 'AI Result' },
  { key: 'reasonCol', label: 'Table D Reason' },
  { key: 'pitchCol', label: 'Corrected Pitch Angle' },
  { key: 'notesCol', label: 'Notes / Fine-Dining Rule' },
  { key: 'indexCol', label: '# Index' },
];

const CATEGORIES: { value: SheetCategory; label: string }[] = [
  { value: 'A1', label: 'A1 HIGH' },
  { value: 'A2', label: 'A2 PARTIAL' },
  { value: 'A3', label: 'A3 LOW' },
  { value: 'B', label: 'B Phone Check' },
  { value: 'C', label: 'C Marketplace' },
  { value: 'D', label: 'Table D (Rewrite / No Verify)' },
  { value: 'SUMMARY', label: 'Summary / Instructions (Ignore)' },
  { value: 'OTHER', label: 'Other Data Sheet' },
];

export function ColumnMappingModal({
  sheets,
  onClose,
  onApplyMappings,
}: ColumnMappingModalProps) {
  const [drafts, setDrafts] = useState<ParsedSheet[]>(() =>
    sheets.map((s) => ({
      ...s,
      mapping: { ...s.mapping },
    }))
  );

  const updateField = (sheetIdx: number, field: keyof ColumnMapping, value: string) => {
    setDrafts((prev) =>
      prev.map((sheet, idx) =>
        idx === sheetIdx
          ? {
              ...sheet,
              mapping: {
                ...sheet.mapping,
                [field]: value || null,
              },
            }
          : sheet
      )
    );
  };

  const updateCategory = (sheetIdx: number, category: SheetCategory) => {
    setDrafts((prev) =>
      prev.map((sheet, idx) => (idx === sheetIdx ? { ...sheet, category } : sheet))
    );
  };

  const handleApply = () => {
    const recomputed = drafts.map((sheet) => ({
      ...sheet,
      rows:
        sheet.category === 'SUMMARY'
          ? []
          : extractRowsWithMapping(
              sheet.sheetName,
              sheet.category,
              sheet.rawMatrix,
              sheet.headerRowIndex,
              sheet.headers,
              sheet.mapping
            ),
    }));
    onApplyMappings(recomputed);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/65 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Detected Worksheet & Column Mappings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verify or adjust how columns in each uploaded worksheet map to the consolidated schema.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close column mapping"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {drafts.map((sheet, idx) => (
            <div
              key={sheet.sheetName}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-4 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{sheet.sheetName}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400 ml-3">
                    Header row #{sheet.headerRowIndex + 1} · {sheet.rows.length} rows
                  </span>
                </div>

                <select
                  value={sheet.category}
                  onChange={(e) => updateCategory(idx, e.target.value as SheetCategory)}
                  className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {sheet.category !== 'SUMMARY' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {MAPPING_FIELDS.map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">{label}</label>
                      <select
                        value={sheet.mapping[key] || ''}
                        onChange={(e) => updateField(idx, key, e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                      >
                        <option value="">— Not mapped —</option>
                        {sheet.headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 dark:hover:bg-emerald-500 cursor-pointer"
          >
            Re-run Consolidation
          </button>
        </div>
      </div>
    </div>
  );
}
