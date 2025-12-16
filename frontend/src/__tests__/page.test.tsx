import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import Home from '../app/page';

// Mock the API module
jest.mock('@/lib/api', () => ({
  ensureSession: jest.fn().mockResolvedValue({
    id: 'session-1',
    created_at: new Date().toISOString(),
  }),
  getConversations: jest.fn().mockResolvedValue([]),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  sendMessage: jest.fn(),
  suggestThinkers: jest.fn().mockResolvedValue([]),
  validateThinker: jest.fn(),
}));

describe('Home', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page with loading state', () => {
    render(<Home />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders sidebar after loading', async () => {
    await act(async () => {
      render(<Home />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('sidebar')).toBeInTheDocument();
    });
  });

  it('renders welcome message when no conversation is selected', async () => {
    await act(async () => {
      render(<Home />);
    });
    await waitFor(() => {
      expect(screen.getByText('Welcome to Thinkers Chat')).toBeInTheDocument();
    });
  });

  it('renders new chat button', async () => {
    await act(async () => {
      render(<Home />);
    });
    await waitFor(() => {
      expect(screen.getByTestId('new-chat-button')).toBeInTheDocument();
    });
  });
});
