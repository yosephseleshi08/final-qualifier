import type { ConsolidationOutput, DestinationTab } from '../types/audit';

interface SummaryViewProps {
  output: ConsolidationOutput;
  onJumpToTab: (tab: DestinationTab) => void;
}

export function SummaryView({ output, onJumpToTab }: SummaryViewProps) {
  const pct = (n: number) =>
    output.totalUniqueLeads > 0 ? `${((n / output.totalUniqueLeads) * 100).toFixed(1)}%` : '0.0%';

  const bucketRows: {
    status: DestinationTab;
    count: number;
    rule: string;
    formulaHint: string;
    statusClass: string;
  }[] = [
    {
      status: 'Confirmed',
      count: output.confirmed.length,
      rule: 'Priority 1 — CONFIRMED in A1–A3 or B Phone Check, OR LISTED - INFLATED in C Marketplace. Excludes lead from all lower tabs.',
      formulaHint: '=COUNTA(Confirmed!A2:A1000)',
      statusClass: 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30',
    },
    {
      status: 'Cannot Verify',
      count: output.cannotVerify.length,
      rule: 'Priority 2 (Beats Refuted) — CANNOT VERIFY in A1–A3 or blank/unverified status in B Phone Check (not in Priority 1).',
      formulaHint: "=COUNTA('Cannot Verify'!A2:A1000)",
      statusClass: 'text-amber-300 bg-amber-500/15 border border-amber-500/30',
    },
    {
      status: 'Refuted',
      count: output.refuted.length,
      rule: 'Priority 3 — REFUTED in A1–A3, CONFIGURATION in B Phone Check, or LISTED - FAIR PRICES / NOT LISTED in C Marketplace.',
      formulaHint: '=COUNTA(Refuted!A2:A1000)',
      statusClass: 'text-rose-300 bg-rose-500/15 border border-rose-500/30',
    },
    {
      status: 'No Need Result',
      count: output.noNeedResult.length,
      rule: 'Priority 4 — Table D (rewrite / no verify) or tabs without a Result column not already captured in Priorities 1–3.',
      formulaHint: "=COUNTA('No Need Result'!A2:A1000)",
      statusClass: 'text-sky-300 bg-sky-500/15 border border-sky-500/30',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              Consolidated Tab Summary
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Dynamic Excel COUNTA formulas target Column A (Name) across all 4 tabs in the exported workbook.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-emerald-400">
            {output.totalUniqueLeads} unique leads · {output.duplicatesRemoved} duplicates merged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-xs font-medium text-slate-400">
                <th className="py-3 px-6">Destination Tab</th>
                <th className="py-3 px-4 text-right">Unique Leads</th>
                <th className="py-3 px-4 text-right">Share</th>
                <th className="py-3 px-4">Exported Excel Formula</th>
                <th className="py-3 px-6">Priority & Deduplication Rule</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {bucketRows.map((row) => (
                <tr
                  key={row.status}
                  onClick={() => onJumpToTab(row.status)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                >
                  <td className="py-3.5 px-6 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${row.statusClass}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-white">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-400">
                    {pct(row.count)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-emerald-400/90 whitespace-nowrap">
                    {row.formulaHint}
                  </td>
                  <td className="py-3.5 px-6 text-xs text-slate-300 leading-relaxed max-w-md">
                    {row.rule}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-950/60 font-semibold text-white">
                <td className="py-3.5 px-6">Total Unique Leads</td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                  {output.totalUniqueLeads.toLocaleString()}
                </td>
                <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                  {output.totalUniqueLeads > 0 ? '100.0%' : '0.0%'}
                </td>
                <td className="py-3.5 px-4 font-mono text-xs text-emerald-400/90 whitespace-nowrap">
                  =SUM(B5:B8)
                </td>
                <td className="py-3.5 px-6 text-xs font-normal text-slate-400">
                  Zero duplication enforced across Confirmed, Cannot Verify, Refuted, and No Need Result.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800">
          <h2 className="text-base font-semibold text-white">
            Source Sheet Breakdown (Pre-Deduplication)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Row classifications extracted from each uploaded worksheet before cross-sheet deduplication.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-xs font-medium text-slate-400">
                <th className="py-3 px-6">Source Sheet</th>
                <th className="py-3 px-4 text-right">Parsed Rows</th>
                <th className="py-3 px-4 text-right">Confirmed / Inflated</th>
                <th className="py-3 px-4 text-right">Cannot Verify / Blank</th>
                <th className="py-3 px-4 text-right">Refuted / Config / Fair</th>
                <th className="py-3 px-6 text-right">No Need Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {output.sheetBreakdowns.map((b) => (
                <tr key={b.sheetName} className="hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-6 font-medium text-slate-100">{b.sheetName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {b.totalRows.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                    {b.confirmedRows.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-400">
                    {b.cannotVerifyRows.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-400">
                    {b.refutedRows.toLocaleString()}
                  </td>
                  <td className="py-3 px-6 text-right font-mono tabular-nums text-sky-400">
                    {b.noNeedResultRows.toLocaleString()}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-950/60 font-semibold text-white">
                <td className="py-3 px-6">Total Raw Rows Processed</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">
                  {output.totalRawRows.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                  {output.sheetBreakdowns.reduce((a, b) => a + b.confirmedRows, 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-400">
                  {output.sheetBreakdowns.reduce((a, b) => a + b.cannotVerifyRows, 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-rose-400">
                  {output.sheetBreakdowns.reduce((a, b) => a + b.refutedRows, 0).toLocaleString()}
                </td>
                <td className="py-3 px-6 text-right font-mono tabular-nums text-sky-400">
                  {output.sheetBreakdowns.reduce((a, b) => a + b.noNeedResultRows, 0).toLocaleString()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
