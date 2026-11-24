import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { UniversalSheetGrid } from './components/UniversalSheetGrid';
import type {
  SheetFilterState,
  UniversalRow,
  UniversalSheet,
  UniversalWorkbook,
} from './types/audit';
import { exportUniversalWorkbook } from './utils/excelExporter';
import { buildSampleAuditFile } from './utils/sampleWorkbook';
import { parseUniversalFiles } from './utils/workbookParser';

const STORAGE_KEY = 'ridge_universal_lead_audit_v1';

interface UndoSnapshot {
  message: string;
  previousWorkbook: UniversalWorkbook;
  targetSheetName: string;
}

function loadSavedWorkbook(): UniversalWorkbook | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UniversalWorkbook;
    if (
      parsed &&
      typeof parsed.fileName === 'string' &&
      Array.isArray(parsed.sheets) &&
      parsed.sheets.length > 0
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function createBlankWorkbook(): UniversalWorkbook {
  const now = new Date().toISOString();
  const defaultCols = [
    'lead_id',
    'display_name',
    'city',
    'state',
    'website',
    'verdict',
    'proven_fact',
    'target_trigger',
    'channel',
    'contact_value',
    'batch',
    'Prompt',
  ];

  return {
    fileName: 'Blank Lead Audit Workbook',
    loadedAt: now,
    updatedAt: now,
    sheets: [
      {
        id: `sheet_blank_${Date.now()}`,
        name: 'SEND-NOW',
        columns: defaultCols,
        promptInjected: false,
        rows: [],
      },
      {
        id: `sheet_verify_${Date.now() + 1}`,
        name: 'VERIFY-FIRST',
        columns: [...defaultCols],
        promptInjected: false,
        rows: [],
      },
    ],
  };
}

export default function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  const [workbook, setWorkbook] = useState<UniversalWorkbook | null>(() =>
    loadSavedWorkbook()
  );
  const [activeSheetName, setActiveSheetName] = useState<string>(() => {
    const saved = loadSavedWorkbook();
    return saved?.sheets[0]?.name ?? '';
  });
  const [filtersBySheet, setFiltersBySheet] = useState<
    Record<string, SheetFilterState>
  >({});
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<UndoSnapshot | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem('audit-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('audit-theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  useEffect(() => {
    try {
      if (workbook) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workbook));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage quota errors
    }
  }, [workbook]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, []);

  const activeSheet: UniversalSheet | null = useMemo(() => {
    if (!workbook || workbook.sheets.length === 0) return null;
    return (
      workbook.sheets.find((s) => s.name === activeSheetName) ??
      workbook.sheets[0]
    );
  }, [workbook, activeSheetName]);

  const totalRowsCount = useMemo(() => {
    if (!workbook) return 0;
    return workbook.sheets.reduce((sum, sheet) => sum + sheet.rows.length, 0);
  }, [workbook]);

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
    setWorkbook(undoToast.previousWorkbook);
    setActiveSheetName(undoToast.targetSheetName);
    setUndoToast(null);
  };

  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) =>
      /\.(xlsx|xls|xlsm|csv)$/i.test(f.name)
    );
    if (files.length === 0) {
      setErrorMsg('Please select an .xlsx, .xls, .xlsm, or .csv file.');
      return;
    }

    setErrorMsg(null);
    setIsProcessing(true);
    setUndoToast(null);

    try {
      const parsed = await parseUniversalFiles(files);
      if (parsed.sheets.length === 0) {
        setErrorMsg('No readable worksheets or columns found in the uploaded file.');
        return;
      }

      setWorkbook(parsed);
      setActiveSheetName(parsed.sheets[0].name);
      setFiltersBySheet({});
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to parse spreadsheet file.'
      );
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
    const blank = createBlankWorkbook();
    setWorkbook(blank);
    setActiveSheetName(blank.sheets[0].name);
    setFiltersBySheet({});
    setErrorMsg(null);
    setUndoToast(null);
  };

  const handleClearWorkspace = () => {
    setWorkbook(null);
    setActiveSheetName('');
    setFiltersBySheet({});
    setUndoToast(null);
    setErrorMsg(null);
  };

  const handleExport = async () => {
    if (!workbook) return;
    setIsExporting(true);
    setErrorMsg(null);
    try {
      await exportUniversalWorkbook(workbook);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to generate Excel download.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleUpdateCell = (
    sheetName: string,
    rowId: string,
    column: string,
    value: string
  ) => {
    setWorkbook((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        updatedAt: new Date().toISOString(),
        sheets: prev.sheets.map((sheet) => {
          if (sheet.name !== sheetName) return sheet;
          return {
            ...sheet,
            rows: sheet.rows.map((row) =>
              row.id === rowId
                ? { ...row, cells: { ...row.cells, [column]: value } }
                : row
            ),
          };
        }),
      };
    });
  };

  const handleAddRow = (sheetName: string) => {
    if (!workbook) return;
    const targetSheet = workbook.sheets.find((s) => s.name === sheetName);
    if (!targetSheet) return;

    const previousWorkbook = workbook;
    const blankCells: Record<string, string> = {};
    targetSheet.columns.forEach((col) => {
      blankCells[col] = '';
    });

    const newRow: UniversalRow = {
      id: `${targetSheet.id}_manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      cells: blankCells,
    };

    setWorkbook({
      ...workbook,
      updatedAt: new Date().toISOString(),
      sheets: workbook.sheets.map((sheet) =>
        sheet.name === sheetName
          ? { ...sheet, rows: [newRow, ...sheet.rows] }
          : sheet
      ),
    });

    // Clear active filters on this sheet so the new blank row is visible immediately
    setFiltersBySheet((prev) => ({
      ...prev,
      [sheetName]: { search: '', columnFilters: {} },
    }));

    pushUndoToast({
      message: `Added new row to ${sheetName}`,
      previousWorkbook,
      targetSheetName: sheetName,
    });
  };

  const handleDeleteRows = (sheetName: string, rowIds: string[]) => {
    if (!workbook || rowIds.length === 0) return;
    const idSet = new Set(rowIds);
    const previousWorkbook = workbook;

    setWorkbook({
      ...workbook,
      updatedAt: new Date().toISOString(),
      sheets: workbook.sheets.map((sheet) =>
        sheet.name === sheetName
          ? { ...sheet, rows: sheet.rows.filter((r) => !idSet.has(r.id)) }
          : sheet
      ),
    });

    pushUndoToast({
      message: `Deleted ${rowIds.length} row${rowIds.length === 1 ? '' : 's'} from ${sheetName}`,
      previousWorkbook,
      targetSheetName: sheetName,
    });
  };

  const handleMoveRows = (
    fromSheetName: string,
    rowIds: string[],
    targetSheetName: string
  ) => {
    if (!workbook || fromSheetName === targetSheetName || rowIds.length === 0) return;
    const sourceSheet = workbook.sheets.find((s) => s.name === fromSheetName);
    const targetSheet = workbook.sheets.find((s) => s.name === targetSheetName);
    if (!sourceSheet || !targetSheet) return;

    const idSet = new Set(rowIds);
    const rowsToMove = sourceSheet.rows.filter((r) => idSet.has(r.id));
    if (rowsToMove.length === 0) return;

    const previousWorkbook = workbook;

    // Build case-insensitive lookup so fields carry cleanly across sheets
    const mappedRows: UniversalRow[] = rowsToMove.map((row) => {
      const lowerCellLookup = new Map<string, string>();
      Object.entries(row.cells).forEach(([k, v]) => {
        lowerCellLookup.set(k.trim().toLowerCase(), v);
      });

      const nextCells: Record<string, string> = {};
      targetSheet.columns.forEach((col) => {
        if (Object.prototype.hasOwnProperty.call(row.cells, col)) {
          nextCells[col] = row.cells[col] ?? '';
        } else {
          nextCells[col] = lowerCellLookup.get(col.trim().toLowerCase()) ?? '';
        }
      });

      return {
        id: row.id,
        cells: nextCells,
      };
    });

    setWorkbook({
      ...workbook,
      updatedAt: new Date().toISOString(),
      sheets: workbook.sheets.map((sheet) => {
        if (sheet.name === fromSheetName) {
          return {
            ...sheet,
            rows: sheet.rows.filter((r) => !idSet.has(r.id)),
          };
        }
        if (sheet.name === targetSheetName) {
          return {
            ...sheet,
            rows: [...mappedRows, ...sheet.rows],
          };
        }
        return sheet;
      }),
    });

    pushUndoToast({
      message: `Moved ${rowsToMove.length} row${rowsToMove.length === 1 ? '' : 's'} from ${fromSheetName} to ${targetSheetName}`,
      previousWorkbook,
      targetSheetName: fromSheetName,
    });
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const renderThemeSwitcher = () => (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex items-center p-0.5 bg-slate-100 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 rounded-md shrink-0"
    >
      <button
        type="button"
        onClick={() => setTheme('light')}
        aria-pressed={theme === 'light'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          theme === 'light'
            ? 'bg-white text-slate-900 shadow-xs border border-slate-200/80'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent'
        }`}
      >
        <Sun className="w-3.5 h-3.5" />
        <span>Light</span>
      </button>
      <button
        type="button"
        onClick={() => setTheme('dark')}
        aria-pressed={theme === 'dark'}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
          theme === 'dark'
            ? 'bg-slate-800 text-white border border-slate-700'
            : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 border border-transparent'
        }`}
      >
        <Moon className="w-3.5 h-3.5" />
        <span>Dark</span>
      </button>
    </div>
  );

  const activeFilterState: SheetFilterState = activeSheet
    ? filtersBySheet[activeSheet.name] ?? { search: '', columnFilters: {} }
    : { search: '', columnFilters: {} };

  const headerSheets = workbook ? workbook.sheets.slice(0, 5) : [];

  return (
    <div
      className="min-h-screen flex flex-col bg-white dark:bg-[#080c14] text-slate-900 dark:text-slate-100 transition-colors duration-150"
      onDragOver={(e) => {
        if (workbook) e.preventDefault();
      }}
      onDrop={(e) => {
        if (workbook && e.dataTransfer.files.length > 0) {
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
      <header className="bg-white/90 dark:bg-[#080c14]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/90 sticky top-0 z-40">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            Ridge Creative Lead Auditor
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            {workbook ? (
              headerSheets.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSheetName(s.name)}
                  className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeSheet?.name === s.name
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold'
                      : ''
                  }`}
                >
                  {s.name}
                </button>
              ))
            ) : (
              <>
                <span className="whitespace-nowrap shrink-0">Universal Ingestion</span>
                <span className="whitespace-nowrap shrink-0">Prompt Injection</span>
                <span className="whitespace-nowrap shrink-0">Inline Editing</span>
                <span className="whitespace-nowrap shrink-0">Workbook Export</span>
              </>
            )}
          </nav>

          <div className="flex items-center shrink-0">
            {workbook ? (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {isExporting
                    ? 'Generating .xlsx...'
                    : 'Export Edited Excel (.xlsx)'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={triggerFilePicker}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
            className="bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 rounded-lg px-5 py-3.5 text-sm flex items-center justify-between gap-4"
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

        {!workbook ? (
          /* Drag-and-Drop Intake */
          <div className="max-w-4xl mx-auto py-8 space-y-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
                  Universal Excel Lead Auditor &amp; Inline Editor
                </h1>
                <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                  Drop any multi-sheet <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">.xlsx</span>, <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">.xls</span>, or <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">.csv</span> workbook. Every sheet and column is preserved verbatim with an automatic editable <span className="font-mono text-sm text-emerald-700 dark:text-emerald-400">Prompt</span> column injected on every tab.
                </p>
              </div>
              {renderThemeSwitcher()}
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
              className={`bg-slate-50/70 dark:bg-[#0c121e] border-2 border-dashed rounded-xl p-14 flex flex-col items-center justify-center text-center transition-colors ${
                isDragging
                  ? 'border-emerald-600 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20'
                  : 'border-slate-300 dark:border-slate-700 hover:border-emerald-500/60'
              }`}
            >
              <div className="w-14 h-14 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>

              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                {isProcessing
                  ? 'Parsing worksheets and detecting headers...'
                  : 'Drag & drop your lead master workbook'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 max-w-lg">
                Preserves exact sheet tabs, original columns, and cell values while adding inline spreadsheet editing, row drawer inspection, auto-save, and clean Excel export.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={triggerFilePicker}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select .xlsx / .xls / .csv</span>
                </button>

                <button
                  type="button"
                  onClick={handleLoadSample}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#080c14] border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Load Sample Lead Master
                </button>

                <button
                  type="button"
                  onClick={handleStartBlank}
                  disabled={isProcessing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Start Blank Workbook</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Active Spreadsheet Workspace */
          <div className="space-y-5">
            {/* Workspace Control Strip */}
            <div className="bg-white dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-4 flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {workbook.fileName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                  <span>{workbook.sheets.length} sheets</span>
                  <span aria-hidden="true">·</span>
                  <span>{totalRowsCount.toLocaleString()} total rows</span>
                  {activeSheet && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{activeSheet.columns.length} columns on {activeSheet.name}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>Auto-saved</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {renderThemeSwitcher()}

                <button
                  type="button"
                  onClick={triggerFilePicker}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load New File</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearWorkspace}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-[#080c14] border border-slate-200 dark:border-slate-800 hover:border-rose-400/60 hover:text-rose-700 dark:hover:text-rose-300 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Close File</span>
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 rounded-md disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>
                    {isExporting
                      ? 'Exporting...'
                      : 'Export Edited Excel (.xlsx)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Dynamic Sheet Navigation Tabs */}
            <div
              role="tablist"
              aria-label="Workbook sheets"
              className="flex items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-[#0c121e] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto"
            >
              {workbook.sheets.map((sheet) => {
                const isActive = activeSheet?.name === sheet.name;
                return (
                  <button
                    key={sheet.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveSheetName(sheet.name)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-emerald-500/35 shadow-xs dark:shadow-none'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-transparent'
                    }`}
                  >
                    <span>{sheet.name}</span>
                    <span
                      className={`font-mono tabular-nums text-[11px] ${
                        isActive
                          ? 'text-emerald-600 dark:text-emerald-200'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      ({sheet.rows.length})
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Sheet Editable Spreadsheet Grid */}
            {activeSheet && (
              <UniversalSheetGrid
                sheet={activeSheet}
                allSheetNames={workbook.sheets.map((s) => s.name)}
                filterState={activeFilterState}
                onFilterChange={(next) =>
                  setFiltersBySheet((prev) => ({
                    ...prev,
                    [activeSheet.name]: next,
                  }))
                }
                onAddRow={() => handleAddRow(activeSheet.name)}
                onUpdateCell={(rowId, column, value) =>
                  handleUpdateCell(activeSheet.name, rowId, column, value)
                }
                onMoveRows={(rowIds, targetSheetName) =>
                  handleMoveRows(activeSheet.name, rowIds, targetSheetName)
                }
                onDeleteRows={(rowIds) =>
                  handleDeleteRows(activeSheet.name, rowIds)
                }
              />
            )}
          </div>
        )}
      </main>

      {/* 1-Click Undo Toast */}
      {undoToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-[#0c121e] border border-emerald-500/40 shadow-xl rounded-lg px-4 py-3 flex items-center gap-4 text-sm">
          <span className="text-slate-900 dark:text-slate-100">
            {undoToast.message}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Undo</span>
          </button>
          <button
            type="button"
            onClick={() => setUndoToast(null)}
            aria-label="Dismiss undo notification"
            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-[#080c14] mt-12">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>Ridge Creative Web Studio</span>
          <span>Universal client-side workbook parsing, inline editing, and Excel export.</span>
        </div>
      </footer>
    </div>
  );
}
