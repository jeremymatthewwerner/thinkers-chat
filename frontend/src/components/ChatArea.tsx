/**
 * Main chat area component combining messages, typing indicator, and input.
 */

'use client';

import type { Conversation, Message } from '@/types';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';

export interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  typingThinkers: string[];
  /** Map of thinker names to their thinking preview content */
  thinkingContent?: Map<string, string>;
  onSendMessage: (content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  isConnected: boolean;
  isPaused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  /** Speed multiplier (1.0 = normal, 0.5 = fast, 2.0+ = slow) */
  speedMultiplier?: number;
  onSpeedChange?: (multiplier: number) => void;
}

// Speed labels for display
const SPEED_LABELS: Record<number, string> = {
  0.5: 'Fast',
  1.0: 'Normal',
  1.5: 'Relaxed',
  2.0: 'Slow',
  3.0: 'Very Slow',
};

function getSpeedLabel(speed: number): string {
  // Find closest match
  const speeds = [0.5, 1.0, 1.5, 2.0, 3.0];
  const closest = speeds.reduce((prev, curr) =>
    Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev
  );
  return SPEED_LABELS[closest];
}

export function ChatArea({
  conversation,
  messages,
  typingThinkers,
  thinkingContent,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  isConnected,
  isPaused = false,
  onPause,
  onResume,
  speedMultiplier = 1.0,
  onSpeedChange,
}: ChatAreaProps) {
  if (!conversation) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400"
        data-testid="chat-area-empty"
      >
        <div className="text-center max-w-md px-4">
          <h2 className="text-2xl font-semibold mb-2 text-zinc-900 dark:text-zinc-100">
            Welcome to Thinkers Chat
          </h2>
          <p className="mb-4">
            Start a new conversation to discuss topics with historical and
            contemporary thinkers.
          </p>
          <p className="text-sm">
            Select a conversation from the sidebar or create a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex-1 flex flex-col bg-white dark:bg-zinc-900"
      data-testid="chat-area"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {conversation.topic}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            with {conversation.thinkers.map((t) => t.name).join(', ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Speed control */}
          {onSpeedChange && (
            <div
              className="flex items-center gap-2"
              data-testid="speed-control"
            >
              <label className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                Pace:
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.5"
                value={speedMultiplier}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="w-20 h-1.5 accent-blue-600 cursor-pointer"
                title={`Conversation pace: ${getSpeedLabel(speedMultiplier)}`}
                data-testid="speed-slider"
              />
              <span className="text-xs text-zinc-600 dark:text-zinc-300 w-16">
                {getSpeedLabel(speedMultiplier)}
              </span>
            </div>
          )}

          {/* Pause/Resume button */}
          {(onPause || onResume) && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                isPaused
                  ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50'
                  : 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:hover:bg-orange-900/50'
              }`}
              data-testid="pause-resume-button"
              title={isPaused ? 'Resume thinkers' : 'Pause thinkers'}
            >
              {isPaused ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Resume
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-4 h-4"
                  >
                    <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-1.5z" />
                  </svg>
                  Pause
                </>
              )}
            </button>
          )}
          {!isConnected && (
            <span
              className="text-xs text-orange-500"
              data-testid="connection-status"
            >
              Reconnecting...
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <MessageList
        messages={messages}
        thinkers={conversation.thinkers}
        typingThinkers={typingThinkers}
        thinkingContent={thinkingContent}
      />

      {/* Input */}
      <MessageInput
        onSend={onSendMessage}
        onTypingStart={onTypingStart}
        onTypingStop={onTypingStop}
        disabled={!isConnected}
        placeholder={
          isConnected
            ? `Message ${conversation.thinkers.map((t) => t.name).join(', ')}...`
            : 'Connecting...'
        }
      />
    </div>
  );
}
