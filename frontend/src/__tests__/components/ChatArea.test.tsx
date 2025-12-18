import { render, screen, act } from '@testing-library/react';
import { ChatArea } from '@/components/ChatArea';
import type { Conversation, Message } from '@/types';

const createConversation = (): Conversation => ({
  id: 'conv-1',
  session_id: 'session-1',
  topic: 'Philosophy of Mind',
  thinkers: [
    {
      id: 'thinker-1',
      name: 'Socrates',
      bio: 'Ancient philosopher',
      positions: 'Socratic method',
      style: 'Questions everything',
      color: '#3B82F6',
    },
  ],
  messages: [],
  total_cost: 0,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: new Date().toISOString(),
});

const createMessage = (id: string, content: string): Message => ({
  id,
  conversation_id: 'conv-1',
  sender_type: 'user',
  sender_name: null,
  content,
  cost: null,
  created_at: new Date().toISOString(),
});

describe('ChatArea', () => {
  const defaultProps = {
    conversation: null as Conversation | null,
    messages: [] as Message[],
    typingThinkers: [] as string[],
    onSendMessage: jest.fn(),
    isConnected: true,
  };

  it('renders empty state when no conversation', () => {
    render(<ChatArea {...defaultProps} />);
    expect(screen.getByTestId('chat-area-empty')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Thinkers Chat')).toBeInTheDocument();
  });

  it('renders chat area when conversation is selected', () => {
    const conversation = createConversation();
    render(<ChatArea {...defaultProps} conversation={conversation} />);

    expect(screen.getByTestId('chat-area')).toBeInTheDocument();
    expect(screen.getByText('Philosophy of Mind')).toBeInTheDocument();
    expect(screen.getByText('with Socrates')).toBeInTheDocument();
  });

  it('renders messages', () => {
    const conversation = createConversation();
    const messages = [createMessage('1', 'Hello'), createMessage('2', 'World')];
    render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        messages={messages}
      />
    );

    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(screen.getByText('World')).toBeInTheDocument();
  });

  it('renders typing indicator', () => {
    const conversation = createConversation();
    render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        typingThinkers={['Socrates']}
      />
    );

    expect(screen.getByTestId('thinker-typing-indicator')).toBeInTheDocument();
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
    expect(screen.getByText('Socrates')).toBeInTheDocument();
  });

  it('renders message input', () => {
    const conversation = createConversation();
    render(<ChatArea {...defaultProps} conversation={conversation} />);

    expect(screen.getByTestId('message-input')).toBeInTheDocument();
  });

  it('shows reconnecting status when disconnected', () => {
    const conversation = createConversation();
    render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        isConnected={false}
      />
    );

    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('disables input when disconnected', () => {
    const conversation = createConversation();
    render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        isConnected={false}
      />
    );

    expect(screen.getByTestId('message-textarea')).toBeDisabled();
  });

  it('displays error message banner when errorMessage is provided', () => {
    const conversation = createConversation();
    const errorMessage = 'Credit balance is too low to continue';
    render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        errorMessage={errorMessage}
      />
    );

    expect(screen.getByTestId('error-banner')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('does not display error banner when errorMessage is null', () => {
    const conversation = createConversation();
    render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        errorMessage={null}
      />
    );

    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });

  it('allows dismissing error message', async () => {
    const conversation = createConversation();
    const errorMessage = 'Test error message';
    const { rerender } = render(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        errorMessage={errorMessage}
      />
    );

    const dismissButton = screen.getByTestId('dismiss-error-button');
    expect(screen.getByTestId('error-banner')).toBeInTheDocument();

    // Click dismiss button
    act(() => {
      dismissButton.click();
    });

    // Re-render with same props - banner should be hidden due to dismissed state
    rerender(
      <ChatArea
        {...defaultProps}
        conversation={conversation}
        errorMessage={errorMessage}
      />
    );

    expect(screen.queryByTestId('error-banner')).not.toBeInTheDocument();
  });
});
