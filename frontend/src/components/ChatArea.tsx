/**
 * Main chat area component combining messages, typing indicator, and input.
 */

'use client';

import type { Conversation, Message } from '@/types';
import { MessageInput } from './MessageInput';
import { MessageList } from './MessageList';
import { TypingIndicator } from './TypingIndicator';
import { CostMeter } from './CostMeter';

export interface ChatAreaProps {
  conversation: Conversation | null;
  messages: Message[];
  typingThinkers: string[];
  totalCost: number;
  onSendMessage: (content: string) => void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  isConnected: boolean;
}

export function ChatArea({
  conversation,
  messages,
  typingThinkers,
  totalCost,
  onSendMessage,
  onTypingStart,
  onTypingStop,
  isConnected,
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
          <CostMeter totalCost={totalCost} />
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
      <MessageList messages={messages} thinkers={conversation.thinkers} />

      {/* Typing indicator */}
      <TypingIndicator typingThinkers={typingThinkers} />

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
