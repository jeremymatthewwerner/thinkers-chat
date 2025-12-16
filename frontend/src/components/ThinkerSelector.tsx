/**
 * Thinker selector component for choosing conversation participants.
 */

'use client';

import { useCallback, useState } from 'react';
import type { ThinkerProfile, ThinkerSuggestion } from '@/types';

export interface SelectedThinker {
  name: string;
  profile: ThinkerProfile;
}

export interface ThinkerSelectorProps {
  suggestions: ThinkerSuggestion[];
  selectedThinkers: SelectedThinker[];
  onSelect: (thinker: SelectedThinker) => void;
  onRemove: (name: string) => void;
  onValidateCustom: (name: string) => Promise<ThinkerProfile | null>;
  isLoading?: boolean;
  maxThinkers?: number;
}

export function ThinkerSelector({
  suggestions,
  selectedThinkers,
  onSelect,
  onRemove,
  onValidateCustom,
  isLoading = false,
  maxThinkers = 5,
}: ThinkerSelectorProps) {
  const [customName, setCustomName] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedNames = new Set(
    selectedThinkers.map((t) => t.name.toLowerCase())
  );
  const canAddMore = selectedThinkers.length < maxThinkers;

  const handleAddCustom = useCallback(async () => {
    if (!customName.trim() || validating || !canAddMore) return;

    setError(null);
    setValidating(true);

    try {
      const profile = await onValidateCustom(customName.trim());
      if (profile) {
        onSelect({ name: profile.name, profile });
        setCustomName('');
      } else {
        setError(`Could not find "${customName}". Try a different name.`);
      }
    } catch {
      setError('Failed to validate thinker');
    } finally {
      setValidating(false);
    }
  }, [customName, validating, canAddMore, onValidateCustom, onSelect]);

  return (
    <div className="space-y-4" data-testid="thinker-selector">
      {/* Selected thinkers */}
      {selectedThinkers.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Selected ({selectedThinkers.length}/{maxThinkers})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedThinkers.map((thinker) => (
              <div
                key={thinker.name}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                data-testid="selected-thinker"
              >
                <span>{thinker.name}</span>
                <button
                  onClick={() => onRemove(thinker.name)}
                  className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full"
                  aria-label={`Remove ${thinker.name}`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {canAddMore && suggestions.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Suggested thinkers
          </label>
          {isLoading ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading suggestions...
            </div>
          ) : (
            <div className="space-y-2">
              {suggestions
                .filter((s) => !selectedNames.has(s.name.toLowerCase()))
                .map((suggestion) => (
                  <button
                    key={suggestion.name}
                    onClick={() =>
                      onSelect({
                        name: suggestion.name,
                        profile: suggestion.profile,
                      })
                    }
                    className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    data-testid="thinker-suggestion"
                  >
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">
                      {suggestion.name}
                    </div>
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {suggestion.reason}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Custom thinker input */}
      {canAddMore && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Add custom thinker
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customName}
              onChange={(e) => {
                setCustomName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustom();
                }
              }}
              placeholder="Enter a name (e.g., Socrates)"
              className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              data-testid="custom-thinker-input"
            />
            <button
              onClick={handleAddCustom}
              disabled={!customName.trim() || validating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="add-custom-thinker"
            >
              {validating ? 'Checking...' : 'Add'}
            </button>
          </div>
          {error && (
            <p
              className="text-sm text-red-600 dark:text-red-400"
              data-testid="thinker-error"
            >
              {error}
            </p>
          )}
        </div>
      )}

      {!canAddMore && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Maximum of {maxThinkers} thinkers reached
        </p>
      )}
    </div>
  );
}
