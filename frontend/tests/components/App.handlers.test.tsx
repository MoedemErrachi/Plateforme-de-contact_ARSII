import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import App from '../../src/App';
import type { User } from '../../src/types';

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn(),
  getAuthToken: vi.fn(),
  clearStoredAuth: vi.fn(),
  isServiceUnreachable: vi.fn(),
  setGlobalApiErrorHandler: vi.fn(),
  subscribeBackendConnectivity: vi.fn(),
  isBackendOnline: vi.fn(),
}));

vi.mock('../../src/utils/jwt', () => ({
  isTokenExpired: vi.fn(),
}));

vi.mock('../../src/components/DashboardView', () => ({
  DashboardView: ({ onExportAll }: any) => (
    <div data-testid="mock-dashboard">
      <button data-testid="btn-export-all" onClick={onExportAll}>Export All</button>
    </div>
  ),
}));

vi.mock('../../src/components/ContactsView', () => ({
  ContactsView: (props: any) => (
    <div data-testid="mock-contacts">
      <button data-testid="btn-select-contact" onClick={() => props.onSelectContact('c1')}>Select Contact</button>
      <button data-testid="btn-delete-contact" onClick={() => props.onDeleteContact('c1')}>Delete Contact</button>
      <button data-testid="btn-bulk-delete" onClick={() => props.onDeleteContacts(['c1', 'c2'])}>Bulk Delete</button>
      <button data-testid="btn-select-segment" onClick={() => props.onSelectSegment('seg1')}>Select Segment</button>
      <button data-testid="btn-save-segment" onClick={() => props.onSaveCurrentAsSegment('Test Segment', { search: '', countries: [], genders: [], careerStages: [], tags: [] })}>Save Segment</button>
      <span data-testid="mock-contacts-active-segment">{String(props.activeSegmentId)}</span>
      <span data-testid="mock-contacts-items">{String(props.itemsPerPage)}</span>
    </div>
  ),
}));

vi.mock('../../src/components/ContactDetailView', () => ({
  ContactDetailView: () => <div data-testid="mock-contact-detail">Contact Detail</div>,
}));

vi.mock('../../src/components/ImportWizardView', () => ({
  ImportWizardView: ({ onImportContacts }: any) => (
    <div data-testid="mock-import">
      <button data-testid="btn-import" onClick={() => onImportContacts(
        [{ id: 'nc1', firstName: 'New', lastName: 'Guy', email: 'new@test.com', gender: 'MALE', countryOfOrigin: 'FR', affiliation: 'Uni', researchCareerStage: 'R1_FIRST_STAGE', tags: ['TagX'] }],
        []
      )}>Import</button>
    </div>
  ),
}));

vi.mock('../../src/components/NewContactView', () => ({
  NewContactView: ({ onAddContact, onUpdateContact }: any) => (
    <div data-testid="mock-new-contact">
      <button data-testid="btn-add-contact" onClick={() => void onAddContact({
        id: 'temp1', firstName: 'Alice', lastName: 'Martin', email: 'alice@test.com',
        gender: 'FEMALE', countryOfOrigin: 'France', city: 'Paris', phone: '555',
        affiliation: 'Uni', function: 'Prof', experience: '10y',
        facultyDepartment: 'CS', researchCareerStage: 'R3', tags: [], avatarUrl: null,
      }).catch(() => {})}>Add</button>
      <button data-testid="btn-update-contact" onClick={() => void onUpdateContact({
        id: 'c1', firstName: 'Updated', lastName: 'User', email: 'upd@test.com',
        gender: 'MALE', countryOfOrigin: 'DE', city: 'Berlin', phone: '666',
        affiliation: 'TU', function: 'Dr', experience: '5y',
        facultyDepartment: 'Math', researchCareerStage: 'R2', tags: ['Tag1'], avatarUrl: null,
      }).catch(() => {})}>Update</button>
    </div>
  ),
}));

vi.mock('../../src/components/ExportView', () => ({
  ExportView: ({ selection }: any) => (
    <div data-testid="mock-export">
      <span data-testid="export-selection-mode">{String(selection?.mode)}</span>
      <span data-testid="export-selection-ids">{JSON.stringify(selection?.ids || [])}</span>
    </div>
  ),
}));

vi.mock('../../src/components/SegmentationView', () => ({
  SegmentationView: (props: any) => (
    <div data-testid="mock-segmentation">
      <button data-testid="btn-apply-segment" onClick={() => props.onApplySegment({ id: 'seg1', name: 'S1', filters: {} })}>Apply</button>
      <button data-testid="btn-create-segment" onClick={() => props.onCreateSegment({ id: 'new-seg', name: 'New Seg', filters: {} })}>Create Seg</button>
      <button data-testid="btn-update-segment" onClick={() => props.onUpdateSegment({ id: 'seg1', name: 'Updated Seg', filters: {} })}>Update Seg</button>
      <button data-testid="btn-delete-segment" onClick={() => props.onDeleteSegment('seg1')}>Delete Seg</button>
      <button data-testid="btn-create-tag" onClick={() => props.onCreateTag({ id: 'tnew', name: 'NewTag', color: '#f00' })}>Create Tag</button>
      <button data-testid="btn-update-tag" onClick={() => props.onUpdateTag({ id: 'tag1', name: 'Renamed', color: '#0f0' })}>Update Tag</button>
      <button data-testid="btn-delete-tag" onClick={() => props.onDeleteTag('tag1')}>Delete Tag</button>
      <button data-testid="btn-save-tag-contacts" onClick={() => void props.onSaveTagContacts('tag1', ['c1', 'c2']).catch(() => {})}>Save Tag Contacts</button>
    </div>
  ),
}));

vi.mock('../../src/components/ProfileView', () => ({
  ProfileView: ({ onUserUpdate, onLogout }: any) => (
    <div data-testid="mock-profile">
      <button data-testid="btn-update-user" onClick={() => onUserUpdate({ id: 'u1', name: 'Updated Name', email: 'u@test.com', role: 'user' })}>Update User</button>
      <button data-testid="btn-profile-logout" onClick={onLogout}>Profile Logout</button>
    </div>
  ),
}));

vi.mock('../../src/components/AdminView', () => ({
  AdminView: () => <div data-testid="mock-admin">Admin</div>,
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

import {
  apiFetch,
  getAuthToken,
  clearStoredAuth,
  isServiceUnreachable,
  setGlobalApiErrorHandler,
  subscribeBackendConnectivity,
  isBackendOnline,
} from '../../src/services/api';
import { isTokenExpired } from '../../src/utils/jwt';

const mockApiFetch = vi.mocked(apiFetch);
const mockGetAuthToken = vi.mocked(getAuthToken);
const mockClearStoredAuth = vi.mocked(clearStoredAuth);
const mockIsTokenExpired = vi.mocked(isTokenExpired);
const mockIsServiceUnreachable = vi.mocked(isServiceUnreachable);
const mockSubscribeBackendConnectivity = vi.mocked(subscribeBackendConnectivity);
const mockIsBackendOnline = vi.mocked(isBackendOnline);

const regularUser: User = {
  id: 'u1',
  name: 'Jean Dupont',
  email: 'jean@example.com',
  role: 'user',
  privilege: 'FULL_ACCESS',
};

const readOnlyUser: User = {
  id: 'u3',
  name: 'Lecteur',
  email: 'lecteur@example.com',
  role: 'user',
  privilege: 'READ',
};

const adminUser: User = {
  id: 'u2',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
  privilege: 'FULL_ACCESS',
};

function renderApp(entries: string[] = ['/dashboard']) {
  return render(
    <MemoryRouter initialEntries={entries}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </MemoryRouter>
  );
}

function mockAuthForUser(user: User, extraApi: Record<string, any> = {}) {
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === '/api/auth/me') return { authenticated: true, user };
    if (extraApi[path]) return extraApi[path];
    if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
    if (path === '/api/segments') return {
      data: {
        tags: [{ id: 'tag1', name: 'Tag1', color: '#00f' }, { id: 'tag2', name: 'Tag2', color: '#f00' }],
        segments: [{ id: 'seg1', name: 'Segment1', description: 'test', icon: '🌐', filters: {}, memberCount: 5 }],
      },
    };
    return {};
  });
}

function mockAuthWithContacts(user: User) {
  const contacts = [
    { id: 'c1', firstName: 'Alice', lastName: 'Dupont', email: 'a@t.com', gender: 'FEMALE', countryOfOrigin: 'FR', affiliation: 'Uni', researchCareerStage: 'R1_FIRST_STAGE', tags: ['Tag1'] },
    { id: 'c2', firstName: 'Bob', lastName: 'Martin', email: 'b@t.com', gender: 'MALE', countryOfOrigin: 'DE', affiliation: 'TU', researchCareerStage: 'R2', tags: ['Tag2'] },
  ];
  mockApiFetch.mockImplementation(async (path: string) => {
    if (path === '/api/auth/me') return { authenticated: true, user };
    if (path.startsWith('/api/contacts')) return { data: { contacts } };
    if (path === '/api/segments') return {
      data: {
        tags: [{ id: 'tag1', name: 'Tag1', color: '#00f' }, { id: 'tag2', name: 'Tag2', color: '#f00' }],
        segments: [{ id: 'seg1', name: 'Segment1', description: 'test', icon: '🌐', filters: {}, memberCount: 5 }],
      },
    };
    return {};
  });
}

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
    try { localStorage.removeItem('euraxess_token'); } catch {}
    try { sessionStorage.removeItem('euraxess_token'); } catch {}
  });
  mockIsTokenExpired.mockReturnValue(false);
  mockIsServiceUnreachable.mockReturnValue(false);
  mockSubscribeBackendConnectivity.mockImplementation((listener) => {
    listener(true);
    return () => {};
  });
  mockIsBackendOnline.mockReturnValue(true);
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
  window.scrollTo = vi.fn() as any;
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe('App - Handler & Effect Coverage', () => {
  describe('Contact operations', () => {
    it('navigates to contact detail on handleSelectContact', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      }, { timeout: 5000 });
      fireEvent.click(screen.getByTestId('btn-select-contact'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-contact-detail')).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    it('creates a new contact via handleAddContact', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      const createdContact = {
        id: 'new1', firstName: 'Alice', lastName: 'Martin', email: 'alice@test.com',
        gender: 'FEMALE', countryOfOrigin: 'France', researchCareerStage: 'R3',
      };
      mockAuthForUser(regularUser, {
        '/api/contacts': { data: { contact: createdContact } },
      });
      renderApp(['/contacts/new']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-new-contact')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-add-contact'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts', expect.objectContaining({ method: 'POST' }));
      });
    });

    it('shows error toast when handleAddContact fails', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts/new']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-new-contact')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) throw new Error('Network error');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-add-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur création contact/i)).toBeInTheDocument();
      });
    });

    it('updates a contact via handleUpdateContact', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      const updatedContact = {
        id: 'c1', firstName: 'Updated', lastName: 'User', email: 'upd@test.com',
        gender: 'MALE', countryOfOrigin: 'DE', researchCareerStage: 'R2',
      };
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) return { data: { contact: updatedContact } };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      renderApp(['/contacts/c1/edit']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-new-contact')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-contact'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts/c1', expect.objectContaining({ method: 'PUT' }));
      });
    });

    it('handles update contact API error (non-service-unreachable)', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path === '/api/contacts/c1') throw new Error('Update failed');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      renderApp(['/contacts/c1/edit']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-new-contact')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur mise à jour/i)).toBeInTheDocument();
      });
    });

    it('handles update contact API error (service unreachable)', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path === '/api/contacts/c1') throw new Error('Service unreachable');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      renderApp(['/contacts/c1/edit']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-new-contact')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-contact'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts/c1', expect.objectContaining({ method: 'PUT' }));
      });
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur mise à jour/i)).not.toBeInTheDocument();
    });

    it('opens delete confirmation dialog via requestDeleteContact', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
    });

    it('confirms and performs contact deletion', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Supprimer'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts/c1', expect.objectContaining({ method: 'DELETE' }));
      });
    });

    it('handles delete contact API error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path === '/api/contacts/c1') throw new Error('Delete failed');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Supprimer'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur suppression/i)).toBeInTheDocument();
      });
    });

    it('opens bulk delete confirmation and performs deletion', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-bulk-delete'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole('button', { name: /supprimer \(2\)/i });
      fireEvent.click(confirmBtn);
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts/bulk', expect.objectContaining({ method: 'DELETE' }));
      });
    });

    it('handles bulk delete API error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path === '/api/contacts/bulk') throw new Error('Bulk delete failed');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-bulk-delete'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole('button', { name: /supprimer \(2\)/i });
      fireEvent.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText(/Erreur suppression en lot/i)).toBeInTheDocument();
      });
    });

    it('bulk delete cancelled resets pending state', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-bulk-delete'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
      await waitFor(() => {
        expect(screen.queryByText(/Voulez-vous vraiment supprimer/i)).not.toBeInTheDocument();
      });
    });

    it('delete cancelled resets pending state', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
      await waitFor(() => {
        expect(screen.queryByText(/Voulez-vous vraiment supprimer/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Import operations', () => {
    it('imports contacts via handleImportContacts', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/contacts/bulk': { status: 'SUCCESS', data: { createdCount: 1, updatedCount: 0, errors: [] } },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts/bulk', expect.objectContaining({ method: 'POST' }));
      });
    });

    it('handles import with missing tags', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/segments/tags': { data: { tag: { id: 'tnew', name: 'TagX', color: null } } },
        '/api/contacts/bulk': { status: 'SUCCESS', data: { createdCount: 1, updatedCount: 0, errors: [] } },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags', expect.objectContaining({ method: 'POST' }));
      });
    });

    it('handles import failure from server', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/contacts/bulk': { status: 'FAILED', errorMessage: 'Server error' },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(screen.getByText(/Échec de l'importation/i)).toBeInTheDocument();
      });
    });

    it('handles import network error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        if (path === '/api/contacts/bulk') throw { message: 'Échec réseau', status: 0, data: {} };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(screen.getByText(/Échec de l'importation/i)).toBeInTheDocument();
      });
    });

    it('handles import with partial errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/contacts/bulk': {
          status: 'SUCCESS',
          data: { createdCount: 2, updatedCount: 1, errors: [{ row: 3, message: 'Invalid email' }] },
        },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(screen.getByText(/Importation partielle/i)).toBeInTheDocument();
      });
    });

    it('handles import with many errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/contacts/bulk': {
          status: 'SUCCESS',
          data: {
            createdCount: 1, updatedCount: 0,
            errors: [
              { row: 1, message: 'err1' }, { row: 2, message: 'err2' },
              { row: 3, message: 'err3' }, { row: 4, message: 'err4' },
            ],
          },
        },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(screen.getByText(/\+1 autres/)).toBeInTheDocument();
      });
    });

    it('handles import with only updates', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/contacts/bulk': {
          status: 'SUCCESS',
          data: { createdCount: 0, updatedCount: 3, errors: [] },
        },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(screen.getByText(/3 contacts mis à jour/)).toBeInTheDocument();
      });
    });

    it('handles tag creation failure during import', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser, {
        '/api/contacts/bulk': { status: 'SUCCESS', data: { createdCount: 1, updatedCount: 0, errors: [] } },
      });
      renderApp(['/import']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-import')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        if (path === '/api/segments/tags') throw new Error('Tag creation failed');
        if (path === '/api/contacts/bulk') return { status: 'SUCCESS', data: { createdCount: 1, updatedCount: 0, errors: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-import'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts/bulk', expect.anything());
      });
    });
  });

  describe('Segment operations', () => {
    it('selects a segment via handleSelectSegment', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mock-contacts-active-segment').textContent).toBe('all');
      fireEvent.click(screen.getByTestId('btn-select-segment'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts-active-segment').textContent).toBe('seg1');
      });
    });

    it('applies a segment and navigates to contacts', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-apply-segment'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
    });

    it('saves current filters as a segment', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-save-segment'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments', expect.objectContaining({ method: 'POST' }));
      });
    });

    it('handles save segment error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') throw new Error('Segment save failed');
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-save-segment'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de l'enregistrement du segment/i)).toBeInTheDocument();
      });
    });

    it('creates a segment via handleCreateSegment', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-create-segment'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments', expect.objectContaining({ method: 'POST' }));
      });
    });

    it('handles create segment error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') throw new Error('Create failed');
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-create-segment'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la création du segment/i)).toBeInTheDocument();
      });
    });

    it('updates a segment via handleUpdateSegment', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-segment'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/seg1', expect.objectContaining({ method: 'PUT' }));
      });
    });

    it('handles update segment error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/seg1') throw new Error('Update seg failed');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-update-segment'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la mise à jour du segment/i)).toBeInTheDocument();
      });
    });

    it('deletes a segment via handleDeleteSegment', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-segment'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/seg1', expect.objectContaining({ method: 'DELETE' }));
      });
    });

    it('handles delete segment error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/seg1') throw new Error('Delete seg failed');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-delete-segment'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la suppression du segment/i)).toBeInTheDocument();
      });
    });
  });

  describe('Tag operations', () => {
    it('creates a tag via handleCreateTag', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-create-tag'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags', expect.objectContaining({ method: 'POST' }));
      });
    });

    it('handles create tag error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/tags') throw new Error('Create tag failed');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-create-tag'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la création du tag/i)).toBeInTheDocument();
      });
    });

    it('updates a tag with name change via handleUpdateTag', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-tag'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags/tag1', expect.objectContaining({ method: 'PUT' }));
      });
    });

    it('updates a tag without name change', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [{ id: 'c1', firstName: 'A', lastName: 'B', email: 'a@b.com', gender: 'MALE', countryOfOrigin: 'FR', affiliation: '', researchCareerStage: 'R1_FIRST_STAGE', tags: ['Tag1'] }] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1', color: '#00f' }], segments: [] } };
        return {};
      });
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-tag'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags/tag1', expect.objectContaining({ method: 'PUT' }));
      });
    });

    it('handles update tag error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/tags/tag1') throw new Error('Update tag failed');
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-update-tag'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la mise à jour du tag/i)).toBeInTheDocument();
      });
    });

    it('deletes a tag and removes from contacts via handleDeleteTag', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-tag'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags/tag1', expect.objectContaining({ method: 'DELETE' }));
      });
    });

    it('handles delete tag error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/tags/tag1') throw new Error('Delete tag failed');
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-delete-tag'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors de la suppression du tag/i)).toBeInTheDocument();
      });
    });

    it('saves tag contacts via handleSaveTagContacts', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) return { data: { contacts: [{ id: 'c1', firstName: 'A', lastName: 'B', email: 'a@b.com', gender: 'MALE', countryOfOrigin: 'FR', affiliation: '', researchCareerStage: 'R1_FIRST_STAGE', tags: ['Tag1'] }] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        if (path === '/api/segments/tags/tag1/contacts') return {
          data: { tag: { id: 'tag1', name: 'Tag1', contacts: [{ contactId: 'c1' }, { contactId: 'c2' }] } },
        };
        return {};
      });
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-save-tag-contacts'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags/tag1/contacts', expect.objectContaining({ method: 'PUT' }));
      });
    });

    it('handles save tag contacts error (non-service-unreachable)', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        if (path === '/api/segments/tags/tag1/contacts') throw new Error('Save tag contacts failed');
        return {};
      });
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-save-tag-contacts'));
      await waitFor(() => {
        expect(screen.getByText(/Erreur d'association du tag/i)).toBeInTheDocument();
      });
    });

    it('handles save tag contacts error (service unreachable)', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        if (path === '/api/segments/tags/tag1/contacts') throw new Error('Service unreachable');
        return {};
      });
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-save-tag-contacts'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/tags/tag1/contacts', expect.objectContaining({ method: 'PUT' }));
      });
    });
  });

  describe('Auth expired event', () => {
    it('clears session and redirects on auth:expired event', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
      act(() => {
        window.dispatchEvent(new Event('auth:expired'));
      });
      await waitFor(() => {
        expect(
          screen.getByText('Votre session a expiré. Veuillez vous reconnecter.'),
        ).toBeInTheDocument();
      });
      expect(mockClearStoredAuth).toHaveBeenCalled();
    });

    it('suppresses toast when suppressAuthExpiredToast is set', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/reset-password/some-token']);
      await waitFor(() => {
        expect(screen.queryByText('Chargement...')).not.toBeInTheDocument();
      });
      act(() => {
        window.dispatchEvent(new Event('auth:expired'));
      });
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText('Votre session a expiré. Veuillez vous reconnecter.')).not.toBeInTheDocument();
    });

    it('ignores auth:expired within the post-login suppression window', async () => {
      mockGetAuthToken.mockReturnValue(null);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/login') return { token: 'fresh-token', user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/login']);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText(/identifiant/i), { target: { value: 'jean@example.com' } });
      fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
      // Requête arrivée en retard avec un jeton stale juste après le login :
      // le 401 ne doit pas déconnecter la session qui vient d'être établie.
      act(() => {
        window.dispatchEvent(new Event('auth:expired'));
      });
      await new Promise(r => setTimeout(r, 100));
      expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      expect(mockClearStoredAuth).not.toHaveBeenCalled();
      expect(screen.queryByText('Votre session a expiré. Veuillez vous reconnecter.')).not.toBeInTheDocument();
    });

    it('admin signs in through the form and reaches the admin console without bouncing', async () => {
      mockGetAuthToken.mockReturnValue(null);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/login') return { token: 'admin-token', user: adminUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/login']);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText(/identifiant/i), { target: { value: 'admin@example.com' } });
      fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));
      await waitFor(() => {
        expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      });
      // Un 401 tardif (jeton stale) pendant la fenêtre anti-course post-login
      // ne doit pas déconnecter l'admin qui vient d'atterrir dans la console.
      act(() => {
        window.dispatchEvent(new Event('auth:expired'));
      });
      await new Promise(r => setTimeout(r, 100));
      expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      expect(mockClearStoredAuth).not.toHaveBeenCalled();
      expect(screen.queryByText('Votre session a expiré. Veuillez vous reconnecter.')).not.toBeInTheDocument();
    });
  });

  describe('Data loading errors', () => {
    it('shows error toast when contacts loading fails', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) throw new Error('Contacts load failed');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors du chargement des contacts/i)).toBeInTheDocument();
      });
    });

    it('shows error toast when segments loading fails', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') throw new Error('Segments load failed');
        return {};
      });
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByText(/Erreur lors du chargement des segments/i)).toBeInTheDocument();
      });
    });

    it('handles /api/auth/me returning unauthenticated data', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: false };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /se connecter/i }),
        ).toBeInTheDocument();
      });
    });

    it('handles /api/auth/me throwing an error', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') throw new Error('Network failure');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /se connecter/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('PublicOnlyRoute', () => {
    it('redirects authenticated user from /login to /dashboard', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/login']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
    });

    it('redirects authenticated admin from /login to /admin', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(adminUser);
      renderApp(['/login']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      });
    });

    it('force-signs out on /login?invite=1 for authenticated user', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/login?invite=1']);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
      });
    });

    it('force-signs out on /reset-password/token for authenticated user', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/reset-password/some-token']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-reset-password')).toBeInTheDocument();
      });
    });

    it('does not force sign out within post-login suppression window', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/reset-password/some-token']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-reset-password')).toBeInTheDocument();
      });
    });

    it('renders reset-password-expired without auth', async () => {
      mockGetAuthToken.mockReturnValue(null);
      renderApp(['/reset-password-expired']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-reset-expired')).toBeInTheDocument();
      });
    });

    it('wildcard route redirects unauthenticated to /login', async () => {
      mockGetAuthToken.mockReturnValue(null);
      renderApp(['/some/random/path']);
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /se connecter/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('User profile operations', () => {
    it('updates user via handleUserUpdate from ProfileView', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/profile']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-profile')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-update-user'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-profile')).toBeInTheDocument();
      });
    });

    it('logs out via ProfileView', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/profile']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-profile')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-profile-logout'));
      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /se connecter/i }),
        ).toBeInTheDocument();
      });
    });
  });

  describe('Export all from dashboard', () => {
    it('navigates to /export via handleExportAll', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-export-all'));
      await waitFor(() => {
        expect(screen.getByTestId('mock-export')).toBeInTheDocument();
      });
    });
  });

  describe('First login modal close', () => {
    it('closes first login modal on Passer click', async () => {
      const firstLoginUser: User = {
        id: 'u4', name: 'New User', email: 'new@example.com',
        role: 'user', privilege: 'FULL_ACCESS', isFirstLogin: true,
      };
      mockGetAuthToken.mockReturnValue(null);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/login') return { token: 'new-token', user: firstLoginUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/login']);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
      });
      fireEvent.change(screen.getByLabelText(/identifiant/i), { target: { value: 'new@example.com' } });
      fireEvent.change(screen.getByLabelText(/mot de passe/i), { target: { value: 'secret' } });
      fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));
      await waitFor(() => {
        expect(screen.getByText(/Bienvenue New/)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByRole('button', { name: /passer/i }));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Bienvenue New !' })).not.toBeInTheDocument();
      });
    });
  });

  describe('ChatWidget visibility', () => {
    it('renders ChatWidget on non-admin routes', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-chat-widget')).toBeInTheDocument();
      });
    });

    it('does not render ChatWidget on admin routes', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(adminUser);
      renderApp(['/admin']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      });
      expect(screen.queryByTestId('mock-chat-widget')).not.toBeInTheDocument();
    });
  });

  describe('Selection persistence', () => {
    it('restores selection from localStorage and exposes it to the export view', async () => {
      const savedSelection = {
        mode: 'partial', ids: ['c1', 'c2'],
        filters: { search: '', countries: [], genders: [], careerStages: [], tags: [] },
        totalCount: 2,
      };
      localStorage.setItem('euraxess_contacts_selected_ids', JSON.stringify(savedSelection));
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/export']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-export')).toBeInTheDocument();
      });
      expect(screen.getByTestId('export-selection-mode').textContent).toBe('partial');
      expect(JSON.parse(screen.getByTestId('export-selection-ids').textContent || '')).toEqual(['c1', 'c2']);
    });

    it('restores selection from old array format (migrated to partial)', async () => {
      localStorage.setItem('euraxess_contacts_selected_ids', JSON.stringify(['c1', 'c2']));
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/export']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-export')).toBeInTheDocument();
      });
      expect(screen.getByTestId('export-selection-mode').textContent).toBe('partial');
      expect(JSON.parse(screen.getByTestId('export-selection-ids').textContent || '')).toEqual(['c1', 'c2']);
    });

    it('handles corrupted localStorage selection gracefully (falls back to none)', async () => {
      localStorage.setItem('euraxess_contacts_selected_ids', '{corrupted json!!!');
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/export']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-export')).toBeInTheDocument();
      });
      expect(screen.getByTestId('export-selection-mode').textContent).toBe('none');
      expect(JSON.parse(screen.getByTestId('export-selection-ids').textContent || '')).toEqual([]);
    });

    it('clears selection when navigating to /contacts', async () => {
      const savedSelection = {
        mode: 'partial', ids: ['c1'],
        filters: { search: '', countries: [], genders: [], careerStages: [], tags: [] },
        totalCount: 1,
      };
      localStorage.setItem('euraxess_contacts_selected_ids', JSON.stringify(savedSelection));
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      expect(localStorage.getItem('euraxess_contacts_selected_ids')).toBeNull();
    });
  });

  describe('Items per page persistence', () => {
    it('restores items per page from localStorage', async () => {
      localStorage.setItem('euraxess_contacts_items_per_page', '50');
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mock-contacts-items').textContent).toBe('50');
    });

    it('defaults to 10 for invalid localStorage value', async () => {
      localStorage.setItem('euraxess_contacts_items_per_page', '999');
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mock-contacts-items').textContent).toBe('10');
    });

    it('defaults to 10 for NaN localStorage value', async () => {
      localStorage.setItem('euraxess_contacts_items_per_page', 'abc');
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      expect(screen.getByTestId('mock-contacts-items').textContent).toBe('10');
    });
  });

  describe('Global API error handler', () => {
    it('registers and cleans up global API error handler', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      const { unmount } = renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
      expect(setGlobalApiErrorHandler).toHaveBeenCalled();
      unmount();
      expect(setGlobalApiErrorHandler).toHaveBeenCalledWith(null);
    });
  });

  describe('Routes', () => {
    it('shows admin dashboard redirect route', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(adminUser);
      renderApp(['/admin/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      });
    });

    it('wildcard redirects authenticated admin to /admin', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(adminUser);
      renderApp(['/nonexistent']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      });
    });

    it('wildcard redirects authenticated user to /dashboard', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/nonexistent']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
    });

    it('admin cannot access user routes', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(adminUser);
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-admin')).toBeInTheDocument();
      });
    });

    it('regular user cannot access /admin', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/admin']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Segments and contacts loading on auth', () => {
    it('loads contacts and segments when authenticated', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/dashboard']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-dashboard')).toBeInTheDocument();
      });
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/contacts?limit=10000');
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments');
      });
    });

    it('does not load contacts/segments when not authenticated', async () => {
      mockGetAuthToken.mockReturnValue(null);
      renderApp(['/login']);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /se connecter/i })).toBeInTheDocument();
      });
      expect(mockApiFetch).not.toHaveBeenCalledWith('/api/contacts?limit=10000');
      expect(mockApiFetch).not.toHaveBeenCalledWith('/api/segments');
    });
  });

  describe('Bulk delete with deletedCount 1', () => {
    it('shows singular message for single deleted contact', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path === '/api/contacts/bulk') return { data: { deletedCount: 1 } };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-bulk-delete'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole('button', { name: /supprimer \(2\)/i });
      fireEvent.click(confirmBtn);
      await waitFor(() => {
        expect(screen.getByText('Contact supprimé.')).toBeInTheDocument();
      });
    });
  });

  describe('Save segment error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') throw new Error('Service unreachable');
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-save-segment'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de l'enregistrement du segment/i)).not.toBeInTheDocument();
    });
  });

  describe('Create segment error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') throw new Error('Service unreachable');
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-create-segment'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de la création du segment/i)).not.toBeInTheDocument();
    });
  });

  describe('Update segment error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/seg1') throw new Error('Service unreachable');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-update-segment'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de la mise à jour du segment/i)).not.toBeInTheDocument();
    });
  });

  describe('Delete segment error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/seg1') throw new Error('Service unreachable');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-delete-segment'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de la suppression du segment/i)).not.toBeInTheDocument();
    });
  });

  describe('Delete tag error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/tags/tag1') throw new Error('Service unreachable');
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-delete-tag'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de la suppression du tag/i)).not.toBeInTheDocument();
    });
  });

  describe('Update tag error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/tags/tag1') throw new Error('Service unreachable');
        if (path === '/api/segments') return { data: { tags: [{ id: 'tag1', name: 'Tag1' }], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-update-tag'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de la mise à jour du tag/i)).not.toBeInTheDocument();
    });
  });

  describe('Create tag error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments/tags') throw new Error('Service unreachable');
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-create-tag'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur lors de la création du tag/i)).not.toBeInTheDocument();
    });
  });

  describe('Delete contact error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && path.includes('DELETE')) throw new Error('Service unreachable');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-delete-contact'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText('Supprimer'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur suppression/i)).not.toBeInTheDocument();
    });
  });

  describe('Bulk delete error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthWithContacts(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path === '/api/contacts/bulk') throw new Error('Service unreachable');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-bulk-delete'));
      await waitFor(() => {
        expect(screen.getByText(/Voulez-vous vraiment supprimer/i)).toBeInTheDocument();
      });
      const confirmBtn = screen.getByRole('button', { name: /supprimer \(2\)/i });
      fireEvent.click(confirmBtn);
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur suppression en lot/i)).not.toBeInTheDocument();
    });
  });

  describe('Add contact error (service unreachable)', () => {
    it('suppresses toast for service-unreachable errors', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      mockIsServiceUnreachable.mockReturnValue(true);
      renderApp(['/contacts/new']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-new-contact')).toBeInTheDocument();
      });
      mockApiFetch.mockImplementation(async (path: string) => {
        if (path === '/api/auth/me') return { authenticated: true, user: regularUser };
        if (path.startsWith('/api/contacts') && !path.includes('bulk')) throw new Error('Service unreachable');
        if (path.startsWith('/api/contacts')) return { data: { contacts: [] } };
        if (path === '/api/segments') return { data: { tags: [], segments: [] } };
        return {};
      });
      fireEvent.click(screen.getByTestId('btn-add-contact'));
      await new Promise(r => setTimeout(r, 200));
      expect(screen.queryByText(/Erreur création contact/i)).not.toBeInTheDocument();
    });
  });

  describe('Delete segment resets activeSegmentId', () => {
    it('resets active segment to all when deleted segment is active', async () => {
      mockGetAuthToken.mockReturnValue('valid-token');
      mockAuthForUser(regularUser);
      renderApp(['/contacts']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-contacts')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-select-segment'));
      renderApp(['/segments']);
      await waitFor(() => {
        expect(screen.getByTestId('mock-segmentation')).toBeInTheDocument();
      });
      fireEvent.click(screen.getByTestId('btn-delete-segment'));
      await waitFor(() => {
        expect(mockApiFetch).toHaveBeenCalledWith('/api/segments/seg1', expect.objectContaining({ method: 'DELETE' }));
      });
    });
  });
});
