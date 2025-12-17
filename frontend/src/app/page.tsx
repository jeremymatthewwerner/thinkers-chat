'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  Conversation,
  ConversationSummary,
  Message,
  ThinkerProfile,
  ThinkerSuggestion,
} from '@/types';
import { ChatArea, NewChatModal, Sidebar } from '@/components';
import { useWebSocket } from '@/hooks';
import * as api from '@/lib/api';

export default function Home() {
  // State
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // WebSocket connection
  const {
    isConnected,
    isPaused,
    typingThinkers,
    sendUserMessage,
    sendTypingStart,
    sendTypingStop,
    sendPause,
    sendResume,
  } = useWebSocket({
    conversationId: currentConversation?.id || null,
    onMessage: useCallback((message: Message) => {
      setMessages((prev) => [...prev, message]);
      if (message.cost) {
        setTotalCost((prev) => prev + message.cost!);
      }
      // Update conversation summary in sidebar (message count and cost)
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversation_id
            ? {
                ...conv,
                message_count: conv.message_count + 1,
                total_cost: conv.total_cost + (message.cost || 0),
                updated_at: message.created_at,
              }
            : conv
        )
      );
    }, []),
  });

  // Initialize session and load conversations
  useEffect(() => {
    const init = async () => {
      try {
        await api.ensureSession();
        const convs = await api.getConversations();
        setConversations(convs);
      } catch (error) {
        console.error('Failed to initialize:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  // Load conversation when selected
  const handleSelectConversation = useCallback(async (id: string) => {
    try {
      const conv = await api.getConversation(id);
      setCurrentConversation(conv);
      setMessages(conv.messages);
      setTotalCost(conv.total_cost);
      // Only close sidebar on mobile (window width < 1024px)
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  }, []);

  // Delete conversation
  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        await api.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (currentConversation?.id === id) {
          setCurrentConversation(null);
          setMessages([]);
          setTotalCost(0);
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    },
    [currentConversation]
  );

  // Send message
  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!currentConversation) return;

      try {
        const message = await api.sendMessage(currentConversation.id, content);
        setMessages((prev) => [...prev, message]);
        sendUserMessage(content); // Notify via WebSocket
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    },
    [currentConversation, sendUserMessage]
  );

  // Create new conversation
  const handleCreateConversation = useCallback(
    async (
      topic: string,
      thinkers: { name: string; bio: string; positions: string; style: string; image_url?: string | null }[]
    ) => {
      const conv = await api.createConversation({
        topic,
        thinkers,
      });
      // Update conversations list with summary
      setConversations((prev) => [
        {
          id: conv.id,
          topic: conv.topic,
          thinker_names: conv.thinkers.map((t) => t.name),
          thinkers: conv.thinkers.map((t) => ({ name: t.name, image_url: t.image_url })),
          message_count: 0,
          total_cost: 0,
          created_at: conv.created_at,
          updated_at: conv.created_at, // Use created_at since updated_at may not be in response
        },
        ...prev,
      ]);
      // Set current conversation - add empty messages array since create endpoint doesn't return messages
      setCurrentConversation({ ...conv, messages: [], total_cost: 0 });
      setMessages([]); // New conversation has no messages
      setTotalCost(0);
      // Only close sidebar on mobile (window width < 1024px)
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setSidebarOpen(false);
      }
    },
    []
  );

  // Suggest thinkers for topic
  const handleSuggestThinkers = useCallback(
    async (topic: string, exclude: string[] = []): Promise<ThinkerSuggestion[]> => {
      return api.suggestThinkers(topic, 5, exclude);
    },
    []
  );

  // Validate custom thinker
  const handleValidateThinker = useCallback(
    async (name: string): Promise<ThinkerProfile | null> => {
      const result = await api.validateThinker(name);
      return result.valid && result.profile ? result.profile : null;
    },
    []
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="text-zinc-500 dark:text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      <Sidebar
        conversations={conversations}
        selectedId={currentConversation?.id || null}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onNewChat={() => setModalOpen(true)}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        isConnected={isConnected}
        isPaused={isPaused}
      />

      <ChatArea
        conversation={currentConversation}
        messages={messages}
        typingThinkers={Array.from(typingThinkers)}
        totalCost={totalCost}
        onSendMessage={handleSendMessage}
        onTypingStart={sendTypingStart}
        onTypingStop={sendTypingStop}
        isConnected={isConnected}
        isPaused={isPaused}
        onPause={sendPause}
        onResume={sendResume}
      />

      <NewChatModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreateConversation}
        onSuggestThinkers={handleSuggestThinkers}
        onValidateThinker={handleValidateThinker}
      />
    </div>
  );
}
