/**
 * Sidebar component with conversation list and new chat button.
 */

'use client';

import type { ConversationSummary } from '@/types';
import { ConversationList } from './ConversationList';
import { CostMeter } from './CostMeter';

export interface SidebarProps {
  conversations: ConversationSummary[];
  selectedId: string | null;
  onSelectConversation: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onToggle: () => void;
  isConnected?: boolean;
  isPaused?: boolean;
  sessionCost?: number;
  username?: string;
  displayName?: string | null;
  isAdmin?: boolean;
  onLogout?: () => void;
}

export function Sidebar({
  conversations,
  selectedId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  isOpen,
  onToggle,
  isConnected = false,
  isPaused = false,
  sessionCost = 0,
  username,
  displayName,
  isAdmin = false,
  onLogout,
}: SidebarProps) {
  // Use display name if available, fall back to username
  const nameToShow = displayName || username;
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={onToggle}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-30 w-72 bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <a
                href="https://github.com/jeremymatthewwerner/thinkers-chat"
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-bold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                Thinkers Chat
              </a>
              <button
                onClick={onToggle}
                className="lg:hidden p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                aria-label="Close sidebar"
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
            <CostMeter totalCost={sessionCost} className="mt-2" />
          </div>

          {/* New chat button */}
          <div className="px-3 py-3">
            <button
              onClick={onNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-950 transition-colors"
              data-testid="new-chat-button"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              New Conversation
            </button>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            <ConversationList
              conversations={conversations}
              selectedId={selectedId}
              onSelect={onSelectConversation}
              onDelete={onDeleteConversation}
              isConnected={isConnected}
              isPaused={isPaused}
            />
          </div>

          {/* Footer with user info */}
          <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
            {username ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-sm font-medium">
                      {(nameToShow || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                    {nameToShow}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Bug report button - creates GitHub issue */}
                  <a
                    href="https://github.com/jeremymatthewwerner/thinkers-chat/issues/new?title=%5BP3%5D%20User%20Report%3A%20&body=%23%23%20Description%0APlease%20describe%20the%20issue%3A%0A%0A%23%23%20Steps%20to%20Reproduce%0A1.%20%0A2.%20%0A%0A%23%23%20Expected%20Behavior%0A%0A%23%23%20Actual%20Behavior%0A%0A%23%23%20Browser%2FDevice%0A&labels=P3,bug"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-zinc-500 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Report a bug on GitHub"
                    data-testid="bug-report-link"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M6.56 1.14a.75.75 0 01.177 1.045 3.989 3.989 0 00-.464.86c.185.17.382.329.59.473A3.993 3.993 0 0110 2c1.272 0 2.405.594 3.137 1.518.208-.144.405-.302.59-.473a3.989 3.989 0 00-.464-.86.75.75 0 011.222-.869c.369.519.65 1.105.822 1.736a.75.75 0 01-.174.707 7.03 7.03 0 01-1.299 1.098A4 4 0 0114 6c0 .52-.301.963-.723 1.187a6.961 6.961 0 01-.635 3.044l1.165 1.165a.75.75 0 11-1.06 1.06l-1.235-1.234a6.99 6.99 0 01-3.024 0l-1.235 1.234a.75.75 0 01-1.06-1.06l1.165-1.165A6.961 6.961 0 016.723 7.187C6.301 6.963 6 6.52 6 6c0-.14.072-.342.166-.586.047-.124.109-.264.175-.402a7.03 7.03 0 01-1.299-1.098.75.75 0 01-.174-.707 5.48 5.48 0 01.822-1.736.75.75 0 011.046-.177z"
                        clipRule="evenodd"
                      />
                      <path d="M10 6a2 2 0 100 4 2 2 0 000-4z" />
                      <path d="M10 12a6 6 0 100-12 6 6 0 000 12zm0 2a8 8 0 100-16 8 8 0 000 16z" />
                    </svg>
                  </a>
                  {isAdmin && (
                    <a
                      href="/admin"
                      className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Admin panel"
                      data-testid="admin-link"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-5 h-5"
                      >
                        <path
                          fillRule="evenodd"
                          d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={onLogout}
                    className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Sign out"
                    data-testid="logout-button"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        fillRule="evenodd"
                        d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z"
                        clipRule="evenodd"
                      />
                      <path
                        fillRule="evenodd"
                        d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-.943a.75.75 0 10-1.004-1.114l-2.5 2.25a.75.75 0 000 1.114l2.5 2.25a.75.75 0 101.004-1.114l-1.048-.943h9.546A.75.75 0 0019 10z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
                Discuss ideas with AI-simulated thinkers
              </p>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile menu button */}
      <button
        onClick={onToggle}
        className={`fixed top-4 left-4 z-10 lg:hidden p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        aria-label="Open sidebar"
        data-testid="menu-button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="w-5 h-5 text-zinc-700 dark:text-zinc-300"
        >
          <path
            fillRule="evenodd"
            d="M3 6.75A.75.75 0 013.75 6h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 6.75zM3 12a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75A.75.75 0 013 12zm0 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 010 1.5H3.75a.75.75 0 01-.75-.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </>
  );
}
