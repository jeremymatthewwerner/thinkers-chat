/**
 * WebSocket hook for real-time chat messaging.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, WSMessage } from '@/types';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface UseWebSocketOptions {
  conversationId: string | null;
  onMessage?: (message: Message) => void;
  onThinkerTyping?: (thinkerName: string) => void;
  onThinkerStoppedTyping?: (thinkerName: string) => void;
  onError?: (error: string) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isPaused: boolean;
  typingThinkers: Set<string>;
  sendUserMessage: (content: string) => void;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  sendPause: () => void;
  sendResume: () => void;
}

export function useWebSocket({
  conversationId,
  onMessage,
  onThinkerTyping,
  onThinkerStoppedTyping,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [typingThinkers, setTypingThinkers] = useState<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Connect when conversationId changes
  useEffect(() => {
    if (!conversationId) return;

    let isActive = true;
    // Track the conversation ID this connection belongs to
    const thisConversationId = conversationId;

    const createConnection = () => {
      if (!isActive) return;

      const ws = new WebSocket(`${WS_BASE_URL}/ws/${thisConversationId}`);

      ws.onopen = () => {
        if (!isActive) {
          ws.close();
          return;
        }
        setIsConnected(true);
        // Clear any pending reconnect
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onclose = () => {
        if (!isActive) return;
        setIsConnected(false);
        // Attempt to reconnect after a delay
        reconnectTimeoutRef.current = setTimeout(() => {
          createConnection();
        }, 3000);
      };

      ws.onerror = () => {
        onError?.('WebSocket connection error');
      };

      ws.onmessage = (event) => {
        // Don't process messages if this connection is no longer active
        if (!isActive) return;

        try {
          const data: WSMessage = JSON.parse(event.data);

          // Only process messages for this conversation
          if (data.conversation_id && data.conversation_id !== thisConversationId) {
            return;
          }

          switch (data.type) {
            case 'message':
              if (data.sender_type === 'thinker' && data.message_id) {
                onMessage?.({
                  id: data.message_id,
                  conversation_id: thisConversationId,
                  sender_type: 'thinker',
                  sender_name: data.sender_name || null,
                  content: data.content || '',
                  cost: data.cost || null,
                  created_at: data.timestamp || new Date().toISOString(),
                });
              }
              break;

            case 'thinker_typing':
              if (data.sender_name && isActive) {
                setTypingThinkers(
                  (prev) => new Set([...prev, data.sender_name!])
                );
                onThinkerTyping?.(data.sender_name);
              }
              break;

            case 'thinker_stopped_typing':
              if (data.sender_name && isActive) {
                setTypingThinkers((prev) => {
                  const next = new Set(prev);
                  next.delete(data.sender_name!);
                  return next;
                });
                onThinkerStoppedTyping?.(data.sender_name);
              }
              break;

            case 'paused':
              setIsPaused(true);
              break;

            case 'resumed':
              setIsPaused(false);
              break;

            case 'error':
              onError?.(data.content || 'Unknown error');
              break;
          }
        } catch {
          onError?.('Failed to parse WebSocket message');
        }
      };

      wsRef.current = ws;
    };

    createConnection();

    return () => {
      isActive = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Reset state on cleanup (before next effect runs with new conversationId)
      setTypingThinkers(new Set());
      setIsPaused(false);
      setIsConnected(false);
    };
  }, [
    conversationId,
    onMessage,
    onThinkerTyping,
    onThinkerStoppedTyping,
    onError,
  ]);

  const sendMessage = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendUserMessage = useCallback(
    (content: string) => {
      sendMessage({
        type: 'user_message',
        conversation_id: conversationId || undefined,
        content,
      });
    },
    [conversationId, sendMessage]
  );

  const sendTypingStart = useCallback(() => {
    sendMessage({
      type: 'typing_start',
      conversation_id: conversationId || undefined,
    });
  }, [conversationId, sendMessage]);

  const sendTypingStop = useCallback(() => {
    sendMessage({
      type: 'typing_stop',
      conversation_id: conversationId || undefined,
    });
  }, [conversationId, sendMessage]);

  const sendPause = useCallback(() => {
    sendMessage({
      type: 'pause',
      conversation_id: conversationId || undefined,
    });
  }, [conversationId, sendMessage]);

  const sendResume = useCallback(() => {
    sendMessage({
      type: 'resume',
      conversation_id: conversationId || undefined,
    });
  }, [conversationId, sendMessage]);

  return {
    isConnected,
    isPaused,
    typingThinkers,
    sendUserMessage,
    sendTypingStart,
    sendTypingStop,
    sendPause,
    sendResume,
  };
}
