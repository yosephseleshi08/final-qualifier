import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { DuplicateMergeRecord } from '../types/audit';

interface DuplicatesViewProps {
  duplicates: DuplicateMergeRecord[];
}

export function DuplicatesView({ duplicates }: DuplicatesViewProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return duplicates;
    return duplicates.filter(
      (d) =>
        d.chosenDisplayName.toLowerCase().includes(q) ||
        d.normalizedKey.toLowerCase().includes(q) ||
        d.rawNames.join(' ').toLowerCase().includes(q) ||
        d.sourceTabs.join(' ').toLowerCase().includes(q)
    );
  }, [duplicates, search]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Cross-Sheet Deduplication Trace
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Restaurants matched across multiple sheets via Unicode NFKD normalization and resolved by Priority 1 → 2 → 3 → 4.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter merged leads..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {duplicates.length === 0
              ? 'No duplicate restaurants detected across sheets'
              : 'No matching merged records'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Any restaurant appearing across 2 or more sheets is logged here with its winning priority tab.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-xs font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 px-6">Clean Display Name</th>
                <th className="py-3 px-4">Normalized Key</th>
                <th className="py-3 px-4">Raw Name Variants</th>
                <th className="py-3 px-4">Source Tabs</th>
                <th className="py-3 px-4 whitespace-nowrap">Winning Tab</th>
                <th className="py-3 px-6">Priority Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm align-top">
              {filtered.map((d) => {
                const statusClass =
                  d.winningStatus === 'Confirmed'
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30'
                    : d.winningStatus === 'Cannot Verify'
                      ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/30'
                      : d.winningStatus === 'Refuted'
                        ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30'
                        : 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-500/15 border border-sky-200 dark:border-sky-500/30';
                return (
                  <tr key={d.normalizedKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-6 font-semibold text-slate-900 dark:text-white">
                      {d.chosenDisplayName}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {d.normalizedKey}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {d.rawNames.join(' · ')}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                      {d.sourceTabs.join(' · ')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 text-xs font-semibold rounded ${statusClass}`}>
                        {d.winningStatus}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-xs text-slate-700 dark:text-slate-300">
                      {d.winningReason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
