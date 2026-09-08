import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import App from '../../src/App';
import type { User } from '../../src/types';

// ─── Module mocks (vi.mock is hoisted) ────────────────────

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn(),
  getAuthToken: vi.fn(),
  clearStoredAuth: vi.fn(),
  isServiceUnreachable: vi.fn(),
  setGlobalApiErrorHandler: vi.fn(),
}));

vi.mock('../../src/utils/jwt', () => ({
  isTokenExpired: vi.fn(),
}));

vi.mock('../../src/components/DashboardView', () => ({
  DashboardView: () => <div data-testid="mock-dashboard">Dashboard</div>,
}));
vi.mock('../../src/components/ContactsView', () => ({
  ContactsView: () => <div data-testid="mock-contacts">Contacts</div>,
}));
vi.mock('../../src/components/ContactDetailView', () => ({
  ContactDetailView: () => <div data-testid="mock-contact-detail">Contact Detail</div>,
}));
vi.mock('../../src/components/ImportWizardView', () => ({
  ImportWizardView: () => <div data-testid="mock-import">Import</div>,
}));
vi.mock('../../src/components/NewContactView', () => ({
  NewContactView: () => <div data-testid="mock-new-contact">New Contact</div>,
}));
vi.mock('../../src/components/ExportView', () => ({
  ExportView: () => <div data-testid="mock-export">Export</div>,
}));
vi.mock('../../src/components/SegmentationView', () => ({
  SegmentationView: () => <div data-testid="mock-segmentation">Segmentation</div>,
}));
vi.mock('../../src/components/ProfileView', () => ({
  ProfileView: () => <div data-testid="mock-profile">Profile</div>,
}));
vi.mock('../../src/components/AdminView', () => ({
  AdminView: () => <div data-testid="mock-admin">Admin Panel</div>,
}));
vi.mock('../../src/pages/ResetPasswordPage', () => ({
  ResetPasswordPage: () => <div data-testid="mock-reset-password">Reset Password</div>,
}));
vi.mock('../../src/pages/ResetPasswordExpiredPage', () => ({
  ResetPasswordExpiredPage: () => <div data-testid="mock-reset-expired">Reset Expired</div>,
}));
vi.mock('../../src/components/chat/ChatWidget', () => ({
  ChatWidget: () => <div data-testid="mock-chat-widget">Chat</div>,
}));

// ─── Import mocked modules & create typed references ───────

import {
  apiFetch,
  getAuthToken,
  clearStoredAuth,
  isServiceUnreachable,
  setGlobalApiErrorHandler,
} from '../../src/services/api';
import { isTokenExpired } from '../../src/utils/jwt';

const mockApiFetch = vi.mocked(apiFetch);
const mockGetAuthToken = vi.mocked(getAuthToken);
const mockClearStoredAuth = vi.mocked(clearStoredAuth);
const mockIsTokenExpired = vi.mocked(isTokenExpired);
const mockIsServiceUnreachable = vi.mocked(isServiceUnreachable);

// ─── Test data ────────────────────────────────────────────

const regularUser: User = {
  id: 'u1',
  name: 'Jean Dupont',
  email: 'jean@example.com',
  role: 'user',
  privilege: 'FULL_ACCESS',
};

const adminUser: User = {
  id: 'u2',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  privilege: 'FULL_ACCESS',
};

const readOnlyUser: User = {
  id: 'u3',
  name: 'Lecteur',
  email: 'lecteur@example.com',
  role: 'user',
  privilege: 'READ',
};

const firstLoginUser: User = {
  id: 'u4',
  name: 'New User',
  email: 'new@example.com',
  role: 'user',
  privilege: 'FULL_ACCESS',
  isFirstLogin: true,
};

// ─── Helpers ──────────────────────────────────────────────

function renderApp(entries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MemoryRouter>
  );
}

function mockAuthForUser(user: User) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === '/api/auth/me') return { authenticated: true, user };
    if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
    if (path === '/api/segments') return { data: { tags: [], segments: [] } };
    return {};
  });
}

// ─── Lifecycle ────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthToken.mockImplementation(() => {
    try {
      const v =
        localStorage.getItem('euraxess_token') ||
        sessionStorage.getItem('euraxess_token');
      return v?.trim() || null;
    } catch {
      return null;
    }
  });
  mockClearStoredAuth.mockImplementation(() => {
    try {
      localStorage.removeItem('euraxess_token');
    } catch {}
    try {
      sessionStorage.removeItem('euraxess_token');
    } catch {}
  });
  mockIsTokenExpired.mockReturnValue(false);
  mockIsServiceUnreachable.mockReturnValue(false);
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/contacts'))
      return { data: { contacts: [] } };
    if (path === '/api/segments')
      return { data: { tags: [], segments: [] } };
    return {};
  });
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      text: async () => '',
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

// ─── Tests ────────────────────────────────────────────────

describe('App', () => {
  it('shows loading splash while session is being restored', async () => {
    let resolveAuth!: (v: any) => void;
    mockGetAuthToken.mockReturnValue('valid-token');
    mockIsTokenExpired.mockReturnValue(false);
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/auth/me')
        return new Promise((resolve) => {
          resolveAuth = resolve;
        });
      if (path.startsWith('/api/contacts'))
        return { data: { contacts: [] } };
      if (path === '/api/segments')
        return { data: { tags: [], segments: [] } };
      return {};
    });

    renderApp(['/dashboard']);

    expect(screen.getByText('Chargement...')).toBeInTheDocument();

    await act(async () => {
      resolveAuth({ authenticated: true, user: regularUser });
    });

    await waitFor(() => {
      expect(
        screen.queryByText('Chargement...'),
      ).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
  });

  it('shows login form when no token exists and hides Header and Footer', async () => {
    mockGetAuthToken.mockReturnValue(null);
    renderApp(['/dashboard']);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /se connecter/i }),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('shows expiry toast and login form for expired token', async () => {
    mockGetAuthToken.mockReturnValue('expired-token');
    mockIsTokenExpired.mockReturnValue(true);

    renderApp(['/dashboard']);

    expect(
      await screen.findByText(
        'Votre session a expiré. Veuillez vous reconnecter.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /se connecter/i }),
    ).toBeInTheDocument();
  });

  it('shows Header, Footer and routed content after successful authentication', async () => {
    mockGetAuthToken.mockReturnValue('valid-token');
    mockAuthForUser(regularUser);

    renderApp(['/dashboard']);

    await waitFor(() => {
      expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
    });
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('redirects admin from / to /admin', async () => {
    mockGetAuthToken.mockReturnValue('valid-token');
    mockAuthForUser(adminUser);

    renderApp(['/']);

    await waitFor(() => {
      expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
    });
  });

  it('redirects regular user from / to /dashboard', async () => {
    mockGetAuthToken.mockReturnValue('valid-token');
    mockAuthForUser(regularUser);

    renderApp(['/']);

    await waitFor(() => {
      expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
    });
  });

  it('redirects non-admin user from /admin to /dashboard', async () => {
    mockGetAuthToken.mockReturnValue('valid-token');
    mockAuthForUser(regularUser);

    renderApp(['/admin']);

    await waitFor(() => {
      expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
    });
  });

  it('transitions from login to authenticated shell after successful login', async () => {
    mockGetAuthToken.mockReturnValue(null);
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/auth/login') {
        return { token: 'new-token', user: regularUser };
      }
      if (path.startsWith('/api/contacts'))
        return { data: { contacts: [] } };
      if (path === '/api/segments')
        return { data: { tags: [], segments: [] } };
      return {};
    });

    renderApp(['/login']);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /se connecter/i }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/identifiant/i), {
      target: { value: 'jean@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /se connecter/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
    });
  });

  it('shows first-login welcome modal after login for new user', async () => {
    mockGetAuthToken.mockReturnValue(null);
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === '/api/auth/login') {
        return { token: 'new-token', user: firstLoginUser };
      }
      if (path.startsWith('/api/contacts'))
        return { data: { contacts: [] } };
      if (path === '/api/segments')
        return { data: { tags: [], segments: [] } };
      return {};
    });

    renderApp(['/login']);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /se connecter/i }),
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/identifiant/i), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'secret' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /se connecter/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/Bienvenue New/)).toBeInTheDocument();
    });
  });

  it('shows restricted access message for read-only user on create route', async () => {
    mockGetAuthToken.mockReturnValue('valid-token');
    mockAuthForUser(readOnlyUser);

    renderApp(['/contacts/new']);

    await waitFor(() => {
      expect(screen.getByText('Accès restreint')).toBeInTheDocument();
    });
    expect(screen.getByText(/lecture seule/i)).toBeInTheDocument();
  });

  it('returns to login view after logout', async () => {
    mockGetAuthToken.mockReturnValue('valid-token');
    mockAuthForUser(regularUser);

    renderApp(['/dashboard']);

    await waitFor(() => {
      expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
    });

    const header = screen.getByRole('banner');
    fireEvent.click(
      header.querySelector('button.rounded-full') as HTMLElement,
    );
    fireEvent.click(
      screen.getByRole('button', { name: /se déconnecter/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /se connecter/i }),
      ).toBeInTheDocument();
    });
  });
});
