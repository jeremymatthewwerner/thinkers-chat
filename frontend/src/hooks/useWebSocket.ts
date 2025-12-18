/**
 * WebSocket hook for real-time chat messaging.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message, WSMessage } from '@/types';
import { getAccessToken } from '@/lib/api';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface UseWebSocketOptions {
  conversationId: string | null;
  onMessage?: (message: Message) => void;
  onThinkerTyping?: (thinkerName: string) => void;
  onThinkerThinking?: (thinkerName: string, thinkingContent: string) => void;
  onThinkerStoppedTyping?: (thinkerName: string) => void;
  onError?: (error: string) => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  isPaused: boolean;
  speedMultiplier: number; // 1.0 = normal, 0.5 = fast, 2.0+ = slow
  typingThinkers: Set<string>;
  thinkingContent: Map<string, string>; // thinker name -> thinking preview
  sendUserMessage: (content: string) => void;
  sendTypingStart: () => void;
  sendTypingStop: () => void;
  sendPause: () => void;
  sendResume: () => void;
  sendSetSpeed: (multiplier: number) => void;
}

export function useWebSocket({
  conversationId,
  onMessage,
  onThinkerTyping,
  onThinkerThinking,
  onThinkerStoppedTyping,
  onError,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [typingThinkers, setTypingThinkers] = useState<Set<string>>(new Set());
  const [thinkingContent, setThinkingContent] = useState<Map<string, string>>(
    new Map()
  );
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

      // Get auth token for WebSocket connection
      const token = getAccessToken();
      if (!token) {
        onError?.('Not authenticated');
        return;
      }

      const ws = new WebSocket(
        `${WS_BASE_URL}/ws/${thisConversationId}?token=${encodeURIComponent(token)}`
      );

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
          if (
            data.conversation_id &&
            data.conversation_id !== thisConversationId
          ) {
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

            case 'thinker_thinking':
              if (data.sender_name && data.content && isActive) {
                setThinkingContent((prev) => {
                  const next = new Map(prev);
                  next.set(data.sender_name!, data.content!);
                  return next;
                });
                onThinkerThinking?.(data.sender_name, data.content);
              }
              break;

            case 'thinker_stopped_typing':
              if (data.sender_name && isActive) {
                setTypingThinkers((prev) => {
                  const next = new Set(prev);
                  next.delete(data.sender_name!);
                  return next;
                });
                setThinkingContent((prev) => {
                  const next = new Map(prev);
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

            case 'speed_changed':
              if (data.speed_multiplier !== undefined) {
                setSpeedMultiplier(data.speed_multiplier);
              }
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
      setThinkingContent(new Map());
      setIsPaused(false);
      setIsConnected(false);
      setSpeedMultiplier(1.0);
    };
  }, [
    conversationId,
    onMessage,
    onThinkerTyping,
    onThinkerThinking,
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

  const sendSetSpeed = useCallback(
    (multiplier: number) => {
      sendMessage({
        type: 'set_speed',
        conversation_id: conversationId || undefined,
        speed_multiplier: multiplier,
      });
    },
    [conversationId, sendMessage]
  );

  return {
    isConnected,
    isPaused,
    speedMultiplier,
    typingThinkers,
    thinkingContent,
    sendUserMessage,
    sendTypingStart,
    sendTypingStop,
    sendPause,
    sendResume,
    sendSetSpeed,
  };
}
