/**
 * Typing indicator showing which thinkers are currently typing.
 */

'use client';

export interface TypingIndicatorProps {
  /** Names of thinkers currently typing */
  typingThinkers: string[];
}

export function TypingIndicator({ typingThinkers }: TypingIndicatorProps) {
  if (typingThinkers.length === 0) {
    return null;
  }

  const formatNames = (): string => {
    if (typingThinkers.length === 1) {
      return `${typingThinkers[0]} is thinking...`;
    }
    if (typingThinkers.length === 2) {
      return `${typingThinkers[0]} and ${typingThinkers[1]} are thinking...`;
    }
    return `${typingThinkers.slice(0, -1).join(', ')}, and ${
      typingThinkers[typingThinkers.length - 1]
    } are thinking...`;
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-500 dark:text-zinc-400"
      data-testid="typing-indicator"
    >
      <div className="flex gap-1">
        <span
          className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <span>{formatNames()}</span>
    </div>
  );
}
