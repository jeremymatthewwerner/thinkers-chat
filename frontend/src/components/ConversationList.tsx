/**
 * Conversation list component showing previous chats.
 */

'use client';

import type { ConversationSummary } from '@/types';

export interface ConversationListProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onDelete,
}: ConversationListProps) {
  // Format relative time
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  if (conversations.length === 0) {
    return (
      <div
        className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400"
        data-testid="conversation-list-empty"
      >
        No conversations yet
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1" data-testid="conversation-list">
      {conversations.map((conv) => (
        <div
          key={conv.id}
          className={`group relative px-3 py-2 rounded-lg cursor-pointer transition-colors ${
            selectedId === conv.id
              ? 'bg-zinc-200 dark:bg-zinc-700'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
          onClick={() => onSelect(conv.id)}
          data-testid="conversation-item"
          data-selected={selectedId === conv.id}
        >
          <div className="flex justify-between items-start mb-1">
            <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate pr-2 flex-1">
              {conv.topic}
            </h3>
            <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
              {formatTime(conv.updated_at)}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {conv.thinker_names.join(', ')}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              {conv.message_count} messages
            </span>
            {conv.total_cost > 0 && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                ${conv.total_cost.toFixed(3)}
              </span>
            )}
          </div>

          {/* Delete button */}
          {onDelete && (
            <button
              className="absolute right-2 top-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              aria-label="Delete conversation"
              data-testid="delete-conversation"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4 text-zinc-500 dark:text-zinc-400"
              >
                <path
                  fillRule="evenodd"
                  d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
