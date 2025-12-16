/**
 * Scrollable message list component.
 */

'use client';

import { useEffect, useRef } from 'react';
import type { ConversationThinker, Message as MessageType } from '@/types';
import { Message } from './Message';

export interface MessageListProps {
  messages: MessageType[];
  thinkers: ConversationThinker[];
}

export function MessageList({ messages, thinkers }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Create a map of thinker colors
  const thinkerColors = thinkers.reduce(
    (acc, t) => {
      acc[t.name] = t.color;
      return acc;
    },
    {} as Record<string, string>
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div
        className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-500"
        data-testid="message-list-empty"
      >
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-4"
      data-testid="message-list"
    >
      {messages.map((msg) => (
        <Message
          key={msg.id}
          message={msg}
          thinkerColor={
            msg.sender_name ? thinkerColors[msg.sender_name] : undefined
          }
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
