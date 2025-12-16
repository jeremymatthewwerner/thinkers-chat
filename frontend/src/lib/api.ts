/**
 * API client for Thinkers Chat backend.
 */

import type {
  Conversation,
  ConversationSummary,
  Message,
  Session,
  ThinkerProfile,
  ThinkerSuggestion,
} from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

let sessionId: string | null = null;

function getSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  if (sessionId) return sessionId;
  sessionId = localStorage.getItem('session_id');
  return sessionId;
}

function setSessionId(id: string): void {
  sessionId = id;
  if (typeof window !== 'undefined') {
    localStorage.setItem('session_id', id);
  }
}

async function fetchWithSession<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const sid = getSessionId();
  if (sid) {
    (headers as Record<string, string>)['X-Session-ID'] = sid;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// Session API
export async function createSession(): Promise<Session> {
  const session = await fetchWithSession<Session>('/api/sessions', {
    method: 'POST',
  });
  setSessionId(session.id);
  return session;
}

export async function getSession(): Promise<Session | null> {
  const sid = getSessionId();
  if (!sid) return null;
  try {
    return await fetchWithSession<Session>(`/api/sessions/${sid}`);
  } catch {
    return null;
  }
}

export async function ensureSession(): Promise<Session> {
  const existing = await getSession();
  if (existing) return existing;
  return createSession();
}

// Conversation API
export async function getConversations(): Promise<ConversationSummary[]> {
  return fetchWithSession<ConversationSummary[]>('/api/conversations');
}

export async function getConversation(id: string): Promise<Conversation> {
  return fetchWithSession<Conversation>(`/api/conversations/${id}`);
}

export interface CreateConversationData {
  topic: string;
  thinker_names: string[];
}

export async function createConversation(
  data: CreateConversationData
): Promise<Conversation> {
  return fetchWithSession<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await fetchWithSession<{ success: boolean }>(`/api/conversations/${id}`, {
    method: 'DELETE',
  });
}

// Message API
export async function sendMessage(
  conversationId: string,
  content: string
): Promise<Message> {
  return fetchWithSession<Message>(
    `/api/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ content }),
    }
  );
}

// Thinker API
export async function suggestThinkers(
  topic: string,
  count: number = 3
): Promise<ThinkerSuggestion[]> {
  return fetchWithSession<ThinkerSuggestion[]>('/api/thinkers/suggest', {
    method: 'POST',
    body: JSON.stringify({ topic, count }),
  });
}

export interface ValidateThinkerResponse {
  valid: boolean;
  name: string;
  profile?: ThinkerProfile;
  error?: string;
}

export async function validateThinker(
  name: string
): Promise<ValidateThinkerResponse> {
  return fetchWithSession<ValidateThinkerResponse>('/api/thinkers/validate', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

// Export for testing
export { getSessionId, setSessionId, API_BASE_URL };
