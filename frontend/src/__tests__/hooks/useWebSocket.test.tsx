import { renderHook, act, waitFor } from '@testing-library/react';
import { useWebSocket } from '@/hooks/useWebSocket';

// Mock the api module
jest.mock('@/lib/api', () => ({
  getAccessToken: jest.fn(() => 'mock-jwt-token'),
}));

import * as api from '@/lib/api';

// Enhanced mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  send = jest.fn();
  close = jest.fn();

  // Test helpers
  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) {
      this.onopen(new Event('open'));
    }
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(
        new MessageEvent('message', { data: JSON.stringify(data) })
      );
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

let mockWsInstance: MockWebSocket;

// Setup mock with constants
const createMockedWebSocket = () => {
  const MockedWs = jest.fn(() => mockWsInstance) as unknown as typeof WebSocket;
  Object.defineProperty(MockedWs, 'CONNECTING', { value: 0 });
  Object.defineProperty(MockedWs, 'OPEN', { value: 1 });
  Object.defineProperty(MockedWs, 'CLOSING', { value: 2 });
  Object.defineProperty(MockedWs, 'CLOSED', { value: 3 });
  return MockedWs;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockWsInstance = new MockWebSocket();
  global.WebSocket = createMockedWebSocket();
  // Reset the mock to return a token for authentication
  (api.getAccessToken as jest.Mock).mockReturnValue('mock-jwt-token');
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

describe('useWebSocket', () => {
  it('connects when conversationId is provided', () => {
    renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    expect(global.WebSocket).toHaveBeenCalledWith(
      'ws://localhost:8000/ws/conv-123?token=mock-jwt-token'
    );
  });

  it('does not connect when conversationId is null', () => {
    renderHook(() =>
      useWebSocket({
        conversationId: null,
      })
    );

    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  it('does not connect when no token is available', async () => {
    // Mock getAccessToken to return null (no token)
    (api.getAccessToken as jest.Mock).mockReturnValue(null);
    const onError = jest.fn();

    renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onError,
      })
    );

    // When no token is available, onError should be called
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Not authenticated');
    });
    expect(global.WebSocket).not.toHaveBeenCalled();
  });

  it('sets isConnected to true when connection opens', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    expect(result.current.isConnected).toBe(false);

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('sets isConnected to false when connection closes', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      mockWsInstance.simulateClose();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });
  });

  it('calls onMessage when thinker message is received', async () => {
    const onMessage = jest.fn();
    renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onMessage,
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      mockWsInstance.simulateMessage({
        type: 'message',
        sender_type: 'thinker',
        sender_name: 'Socrates',
        content: 'I know that I know nothing.',
        message_id: 'msg-1',
        conversation_id: 'conv-123',
        timestamp: '2024-01-15T10:00:00Z',
        cost: 0.001,
      });
    });

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith({
        id: 'msg-1',
        conversation_id: 'conv-123',
        sender_type: 'thinker',
        sender_name: 'Socrates',
        content: 'I know that I know nothing.',
        cost: 0.001,
        created_at: '2024-01-15T10:00:00Z',
      });
    });
  });

  it('updates typingThinkers when thinker starts typing', async () => {
    const onThinkerTyping = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onThinkerTyping,
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      mockWsInstance.simulateMessage({
        type: 'thinker_typing',
        sender_name: 'Socrates',
      });
    });

    await waitFor(() => {
      expect(result.current.typingThinkers.has('Socrates')).toBe(true);
      expect(onThinkerTyping).toHaveBeenCalledWith('Socrates');
    });
  });

  it('updates typingThinkers when thinker stops typing', async () => {
    const onThinkerStoppedTyping = jest.fn();
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onThinkerStoppedTyping,
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    // First start typing
    act(() => {
      mockWsInstance.simulateMessage({
        type: 'thinker_typing',
        sender_name: 'Socrates',
      });
    });

    await waitFor(() => {
      expect(result.current.typingThinkers.has('Socrates')).toBe(true);
    });

    // Then stop typing
    act(() => {
      mockWsInstance.simulateMessage({
        type: 'thinker_stopped_typing',
        sender_name: 'Socrates',
      });
    });

    await waitFor(() => {
      expect(result.current.typingThinkers.has('Socrates')).toBe(false);
      expect(onThinkerStoppedTyping).toHaveBeenCalledWith('Socrates');
    });
  });

  it('calls onError when error message is received', async () => {
    const onError = jest.fn();
    renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onError,
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      mockWsInstance.simulateMessage({
        type: 'error',
        content: 'Something went wrong',
      });
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Something went wrong');
    });
  });

  it('calls onError when WebSocket error occurs', async () => {
    const onError = jest.fn();
    renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onError,
      })
    );

    act(() => {
      mockWsInstance.simulateError();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('WebSocket connection error');
    });
  });

  it('sends user message via WebSocket', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      result.current.sendUserMessage('Hello!');
    });

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'user_message',
        conversation_id: 'conv-123',
        content: 'Hello!',
      })
    );
  });

  it('sends typing start via WebSocket', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      result.current.sendTypingStart();
    });

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'typing_start',
        conversation_id: 'conv-123',
      })
    );
  });

  it('sends typing stop via WebSocket', async () => {
    const { result } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      result.current.sendTypingStop();
    });

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'typing_stop',
        conversation_id: 'conv-123',
      })
    );
  });

  it('cleans up WebSocket on unmount', async () => {
    const { unmount } = renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    unmount();

    expect(mockWsInstance.close).toHaveBeenCalled();
  });

  it('handles invalid JSON in message', async () => {
    const onError = jest.fn();
    renderHook(() =>
      useWebSocket({
        conversationId: 'conv-123',
        onError,
      })
    );

    act(() => {
      mockWsInstance.simulateOpen();
    });

    act(() => {
      if (mockWsInstance.onmessage) {
        mockWsInstance.onmessage(
          new MessageEvent('message', { data: 'not valid json' })
        );
      }
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Failed to parse WebSocket message');
    });
  });
});
