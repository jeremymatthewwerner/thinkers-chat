import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import Home from '../app/page';

// Mock next/navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
}));

// Mock the API module
jest.mock('@/lib/api', () => ({
  getConversations: jest.fn().mockResolvedValue([]),
  getConversation: jest.fn(),
  createConversation: jest.fn(),
  deleteConversation: jest.fn(),
  sendMessage: jest.fn(),
  suggestThinkers: jest.fn().mockResolvedValue([]),
  validateThinker: jest.fn(),
  getAccessToken: jest.fn().mockReturnValue('mock-token'),
}));

// Mock the auth context
const mockLogout = jest.fn();
jest.mock('@/contexts', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'user-1', username: 'testuser', is_admin: false, total_spend: 0 },
    isLoading: false,
    isAuthenticated: true,
    login: jest.fn(),
    register: jest.fn(),
    logout: mockLogout,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Home', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the page with loading state when auth is loading', async () => {
    const { useAuth } = require('@/contexts');
    useAuth.mockReturnValueOnce({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });
    render(<Home />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    const { useAuth } = require('@/contexts');
    useAuth.mockReturnValueOnce({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: jest.fn(),
      register: jest.fn(),
      logout: jest.fn(),
    });
    render(<Home />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login');
    });
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

  it('displays username in sidebar', async () => {
    await act(async () => {
      render(<Home />);
    });
    await waitFor(() => {
      expect(screen.getByText('testuser')).toBeInTheDocument();
    });
  });
});
