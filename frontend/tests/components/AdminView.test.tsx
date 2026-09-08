import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminView } from '../../src/components/AdminView';
import { ToastProvider } from '../../src/components/Toast';

const USERS = [
  { id: 'u1', name: 'Alice Dupont', email: 'alice@euraxess-africa.org', role: 'admin', privilege: 'FULL_ACCESS', lastLogin: '2025-06-01T10:00:00Z', createdAt: '2024-01-15T00:00:00Z' },
  { id: 'u2', name: 'Bob Martin', email: 'bob@euraxess-africa.org', role: 'user', privilege: 'READ', lastLogin: null, createdAt: '2024-02-01T00:00:00Z' }
];

function fakeJsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function apiRouter() {
  const calls: { url: string; init?: RequestInit }[] = [];
  const mock = vi.fn((url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const method = (init.method || 'GET').toUpperCase();

    if (method === 'GET' && url.startsWith('/api/admin/users')) {
      return Promise.resolve(fakeJsonResponse({ users: USERS }));
    }
    if (method === 'POST' && url === '/api/admin/users') {
      return Promise.resolve(fakeJsonResponse({ temporaryPassword: 'TempPass123' }));
    }
    if (method === 'PUT' && url.startsWith('/api/admin/users/')) {
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    }
    if (method === 'DELETE' && url.startsWith('/api/admin/users/')) {
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    }
    return Promise.resolve(fakeJsonResponse({ message: 'Not found' }, false, 404));
  });
  return { mock, calls };
}

let fetchMock: ReturnType<typeof vi.fn>;
let calls: { url: string; init?: RequestInit }[];

beforeEach(() => {
  const router = apiRouter();
  fetchMock = router.mock;
  calls = router.calls;
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function renderAdminView() {
  render(
    <ToastProvider>
      <AdminView />
    </ToastProvider>
  );
}

describe('AdminView', () => {
  it('loads and renders users from the API', async () => {
    renderAdminView();
    expect(await screen.findByText('Alice Dupont')).toBeInTheDocument();
    expect(screen.getByText('alice@euraxess-africa.org')).toBeInTheDocument();
    expect(screen.getByText('Bob Martin')).toBeInTheDocument();
    expect(screen.getByTitle(/Filtrer par rôle/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('utilisateur(s)')).toBeInTheDocument();
  });

  it('displays an empty message when the API returns no users', async () => {
    const emptyMock = vi.fn(() => Promise.resolve(fakeJsonResponse({ users: [] })));
    vi.stubGlobal('fetch', emptyMock);
    renderAdminView();
    expect(await screen.findByText('Aucun utilisateur trouvé.')).toBeInTheDocument();
  });

  it('filters the user list by search query', async () => {
    renderAdminView();
    await screen.findByText('Alice Dupont');

    fireEvent.change(screen.getByPlaceholderText('Rechercher par nom ou e-mail…'), { target: { value: 'bob' } });

    expect(screen.queryByText('Alice Dupont')).not.toBeInTheDocument();
    expect(screen.getByText('Bob Martin')).toBeInTheDocument();
  });

  it('filters the user list by role', async () => {
    renderAdminView();
    await screen.findByText('Alice Dupont');

    fireEvent.change(screen.getByTitle(/Filtrer par rôle/i), { target: { value: 'admin' } });

    expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
    expect(screen.queryByText('Bob Martin')).not.toBeInTheDocument();
  });

  it('warns and refuses to create a user whose email already exists', async () => {
    renderAdminView();
    await screen.findByText('Alice Dupont');

    fireEvent.click(screen.getByRole('button', { name: /Créer un utilisateur/i }));
    fireEvent.change(screen.getByLabelText(/Nom complet/i), { target: { value: 'Alice Dupont' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'alice@euraxess-africa.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByText('Un compte existe déjà pour alice@euraxess-africa.org.')).toBeInTheDocument();
    expect(calls.some(c => c.url === '/api/admin/users' && c.init?.method === 'POST')).toBe(false);
  });

  it('creates a user via the confirmation panel and shows the temporary password', async () => {
    renderAdminView();
    await screen.findByText('Alice Dupont');

    fireEvent.click(screen.getByRole('button', { name: /Créer un utilisateur/i }));
    fireEvent.change(screen.getByLabelText(/Nom complet/i), { target: { value: 'Carol Nguyen' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'carol@euraxess-africa.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(await screen.findByText('Confirmer la création')).toBeInTheDocument();
    expect(screen.getByText('carol@euraxess-africa.org')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirmer et envoyer l'e-mail/i }));

    expect(await screen.findByText('TempPass123')).toBeInTheDocument();
    const postCall = calls.find(c => c.url === '/api/admin/users' && c.init?.method === 'POST');
    expect(postCall).toBeDefined();
    expect(JSON.parse(postCall!.init!.body as string)).toEqual({
      name: 'Carol Nguyen',
      email: 'carol@euraxess-africa.org',
      role: 'user',
      privilege: 'FULL_ACCESS'
    });
  });

  it('opens the user details panel and saves a new privilege', async () => {
    renderAdminView();
    fireEvent.click(await screen.findByText('Bob Martin'));

    expect(await screen.findByText('Fiche utilisateur')).toBeInTheDocument();

    const combos = screen.getAllByRole('combobox');
    const privilegeSelect = combos[combos.length - 1];
    fireEvent.change(privilegeSelect, { target: { value: 'READ_WRITE' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer le nouveau privilège/i }));

    expect(await screen.findByText('Privilège mis à jour.')).toBeInTheDocument();
    const putCall = calls.find(c => c.url === '/api/admin/users/u2' && c.init?.method === 'PUT');
    expect(putCall).toBeDefined();
    expect(JSON.parse(putCall!.init!.body as string)).toEqual({ privilege: 'READ_WRITE' });
  });

  it('deletes an existing user after confirmation', async () => {
    renderAdminView();
    await screen.findByText('Alice Dupont');

    const deleteButtons = screen.getAllByTitle('Supprimer');
    fireEvent.click(deleteButtons[0]);

    expect(await screen.findByText("Supprimer l'utilisateur")).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Utilisateur supprimé.')).toBeInTheDocument();
    expect(calls.some(c => c.url === '/api/admin/users/u1' && c.init?.method === 'DELETE')).toBe(true);
  });
});
