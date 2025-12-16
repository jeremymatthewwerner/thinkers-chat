/**
 * Modal for creating a new conversation.
 */

'use client';

import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { ThinkerProfile, ThinkerSuggestion } from '@/types';
import { type SelectedThinker, ThinkerSelector } from './ThinkerSelector';

export interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (topic: string, thinkerNames: string[]) => Promise<void>;
  onSuggestThinkers: (topic: string) => Promise<ThinkerSuggestion[]>;
  onValidateThinker: (name: string) => Promise<ThinkerProfile | null>;
}

export function NewChatModal({
  isOpen,
  onClose,
  onCreate,
  onSuggestThinkers,
  onValidateThinker,
}: NewChatModalProps) {
  const [step, setStep] = useState<'topic' | 'thinkers'>('topic');
  const [topic, setTopic] = useState('');
  const [suggestions, setSuggestions] = useState<ThinkerSuggestion[]>([]);
  const [selectedThinkers, setSelectedThinkers] = useState<SelectedThinker[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && step === 'topic') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, step]);

  // Reset state when closed
  useEffect(() => {
    if (!isOpen) {
      setStep('topic');
      setTopic('');
      setSuggestions([]);
      setSelectedThinkers([]);
      setError(null);
    }
  }, [isOpen]);

  const handleTopicSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!topic.trim()) return;

      setIsLoading(true);
      setError(null);

      try {
        const results = await onSuggestThinkers(topic.trim());
        setSuggestions(results);
        setStep('thinkers');
      } catch {
        setError('Failed to get thinker suggestions');
      } finally {
        setIsLoading(false);
      }
    },
    [topic, onSuggestThinkers]
  );

  const handleCreate = useCallback(async () => {
    if (selectedThinkers.length === 0) {
      setError('Please select at least one thinker');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(
        topic.trim(),
        selectedThinkers.map((t) => t.name)
      );
      onClose();
    } catch {
      setError('Failed to create conversation');
    } finally {
      setIsCreating(false);
    }
  }, [topic, selectedThinkers, onCreate, onClose]);

  const handleSelectThinker = useCallback((thinker: SelectedThinker) => {
    setSelectedThinkers((prev) => [...prev, thinker]);
  }, []);

  const handleRemoveThinker = useCallback((name: string) => {
    setSelectedThinkers((prev) => prev.filter((t) => t.name !== name));
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      data-testid="new-chat-modal"
    >
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-zinc-900 rounded-xl shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {step === 'topic' ? 'New Conversation' : 'Select Thinkers'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-zinc-500"
            >
              <path
                fillRule="evenodd"
                d="M5.47 5.47a.75.75 0 011.06 0L12 10.94l5.47-5.47a.75.75 0 111.06 1.06L13.06 12l5.47 5.47a.75.75 0 11-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 01-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 010-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {step === 'topic' ? (
            <form onSubmit={handleTopicSubmit}>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                What would you like to discuss?
              </label>
              <input
                ref={inputRef}
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g., The nature of consciousness"
                className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                data-testid="topic-input"
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  Topic:{' '}
                </span>
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {topic}
                </span>
              </div>

              <ThinkerSelector
                suggestions={suggestions}
                selectedThinkers={selectedThinkers}
                onSelect={handleSelectThinker}
                onRemove={handleRemoveThinker}
                onValidateCustom={onValidateThinker}
                isLoading={isLoading}
              />

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-700">
          {step === 'thinkers' && (
            <button
              onClick={() => setStep('topic')}
              className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Back
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {step === 'topic' ? (
              <button
                onClick={(e) => handleTopicSubmit(e as unknown as FormEvent)}
                disabled={!topic.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="next-button"
              >
                {isLoading ? 'Loading...' : 'Next'}
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={selectedThinkers.length === 0 || isCreating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="create-button"
              >
                {isCreating ? 'Creating...' : 'Start Conversation'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
