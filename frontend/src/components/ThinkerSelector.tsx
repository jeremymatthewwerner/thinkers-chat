/**
 * Thinker selector component for choosing conversation participants.
 */

'use client';

import { useCallback, useState } from 'react';
import type { ThinkerProfile, ThinkerSuggestion } from '@/types';
import { ThinkerAvatar } from './ThinkerAvatar';

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
  onRequestMore?: () => Promise<void>;
  onRefreshSuggestion?: (name: string) => Promise<void>;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  maxThinkers?: number;
}

export function ThinkerSelector({
  suggestions,
  selectedThinkers,
  onSelect,
  onRemove,
  onValidateCustom,
  onRequestMore,
  onRefreshSuggestion,
  isLoading = false,
  isLoadingMore = false,
  maxThinkers = 5,
}: ThinkerSelectorProps) {
  const [customName, setCustomName] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshingNames, setRefreshingNames] = useState<Set<string>>(new Set());

  const selectedNames = new Set(
    selectedThinkers.map((t) => t.name.toLowerCase())
  );
  const canAddMore = selectedThinkers.length < maxThinkers;

  // Filter out selected suggestions
  const visibleSuggestions = suggestions.filter(
    (s) => !selectedNames.has(s.name.toLowerCase())
  );

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to validate thinker';
      setError(message);
    } finally {
      setValidating(false);
    }
  }, [customName, validating, canAddMore, onValidateCustom, onSelect]);

  const handleRefresh = useCallback(
    async (name: string) => {
      if (!onRefreshSuggestion || refreshingNames.has(name)) return;

      setRefreshingNames((prev) => new Set([...prev, name]));
      try {
        await onRefreshSuggestion(name);
      } finally {
        setRefreshingNames((prev) => {
          const next = new Set(prev);
          next.delete(name);
          return next;
        });
      }
    },
    [onRefreshSuggestion, refreshingNames]
  );

  const handleAccept = useCallback(
    (suggestion: ThinkerSuggestion) => {
      onSelect({
        name: suggestion.name,
        profile: suggestion.profile,
      });
    },
    [onSelect]
  );

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
                className="flex items-center gap-2 pl-1 pr-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                data-testid="selected-thinker"
              >
                <ThinkerAvatar
                  name={thinker.name}
                  imageUrl={thinker.profile.image_url}
                  size="sm"
                />
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
      {canAddMore && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Suggested thinkers
          </label>
          {isLoading ? (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              Loading suggestions...
            </div>
          ) : visibleSuggestions.length > 0 ? (
            <div className="space-y-2">
              {visibleSuggestions.map((suggestion) => (
                <div
                  key={suggestion.name}
                  className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700"
                  data-testid="thinker-suggestion"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <ThinkerAvatar
                        name={suggestion.name}
                        imageUrl={suggestion.profile.image_url}
                        size="lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {suggestion.name}
                        </div>
                        <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                          {suggestion.reason}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => handleAccept(suggestion)}
                        className="p-1.5 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                        aria-label={`Add ${suggestion.name}`}
                        title="Add to conversation"
                        data-testid="accept-suggestion"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                      {onRefreshSuggestion && (
                        <button
                          onClick={() => handleRefresh(suggestion.name)}
                          disabled={refreshingNames.has(suggestion.name)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-50"
                          aria-label={`Get different suggestion for ${suggestion.name}`}
                          title="Get a different suggestion"
                          data-testid="refresh-suggestion"
                        >
                          {refreshingNames.has(suggestion.name) ? (
                            <svg
                              className="animate-spin w-5 h-5"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-5 h-5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              No more suggestions available.
            </div>
          )}

          {/* Suggest More button */}
          {onRequestMore && !isLoading && (
            <button
              onClick={onRequestMore}
              disabled={isLoadingMore}
              className="w-full py-2 px-4 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-dashed border-blue-300 dark:border-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="suggest-more-button"
            >
              {isLoadingMore ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Loading more suggestions...
                </span>
              ) : (
                '+ Suggest More Thinkers'
              )}
            </button>
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
