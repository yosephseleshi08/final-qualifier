import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { ConsolidatedLead, DestinationTab } from '../types/audit';

export type EditableLeadField =
  | 'name'
  | 'url'
  | 'claimVerbatim'
  | 'resultExplanation'
  | 'correctedPrompt';

interface AuditTableProps {
  status: DestinationTab;
  rows: ConsolidatedLead[];
  availableSheets: string[];
  onOpenAddLead: () => void;
  onUpdateField: (
    id: string,
    status: DestinationTab,
    field: EditableLeadField,
    value: string
  ) => void;
  onMoveLead: (
    id: string,
    fromStatus: DestinationTab,
    toStatus: DestinationTab
  ) => void;
  onDeleteLeads: (ids: string[], status: DestinationTab) => void;
}

const DESTINATION_TABS: DestinationTab[] = [
  'Confirmed',
  'Cannot Verify',
  'Refuted',
  'No Need Result',
];

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
    el.style.height = `${Math.min(300, Math.max(40, el.scrollHeight))}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-2 py-1.5 text-xs leading-relaxed bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-600/70 dark:focus:border-emerald-500/70 focus:bg-white dark:focus:bg-slate-950 rounded text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none resize-none transition-colors"
    />
  );
}

export function AuditTable({
  status,
  rows,
  availableSheets,
  onOpenAddLead,
  onUpdateField,
  onMoveLead,
  onDeleteLeads,
}: AuditTableProps) {
  const [search, setSearch] = useState('');
  const [sheetFilter, setSheetFilter] = useState('ALL');
  const [onlyMultiTab, setOnlyMultiTab] = useState(false);
  const [onlyTableD, setOnlyTableD] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const validIds = new Set(rows.map((r) => r.id));
    setSelectedIds((prev) => {
      const next = new Set<string>();
      prev.forEach((id) => {
        if (validIds.has(id)) next.add(id);
      });
      return next.size === prev.size ? prev : next;
    });
    if (inspectedId && !validIds.has(inspectedId)) {
      setInspectedId(null);
    }
  }, [rows, inspectedId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sheetFilter !== 'ALL' && !row.sourceTabs.includes(sheetFilter)) {
        return false;
      }
      if (onlyMultiTab && row.sourceTabs.length < 2) {
        return false;
      }
      if (onlyTableD && !row.hasTableD) {
        return false;
      }
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.url.toLowerCase().includes(q) ||
        row.claimVerbatim.toLowerCase().includes(q) ||
        row.resultExplanation.toLowerCase().includes(q) ||
        row.correctedPrompt.toLowerCase().includes(q) ||
        row.sourceTabs.join(' ').toLowerCase().includes(q)
      );
    });
  }, [rows, search, sheetFilter, onlyMultiTab, onlyTableD]);

  const inspectedLead = useMemo(
    () => (inspectedId ? rows.find((r) => r.id === inspectedId) || null : null),
    [rows, inspectedId]
  );

  const visibleIds = useMemo(() => filtered.map((r) => r.id), [filtered]);
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    onDeleteLeads(Array.from(selectedIds), status);
    setSelectedIds(new Set());
  };

  const handleCopyText = async (key: string, text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => {
        setCopiedId((curr) => (curr === key ? null : curr));
      }, 1800);
    } catch {
      // Clipboard blocked in restricted frames
    }
  };

  const destinationSelectTone =
    status === 'Confirmed'
      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
      : status === 'Cannot Verify'
        ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
        : status === 'Refuted'
          ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
          : 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/10 border-sky-200 dark:border-sky-500/30';

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${status} by name, URL, claim, explanation, or prompt...`}
                className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setOnlyMultiTab((v) => !v)}
              className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyMultiTab
                  ? 'bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Multi-Tab Merged
            </button>

            <button
              type="button"
              onClick={() => setOnlyTableD((v) => !v)}
              className={`px-3 py-2 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                onlyTableD
                  ? 'bg-emerald-600 text-white border-emerald-600 dark:border-emerald-500'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Has Table D Enrichment
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={onOpenAddLead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Lead</span>
            </button>
          </div>
        </div>

        {/* Source Tab Filter Buttons */}
        {availableSheets.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setSheetFilter('ALL')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sheetFilter === 'ALL'
                  ? 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-slate-300 dark:border-slate-700'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
              }`}
            >
              All Tabs
            </button>
            {availableSheets.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSheetFilter(s === sheetFilter ? 'ALL' : s)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sheetFilter === s
                    ? 'bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border border-slate-300 dark:border-slate-700'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Bulk Selection Bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-500/30 rounded-md">
            <div className="text-xs font-medium text-emerald-800 dark:text-emerald-200 font-mono tabular-nums">
              {selectedIds.size} lead{selectedIds.size === 1 ? '' : 's'} selected
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Clear Selection
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editable 6-Column Spreadsheet Grid */}
      {filtered.length === 0 ? (
        <div className="px-6 py-16 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {rows.length === 0
              ? `No leads in ${status} yet`
              : `No leads in ${status} match your filter`}
          </p>
          <div>
            <button
              type="button"
              onClick={onOpenAddLead}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Lead to {status}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someVisibleSelected;
                    }}
                    onChange={toggleSelectAllVisible}
                    aria-label="Select all visible leads"
                    className="w-4 h-4 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/40 cursor-pointer accent-emerald-600 dark:accent-emerald-500"
                  />
                </th>
                <th className="py-3 px-3 min-w-[175px]">Name</th>
                <th className="py-3 px-3 min-w-[185px]">URL</th>
                <th className="py-3 px-3 min-w-[145px]">Destination</th>
                <th className="py-3 px-3 min-w-[240px]">Claim (verbatim)</th>
                <th className="py-3 px-3 min-w-[270px]">Result Explanation</th>
                <th className="py-3 px-3 min-w-[220px]">Corrected Prompt</th>
                <th className="py-3 px-3 text-right w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 text-sm align-top">
              {filtered.map((item) => {
                const isChecked = selectedIds.has(item.id);
                const firstUrl = item.url.split(' | ')[0]?.trim() || '';
                const hasValidLink =
                  /^https?:\/\//i.test(firstUrl) || /\.[a-z]{2,}(\/|$)/i.test(firstUrl);
                const linkHref = /^https?:\/\//i.test(firstUrl)
                  ? firstUrl
                  : `https://${firstUrl}`;

                return (
                  <tr
                    key={item.id}
                    className={`transition-colors ${
                      isChecked
                        ? 'bg-emerald-50/70 hover:bg-emerald-50 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/35'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                    }`}
                  >
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleRowSelection(item.id)}
                        aria-label={`Select ${item.name}`}
                        className="w-4 h-4 mt-1.5 rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-500 focus:ring-emerald-500/40 cursor-pointer accent-emerald-600 dark:accent-emerald-500"
                      />
                    </td>

                    {/* Column A: Name */}
                    <td className="py-2 px-2">
                      <input
                        type="text"
                        value={item.name}
                        aria-label={`Name for ${item.name}`}
                        onChange={(e) =>
                          onUpdateField(item.id, status, 'name', e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-xs font-semibold bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-600/70 dark:focus:border-emerald-500/70 focus:bg-white dark:focus:bg-slate-950 rounded text-slate-900 dark:text-white focus:outline-none transition-colors"
                      />
                      {item.sourceTabs.length > 0 && (
                        <div className="px-2 text-[11px] text-slate-500 truncate max-w-[175px]">
                          {item.sourceTabs.join(' · ')}
                        </div>
                      )}
                    </td>

                    {/* Column B: URL */}
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={item.url}
                          placeholder="—"
                          aria-label={`URL for ${item.name}`}
                          onChange={(e) =>
                            onUpdateField(item.id, status, 'url', e.target.value)
                          }
                          className="w-full px-2 py-1.5 text-xs bg-transparent border border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-emerald-600/70 dark:focus:border-emerald-500/70 focus:bg-white dark:focus:bg-slate-950 rounded text-emerald-700 dark:text-emerald-300/90 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none transition-colors"
                        />
                        {hasValidLink && (
                          <a
                            href={linkHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open ${firstUrl}`}
                            aria-label={`Open link for ${item.name}`}
                            className="p-1 text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-300 shrink-0"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Column C: Destination Dropdown */}
                    <td className="py-2 px-2">
                      <select
                        value={item.destination}
                        aria-label={`Destination for ${item.name}`}
                        onChange={(e) => {
                          const nextDest = e.target.value as DestinationTab;
                          if (nextDest !== item.destination) {
                            onMoveLead(item.id, item.destination, nextDest);
                          }
                        }}
                        className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer ${destinationSelectTone}`}
                      >
                        {DESTINATION_TABS.map((tab) => (
                          <option
                            key={tab}
                            value={tab}
                            className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                          >
                            {tab}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Column D: Claim (verbatim) */}
                    <td className="py-2 px-2">
                      <AutoTextarea
                        value={item.claimVerbatim}
                        placeholder="Enter claim..."
                        ariaLabel={`Claim (verbatim) for ${item.name}`}
                        onChange={(val) =>
                          onUpdateField(item.id, status, 'claimVerbatim', val)
                        }
                      />
                    </td>

                    {/* Column E: Result Explanation */}
                    <td className="py-2 px-2">
                      <AutoTextarea
                        value={item.resultExplanation}
                        placeholder="Enter explanation..."
                        ariaLabel={`Result Explanation for ${item.name}`}
                        onChange={(val) =>
                          onUpdateField(item.id, status, 'resultExplanation', val)
                        }
                      />
                    </td>

                    {/* Column F: Corrected Prompt (manual) */}
                    <td className="py-2 px-2">
                      <div className="space-y-1">
                        <AutoTextarea
                          value={item.correctedPrompt}
                          placeholder="Type corrected prompt..."
                          ariaLabel={`Corrected Prompt for ${item.name}`}
                          onChange={(val) =>
                            onUpdateField(item.id, status, 'correctedPrompt', val)
                          }
                        />
                        {item.correctedPrompt.trim() && (
                          <div className="px-1 flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(`row_prompt_${item.id}`, item.correctedPrompt)
                              }
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 rounded transition-colors whitespace-nowrap cursor-pointer"
                            >
                              {copiedId === `row_prompt_${item.id}` ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                  <span className="text-emerald-700 dark:text-emerald-300">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Row Actions */}
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspectedId(item.id)}
                          title="View & edit all 6 columns"
                          aria-label={`Inspect ${item.name}`}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLeads([item.id], status)}
                          title="Delete lead"
                          aria-label={`Delete ${item.name}`}
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

      {/* Lead View & Edit Drawer (All 6 Columns Editable & Copyable) */}
      {inspectedLead && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-[1px] flex justify-end"
          onClick={() => setInspectedId(null)}
        >
          <div
            className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 flex flex-col gap-5 text-slate-900 dark:text-slate-100 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Key: {inspectedLead.normalizedKey}
                  {inspectedLead.sourceTabs.length > 0
                    ? ` · ${inspectedLead.sourceTabs.join(' · ')}`
                    : ''}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white mt-1 truncate">
                  {inspectedLead.name || 'Untitled Lead'}
                </h3>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const allText = [
                      `Name: ${inspectedLead.name}`,
                      `URL: ${inspectedLead.url}`,
                      `Destination: ${inspectedLead.destination}`,
                      `Claim (verbatim): ${inspectedLead.claimVerbatim}`,
                      `Result Explanation: ${inspectedLead.resultExplanation}`,
                      `Corrected Prompt: ${inspectedLead.correctedPrompt}`,
                    ].join('\n');
                    handleCopyText('all_fields', allText);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors cursor-pointer"
                >
                  {copiedId === 'all_fields' ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied All</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy All 6 Fields</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectedId(null)}
                  aria-label="Close inspector"
                  className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 1. Name */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="drawer-name"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Name
                </label>
                <button
                  type="button"
                  disabled={!inspectedLead.name}
                  onClick={() => handleCopyText('drawer_name', inspectedLead.name)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
                >
                  {copiedId === 'drawer_name' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <input
                id="drawer-name"
                type="text"
                value={inspectedLead.name}
                onChange={(e) =>
                  onUpdateField(inspectedLead.id, status, 'name', e.target.value)
                }
                className="w-full px-3 py-2 text-sm font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
              />
            </div>

            {/* 2. URL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="drawer-url"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  URL
                </label>
                <div className="flex items-center gap-2">
                  {inspectedLead.url.trim() && (
                    <a
                      href={
                        /^https?:\/\//i.test(inspectedLead.url.split(' | ')[0].trim())
                          ? inspectedLead.url.split(' | ')[0].trim()
                          : `https://${inspectedLead.url.split(' | ')[0].trim()}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={!inspectedLead.url}
                    onClick={() => handleCopyText('drawer_url', inspectedLead.url)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
                  >
                    {copiedId === 'drawer_url' ? (
                      <>
                        <Check className="w-3 h-3" />
                        <span>Copied</span>
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
              <input
                id="drawer-url"
                type="text"
                value={inspectedLead.url}
                placeholder="https://..."
                onChange={(e) =>
                  onUpdateField(inspectedLead.id, status, 'url', e.target.value)
                }
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-emerald-700 dark:text-emerald-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
              />
            </div>

            {/* 3. Destination */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="drawer-destination"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Destination
                </label>
                <button
                  type="button"
                  onClick={() =>
                    handleCopyText('drawer_destination', inspectedLead.destination)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer"
                >
                  {copiedId === 'drawer_destination' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <select
                id="drawer-destination"
                value={inspectedLead.destination}
                onChange={(e) => {
                  const nextDest = e.target.value as DestinationTab;
                  if (nextDest !== inspectedLead.destination) {
                    onMoveLead(inspectedLead.id, inspectedLead.destination, nextDest);
                    setInspectedId(null);
                  }
                }}
                className={`w-full px-3 py-2 text-xs font-semibold rounded-md border focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer ${destinationSelectTone}`}
              >
                {DESTINATION_TABS.map((tab) => (
                  <option
                    key={tab}
                    value={tab}
                    className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  >
                    {tab}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Claim (verbatim) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="drawer-claim"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Claim (verbatim)
                </label>
                <button
                  type="button"
                  disabled={!inspectedLead.claimVerbatim}
                  onClick={() =>
                    handleCopyText('drawer_claim', inspectedLead.claimVerbatim)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
                >
                  {copiedId === 'drawer_claim' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="drawer-claim"
                rows={3}
                value={inspectedLead.claimVerbatim}
                placeholder="Enter claim..."
                onChange={(e) =>
                  onUpdateField(
                    inspectedLead.id,
                    status,
                    'claimVerbatim',
                    e.target.value
                  )
                }
                className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* 5. Result Explanation */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="drawer-explanation"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Result Explanation
                </label>
                <button
                  type="button"
                  disabled={!inspectedLead.resultExplanation}
                  onClick={() =>
                    handleCopyText('drawer_explanation', inspectedLead.resultExplanation)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
                >
                  {copiedId === 'drawer_explanation' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="drawer-explanation"
                rows={4}
                value={inspectedLead.resultExplanation}
                placeholder="Enter result explanation..."
                onChange={(e) =>
                  onUpdateField(
                    inspectedLead.id,
                    status,
                    'resultExplanation',
                    e.target.value
                  )
                }
                className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {/* 6. Corrected Prompt */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="drawer-prompt"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Corrected Prompt
                </label>
                <button
                  type="button"
                  disabled={!inspectedLead.correctedPrompt}
                  onClick={() =>
                    handleCopyText('drawer_prompt', inspectedLead.correctedPrompt)
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 disabled:opacity-40 cursor-pointer"
                >
                  {copiedId === 'drawer_prompt' ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                id="drawer-prompt"
                rows={5}
                value={inspectedLead.correctedPrompt}
                placeholder="Type your corrected prompt..."
                onChange={(e) =>
                  onUpdateField(
                    inspectedLead.id,
                    status,
                    'correctedPrompt',
                    e.target.value
                  )
                }
                className="w-full p-3 text-xs leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            {inspectedLead.hasTableD && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                    Table D Reference Intelligence
                  </span>
                  {inspectedLead.tableDPitch && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText('tabled', inspectedLead.tableDPitch)
                      }
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-white dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer"
                    >
                      {copiedId === 'tabled' ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Pitch</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
                {inspectedLead.tableDReason && (
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <span className="font-semibold text-slate-900 dark:text-white">Reason: </span>
                    {inspectedLead.tableDReason}
                  </p>
                )}
                {inspectedLead.tableDPitch && (
                  <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      Corrected one-sentence pitch angle:{' '}
                    </span>
                    {inspectedLead.tableDPitch}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Raw Cross-Sheet Appearances ({inspectedLead.sourceAppearances.length})
              </h4>
              {inspectedLead.sourceAppearances.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Manually added lead (no imported worksheet rows).
                </p>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-950">
                  {inspectedLead.sourceAppearances.map((app, i) => (
                    <div key={i} className="p-4 text-xs space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {app.sheetName} · Raw Lead: {app.rawLead}
                        </span>
                        <span className="font-mono text-emerald-700 dark:text-emerald-300">
                          {app.rawResult} → {app.rowClassification}
                        </span>
                      </div>
                      {app.claimVerbatim && (
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            Claim (verbatim):{' '}
                          </span>
                          {app.claimVerbatim}
                        </p>
                      )}
                      {app.resultExplanation && (
                        <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            Result Explanation:{' '}
                          </span>
                          {app.resultExplanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
