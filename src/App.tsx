import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Upload,
  X,
} from 'lucide-react';
import { AddLeadModal } from './components/AddLeadModal';
import { AuditTable, type EditableLeadField } from './components/AuditTable';
import { ColumnMappingModal } from './components/ColumnMappingModal';
import { DuplicatesView } from './components/DuplicatesView';
import { SummaryView } from './components/SummaryView';
import type {
  ConsolidatedLead,
  ConsolidationOutput,
  DestinationTab,
  ParsedSheet,
} from './types/audit';
import { consolidateWorkbook } from './utils/consolidator';
import { exportConsolidatedWorkbook } from './utils/excelExporter';
import { mergeUrls, normalizeLeadName } from './utils/normalizer';
import { buildSampleAuditFile } from './utils/sampleWorkbook';
import { parseUploadedFiles } from './utils/workbookParser';

type ActiveTab =
  | DestinationTab
  | 'Summary'
  | 'Duplicates Merged';

interface UndoSnapshot {
  message: string;
  previousOutput: ConsolidationOutput;
  targetTab: ActiveTab;
}

const TAB_KEYS: Record<
  DestinationTab,
  'confirmed' | 'cannotVerify' | 'refuted' | 'noNeedResult'
> = {
  Confirmed: 'confirmed',
  'Cannot Verify': 'cannotVerify',
  Refuted: 'refuted',
  'No Need Result': 'noNeedResult',
};

function recalcTotals(next: ConsolidationOutput): ConsolidationOutput {
  const renumber = (list: ConsolidatedLead[]) =>
    list.map((item, idx) => ({ ...item, rowNumber: idx + 1 }));

  const confirmed = renumber(next.confirmed);
  const cannotVerify = renumber(next.cannotVerify);
  const refuted = renumber(next.refuted);
  const noNeedResult = renumber(next.noNeedResult);

  const totalUniqueLeads =
    confirmed.length + cannotVerify.length + refuted.length + noNeedResult.length;

  return {
    ...next,
    confirmed,
    cannotVerify,
    refuted,
    noNeedResult,
    totalUniqueLeads,
  };
}

function createEmptyOutput(): ConsolidationOutput {
  return {
    fileName: 'Manual Audit Tracker',
    processedAt: new Date().toISOString(),
    totalRawRows: 0,
    totalUniqueLeads: 0,
    duplicatesRemoved: 0,
    confirmed: [],
    cannotVerify: [],
    refuted: [],
    noNeedResult: [],
    duplicates: [],
    sheetBreakdowns: [],
    parsedSheets: [],
  };
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const [output, setOutput] = useState<ConsolidationOutput | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('Confirmed');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [addModalDest, setAddModalDest] = useState<DestinationTab | null>(null);
  const [undoToast, setUndoToast] = useState<UndoSnapshot | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const allLeads = useMemo(() => {
    if (!output) return [];
    return [
      ...output.confirmed,
      ...output.cannotVerify,
      ...output.refuted,
      ...output.noNeedResult,
    ];
  }, [output]);

  const pushUndoToast = (snapshot: UndoSnapshot) => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setUndoToast(snapshot);
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
    }, 8000);
  };

  const handleUndo = () => {
    if (!undoToast) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setOutput(undoToast.previousOutput);
    setActiveTab(undoToast.targetTab);
    setUndoToast(null);
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) =>
      /\.(xlsx|xls|xlsm|csv)$/i.test(f.name)
    );
    if (files.length === 0) {
      setErrorMsg('Please select an .xlsx, .xls, or .csv workbook file.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setUndoToast(null);

    try {
      const parsed = await parseUploadedFiles(files);
      const dataRowsCount = parsed
        .filter((s) => s.category !== 'SUMMARY')
        .reduce((acc, s) => acc + s.rows.length, 0);

      if (parsed.length === 0 || dataRowsCount === 0) {
        const sheetList = parsed.map((s) => s.sheetName).join(', ');
        setErrorMsg(
          parsed.length > 0
            ? `Found worksheet(s) [${sheetList}] but could not locate lead rows. Review Column Mapping to align headers.`
            : 'No readable worksheets found in the uploaded file.'
        );
        if (parsed.length > 0) {
          const fallbackOutput = consolidateWorkbook(
            files.map((f) => f.name).join(', '),
            parsed
          );
          setOutput(fallbackOutput);
          setShowMappingModal(true);
        }
        return;
      }

      const displayFileName =
        files.length === 1
          ? files[0].name
          : `${files.length} files (${files.map((f) => f.name).join(', ')})`;

      const consolidated = consolidateWorkbook(displayFileName, parsed);
      setOutput(consolidated);
      setActiveTab('Confirmed');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to parse spreadsheet file.';
      setErrorMsg(msg);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleLoadSample = async () => {
    const sampleFile = buildSampleAuditFile();
    await handleFiles([sampleFile]);
  };

  const handleStartBlank = () => {
    setOutput(createEmptyOutput());
    setActiveTab('Confirmed');
    setErrorMsg(null);
  };

  const handleExport = async () => {
    if (!output) return;
    setIsExporting(true);
    setErrorMsg(null);
    try {
      await exportConsolidatedWorkbook(output);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to generate Excel download.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateField = (
    id: string,
    status: DestinationTab,
    field: EditableLeadField,
    value: string
  ) => {
    setOutput((prev) => {
      if (!prev) return prev;
      const key = TAB_KEYS[status];
      return {
        ...prev,
        [key]: prev[key].map((item) => {
          if (item.id !== id) return item;
          const updated: ConsolidatedLead = {
            ...item,
            [field]: value,
          };
          if (field === 'name') {
            updated.normalizedKey = normalizeLeadName(value);
          }
          return updated;
        }),
      };
    });
  };

  const handleDeleteLeads = (ids: string[], status: DestinationTab) => {
    if (!output || ids.length === 0) return;
    const idSet = new Set(ids);
    const key = TAB_KEYS[status];
    const previousOutput = output;

    const updated = recalcTotals({
      ...output,
      [key]: output[key].filter((item) => !idSet.has(item.id)),
    });

    setOutput(updated);
    pushUndoToast({
      message: `Removed ${ids.length} lead${ids.length === 1 ? '' : 's'} from ${status}`,
      previousOutput,
      targetTab: status,
    });
  };

  const handleMoveLead = (
    id: string,
    fromStatus: DestinationTab,
    toStatus: DestinationTab
  ) => {
    if (!output || fromStatus === toStatus) return;
    const fromKey = TAB_KEYS[fromStatus];
    const toKey = TAB_KEYS[toStatus];
    const targetLead = output[fromKey].find((item) => item.id === id);
    if (!targetLead) return;

    const previousOutput = output;
    const movedLead: ConsolidatedLead = {
      ...targetLead,
      destination: toStatus,
    };

    const nextTargetList = [...output[toKey], movedLead].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );

    const updated = recalcTotals({
      ...output,
      [fromKey]: output[fromKey].filter((item) => item.id !== id),
      [toKey]: nextTargetList,
    });

    setOutput(updated);
    pushUndoToast({
      message: `Moved "${targetLead.name}" from ${fromStatus} to ${toStatus}`,
      previousOutput,
      targetTab: fromStatus,
    });
  };

  const handleAddLead = (draft: {
    name: string;
    url: string;
    destination: DestinationTab;
    claimVerbatim: string;
    resultExplanation: string;
    correctedPrompt: string;
  }) => {
    if (!output) return;
    const normalizedKey = normalizeLeadName(draft.name);
    const destKey = TAB_KEYS[draft.destination];
    const newLead: ConsolidatedLead = {
      id: `manual_${normalizedKey}_${Date.now()}`,
      rowNumber: 0,
      normalizedKey,
      name: draft.name,
      url: draft.url,
      destination: draft.destination,
      claimVerbatim: draft.claimVerbatim,
      resultExplanation: draft.resultExplanation,
      correctedPrompt: draft.correctedPrompt,
      sourceTabs: ['Manual Entry'],
      hasTableD: false,
      tableDReason: '',
      tableDPitch: '',
      sourceAppearances: [],
    };

    const previousOutput = output;
    const updated = recalcTotals({
      ...output,
      [destKey]: [newLead, ...output[destKey]],
    });

    setOutput(updated);
    setActiveTab(draft.destination);
    pushUndoToast({
      message: `Added "${draft.name}" to ${draft.destination}`,
      previousOutput,
      targetTab: draft.destination,
    });
  };

  const handleMoveExistingFromModal = (
    existingLead: ConsolidatedLead,
    targetDestination: DestinationTab
  ) => {
    handleMoveLead(existingLead.id, existingLead.destination, targetDestination);
    setActiveTab(targetDestination);
  };

  const handleMergeExistingFromModal = (
    existingLead: ConsolidatedLead,
    targetDestination: DestinationTab,
    updates: {
      url: string;
      claimVerbatim: string;
      resultExplanation: string;
      correctedPrompt: string;
    }
  ) => {
    if (!output) return;
    const previousOutput = output;
    const fromKey = TAB_KEYS[existingLead.destination];
    const toKey = TAB_KEYS[targetDestination];

    const mergedLead: ConsolidatedLead = {
      ...existingLead,
      destination: targetDestination,
      url: updates.url
        ? mergeUrls([existingLead.url, updates.url])
        : existingLead.url,
      claimVerbatim: updates.claimVerbatim
        ? existingLead.claimVerbatim
          ? `${existingLead.claimVerbatim}\n${updates.claimVerbatim}`
          : updates.claimVerbatim
        : existingLead.claimVerbatim,
      resultExplanation: updates.resultExplanation
        ? existingLead.resultExplanation
          ? `${existingLead.resultExplanation}\n${updates.resultExplanation}`
          : updates.resultExplanation
        : existingLead.resultExplanation,
      correctedPrompt: updates.correctedPrompt || existingLead.correctedPrompt,
    };

    let updated: ConsolidationOutput;
    if (fromKey === toKey) {
      updated = recalcTotals({
        ...output,
        [fromKey]: output[fromKey].map((item) =>
          item.id === existingLead.id ? mergedLead : item
        ),
      });
    } else {
      updated = recalcTotals({
        ...output,
        [fromKey]: output[fromKey].filter((item) => item.id !== existingLead.id),
        [toKey]: [mergedLead, ...output[toKey]],
      });
    }

    setOutput(updated);
    setActiveTab(targetDestination);
    pushUndoToast({
      message: `Merged details into "${existingLead.name}" in ${targetDestination}`,
      previousOutput,
      targetTab: existingLead.destination,
    });
  };

  const handleApplyMappings = (updatedSheets: ParsedSheet[]) => {
    if (!output) return;
    const recomputed = consolidateWorkbook(output.fileName, updatedSheets);
    setOutput(recomputed);
    setShowMappingModal(false);
    setErrorMsg(null);
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-950 text-slate-100"
      onDragOver={(e) => {
        if (output) e.preventDefault();
      }}
      onDrop={(e) => {
        if (output && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.xlsm,.csv"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
          }
        }}
      />

      {/* Top Bar Contract: 3 zones */}
      <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            Lead Audit Consolidator
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
            {(
              ['Confirmed', 'Cannot Verify', 'Refuted', 'No Need Result', 'Summary'] as ActiveTab[]
            ).map((navTab) => (
              <button
                key={navTab}
                type="button"
                onClick={() => output && setActiveTab(navTab)}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  output && activeTab === navTab ? 'text-emerald-400' : ''
                }`}
              >
                {navTab}
              </button>
            ))}
          </nav>

          <div className="flex items-center shrink-0">
            {output ? (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isExporting ? 'Generating .xlsx...' : 'Export Cleaned Excel (.xlsx)'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={triggerFilePicker}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload Workbook</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 space-y-6">
        {errorMsg && (
          <div
            role="alert"
            className="bg-rose-950/60 border border-rose-500/40 text-rose-200 rounded-lg px-5 py-3.5 text-sm flex items-center justify-between gap-4"
          >
            <span>{errorMsg}</span>
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="text-xs font-medium underline underline-offset-2 shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {!output ? (
          /* Drag-and-Drop Intake */
          <div className="max-w-4xl mx-auto py-8 space-y-8">
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                Restaurant Lead Audit Consolidator
              </h1>
              <p className="text-base text-slate-400 leading-relaxed max-w-2xl">
                Drop your multi-sheet <span className="font-mono text-sm text-emerald-400">.xlsx</span> workbook to deduplicate leads across tabs, edit every cell inline, add leads manually, and export the exact 6-column Excel tracker.
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files.length > 0) {
                  handleFiles(e.dataTransfer.files);
                }
              }}
              className={`bg-slate-900 border-2 border-dashed rounded-xl p-14 flex flex-col items-center justify-center text-center transition-colors ${
                isDragging
                  ? 'border-emerald-400 bg-emerald-950/20'
                  : 'border-slate-700 hover:border-emerald-500/50'
              }`}
            >
              <div className="w-14 h-14 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-7 h-7 text-emerald-400" />
              </div>

              <h2 className="text-xl font-semibold text-white">
                {isProcessing
                  ? 'Parsing and deduplicating worksheets...'
                  : 'Drag & drop your Claim audit tracker.xlsx'}
              </h2>
              <p className="text-sm text-slate-400 mt-2 max-w-md">
                Automatically extracts Name, URL, Destination, verbatim Claim, verbatim AI Result / Explanation, and leaves Corrected Prompt blank for your edits.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select .xlsx / .xls File</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load Sample Workbook
                </button>

                <button
                  type="button"
                  onClick={handleStartBlank}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-300 bg-slate-950 border border-slate-800 hover:border-slate-600 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start Blank Tracker</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Workspace */
          <div className="space-y-6">
            {/* Workspace Control Strip */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-white truncate">
                  {output.fileName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                  <span>{output.totalRawRows} raw rows</span>
                  <span aria-hidden="true">·</span>
                  <span>{output.sheetBreakdowns.length} data sheets</span>
                  <span aria-hidden="true">·</span>
                  <span>{output.duplicatesRemoved} duplicates eliminated</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {output.parsedSheets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMappingModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Column Mapping</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-950 border border-slate-700 hover:border-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load New Workbook</span>
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExporting ? 'Exporting...' : 'Export Cleaned Excel (.xlsx)'}
                  </span>
                </button>
              </div>
            </div>

            {/* 6-Card Executive KPI Dashboard */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <button
                type="button"
                onClick={() => setActiveTab('Summary')}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-4 py-3.5 text-left transition-colors cursor-pointer"
              >
                <div className="text-xs font-medium text-slate-400">Total Unique Leads</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {output.totalUniqueLeads.toLocaleString()}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('Confirmed')}
                className={`bg-slate-900 border rounded-lg px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  activeTab === 'Confirmed'
                    ? 'border-emerald-500/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium text-emerald-400">Confirmed</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {output.confirmed.length.toLocaleString()}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('Cannot Verify')}
                className={`bg-slate-900 border rounded-lg px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  activeTab === 'Cannot Verify'
                    ? 'border-amber-500/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium text-amber-400">Cannot Verify</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {output.cannotVerify.length.toLocaleString()}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('Refuted')}
                className={`bg-slate-900 border rounded-lg px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  activeTab === 'Refuted'
                    ? 'border-rose-500/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium text-rose-400">Refuted</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {output.refuted.length.toLocaleString()}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('No Need Result')}
                className={`bg-slate-900 border rounded-lg px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  activeTab === 'No Need Result'
                    ? 'border-sky-500/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium text-sky-400">No Need Result</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-white mt-1">
                  {output.noNeedResult.length.toLocaleString()}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('Duplicates Merged')}
                className={`bg-slate-900 border rounded-lg px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  activeTab === 'Duplicates Merged'
                    ? 'border-emerald-500/60'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-medium text-slate-400">Duplicates Merged</div>
                <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                  {output.duplicatesRemoved.toLocaleString()}
                </div>
              </button>
            </div>

            {/* Dedicated Page Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'Confirmed', count: output.confirmed.length },
                  { id: 'Cannot Verify', count: output.cannotVerify.length },
                  { id: 'Refuted', count: output.refuted.length },
                  { id: 'No Need Result', count: output.noNeedResult.length },
                  { id: 'Duplicates Merged', count: output.duplicates.length },
                  { id: 'Summary', count: output.totalUniqueLeads },
                ] as { id: ActiveTab; count: number }[]
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-slate-100 border border-transparent'
                    }`}
                  >
                    <span>{tab.id}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        isActive ? 'text-emerald-200' : 'text-slate-500'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Page View */}
            {activeTab === 'Confirmed' && (
              <AuditTable
                status="Confirmed"
                rows={output.confirmed}
                availableSheets={output.sheetBreakdowns.map((s) => s.sheetName)}
                onOpenAddLead={() => setAddModalDest('Confirmed')}
                onUpdateField={handleUpdateField}
                onMoveLead={handleMoveLead}
                onDeleteLeads={handleDeleteLeads}
              />
            )}

            {activeTab === 'Cannot Verify' && (
              <AuditTable
                status="Cannot Verify"
                rows={output.cannotVerify}
                availableSheets={output.sheetBreakdowns.map((s) => s.sheetName)}
                onOpenAddLead={() => setAddModalDest('Cannot Verify')}
                onUpdateField={handleUpdateField}
                onMoveLead={handleMoveLead}
                onDeleteLeads={handleDeleteLeads}
              />
            )}

            {activeTab === 'Refuted' && (
              <AuditTable
                status="Refuted"
                rows={output.refuted}
                availableSheets={output.sheetBreakdowns.map((s) => s.sheetName)}
                onOpenAddLead={() => setAddModalDest('Refuted')}
                onUpdateField={handleUpdateField}
                onMoveLead={handleMoveLead}
                onDeleteLeads={handleDeleteLeads}
              />
            )}

            {activeTab === 'No Need Result' && (
              <AuditTable
                status="No Need Result"
                rows={output.noNeedResult}
                availableSheets={output.sheetBreakdowns.map((s) => s.sheetName)}
                onOpenAddLead={() => setAddModalDest('No Need Result')}
                onUpdateField={handleUpdateField}
                onMoveLead={handleMoveLead}
                onDeleteLeads={handleDeleteLeads}
              />
            )}

            {activeTab === 'Duplicates Merged' && (
              <DuplicatesView duplicates={output.duplicates} />
            )}

            {activeTab === 'Summary' && (
              <SummaryView
                output={output}
                onJumpToTab={(tab) => setActiveTab(tab)}
              />
            )}
          </div>
        )}
      </main>

      {/* 1-Click Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 border border-emerald-500/40 shadow-xl rounded-lg px-4 py-3 flex items-center gap-4 text-sm">
          <span className="text-slate-100">{undoToast.message}</span>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setUndoToast(null)}
            aria-label="Dismiss undo notification"
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <footer className="border-t border-slate-900 bg-slate-950 mt-12">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>Lead Audit Consolidator</span>
          <span>Client-side SheetJS parsing, inline editing, and 6-column Excel export.</span>
        </div>
      </footer>

      {addModalDest && output && (
        <AddLeadModal
          defaultDestination={addModalDest}
          allLeads={allLeads}
          onClose={() => setAddModalDest(null)}
          onAddLead={handleAddLead}
          onMoveExisting={handleMoveExistingFromModal}
          onMergeExisting={handleMergeExistingFromModal}
        />
      )}

      {showMappingModal && output && (
        <ColumnMappingModal
          sheets={output.parsedSheets}
          onClose={() => setShowMappingModal(false)}
          onApplyMappings={handleApplyMappings}
        />
      )}
    </div>
  );
}
