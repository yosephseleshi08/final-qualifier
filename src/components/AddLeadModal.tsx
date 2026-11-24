import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, Merge, Plus, X } from 'lucide-react';
import type { ConsolidatedLead, DestinationTab } from '../types/audit';
import { normalizeLeadName } from '../utils/normalizer';

interface AddLeadModalProps {
  defaultDestination: DestinationTab;
  allLeads: ConsolidatedLead[];
  onClose: () => void;
  onAddLead: (draft: {
    name: string;
    url: string;
    destination: DestinationTab;
    claimVerbatim: string;
    resultExplanation: string;
    correctedPrompt: string;
  }) => void;
  onMoveExisting: (existingLead: ConsolidatedLead, targetDestination: DestinationTab) => void;
  onMergeExisting: (
    existingLead: ConsolidatedLead,
    targetDestination: DestinationTab,
    updates: {
      url: string;
      claimVerbatim: string;
      resultExplanation: string;
      correctedPrompt: string;
    }
  ) => void;
}

const DESTINATIONS: DestinationTab[] = [
  'Confirmed',
  'Cannot Verify',
  'Refuted',
  'No Need Result',
];

export function AddLeadModal({
  defaultDestination,
  allLeads,
  onClose,
  onAddLead,
  onMoveExisting,
  onMergeExisting,
}: AddLeadModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [destination, setDestination] = useState<DestinationTab>(defaultDestination);
  const [claimVerbatim, setClaimVerbatim] = useState('');
  const [resultExplanation, setResultExplanation] = useState('');
  const [correctedPrompt, setCorrectedPrompt] = useState('');

  const normalizedInput = useMemo(() => normalizeLeadName(name), [name]);

  const duplicateMatch = useMemo(() => {
    if (!normalizedInput) return null;
    return allLeads.find((lead) => lead.normalizedKey === normalizedInput) || null;
  }, [allLeads, normalizedInput]);

  const canSubmit = name.trim().length > 0 && !duplicateMatch;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onAddLead({
      name: name.trim(),
      url: url.trim(),
      destination,
      claimVerbatim: claimVerbatim.trim(),
      resultExplanation: resultExplanation.trim(),
      correctedPrompt: correctedPrompt.trim(),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/65 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-2xl overflow-hidden text-slate-900 dark:text-slate-100 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Add Lead</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adds a new unique lead directly to {destination} with real-time duplicate protection.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="add-lead-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Name *
              </label>
              <input
                id="add-lead-name"
                type="text"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Tarriko Bistro"
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
              />
            </div>

            <div>
              <label htmlFor="add-lead-dest" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Destination
              </label>
              <select
                id="add-lead-dest"
                value={destination}
                onChange={(e) => setDestination(e.target.value as DestinationTab)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              >
                {DESTINATIONS.map((d) => (
                  <option key={d} value={d} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Duplicate Guard Warning */}
          {duplicateMatch && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 rounded-lg space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                  <span className="font-semibold text-amber-800 dark:text-amber-300">
                    Already exists in {duplicateMatch.destination}
                  </span>{' '}
                  (“{duplicateMatch.name}”). Zero-duplication rules prevent adding a second row across tabs.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {duplicateMatch.destination !== destination && (
                  <button
                    type="button"
                    onClick={() => {
                      onMoveExisting(duplicateMatch, destination);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Move Existing to {destination}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onMergeExisting(duplicateMatch, destination, {
                      url: url.trim(),
                      claimVerbatim: claimVerbatim.trim(),
                      resultExplanation: resultExplanation.trim(),
                      correctedPrompt: correctedPrompt.trim(),
                    });
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/30 hover:bg-amber-200/80 dark:hover:bg-amber-500/25 rounded transition-colors cursor-pointer"
                >
                  <Merge className="w-3.5 h-3.5" />
                  <span>
                    Merge Details into Existing ({duplicateMatch.destination}
                    {duplicateMatch.destination !== destination ? ` → ${destination}` : ''})
                  </span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label htmlFor="add-lead-url" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              URL
            </label>
            <input
              id="add-lead-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label htmlFor="add-lead-claim" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Claim (verbatim)
            </label>
            <textarea
              id="add-lead-claim"
              rows={2}
              value={claimVerbatim}
              onChange={(e) => setClaimVerbatim(e.target.value)}
              placeholder="Exact claim, marketplace search, or Table D reason..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label htmlFor="add-lead-explanation" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Result Explanation
            </label>
            <textarea
              id="add-lead-explanation"
              rows={3}
              value={resultExplanation}
              onChange={(e) => setResultExplanation(e.target.value)}
              placeholder="Full AI Result, explanation, or corrected one-sentence pitch angle..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
            />
          </div>

          <div>
            <label htmlFor="add-lead-prompt" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Corrected Prompt (optional — defaults to blank)
            </label>
            <textarea
              id="add-lead-prompt"
              rows={2}
              value={correctedPrompt}
              onChange={(e) => setCorrectedPrompt(e.target.value)}
              placeholder="Leave blank or enter custom prompt..."
              className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-600/60 dark:focus:border-emerald-500/60"
            />
          </div>

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-md hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-md disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lead to {destination}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
