import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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
    expect((await screen.findAllByText('Alice Dupont')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('alice@euraxess-africa.org')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Martin').length).toBeGreaterThan(0);
    expect(screen.getByTitle(/Filtrer par rôle/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('utilisateur(s)')).toBeInTheDocument();
  });

  it('pins the Actions column to the right edge for small screens', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');
    const table = screen.getByRole('table');
    const header = within(table).getByRole('columnheader', { name: 'Actions' });
    expect(header).toHaveClass('sticky', 'right-0', 'bg-[#F4F6F8]');
    const actionCells = within(table)
      .getAllByTitle('Consulter')
      .map(btn => btn.closest('td'));
    expect(actionCells.length).toBeGreaterThan(0);
    for (const cell of actionCells) {
      expect(cell).toHaveClass('sticky', 'right-0', 'bg-white');
    }
  });

  it('stacks search, filters and the create button on small screens', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');
    const roleSelect = screen.getByTitle(/Filtrer par rôle/i);
    const toolbar = roleSelect.closest('div')?.parentElement;
    expect(toolbar?.className).toContain('flex-col sm:flex-row sm:flex-wrap sm:items-center');
    const createButton = screen.getByRole('button', { name: /Créer un utilisateur/i });
    expect(createButton.className).toContain('w-full sm:w-auto sm:ml-auto');
    const selectContainer = roleSelect.closest('div');
    expect(selectContainer?.className).toContain('grid grid-cols-2 gap-2.5 w-full sm:w-auto');
    expect(roleSelect.className).toContain('w-full min-w-0');
  });

  it('renders a mobile card layout with the essential fields and actions', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');
    const cards = screen.getByTestId('admin-mobile-cards');
    expect(cards).toHaveClass('md:hidden');
    const desktopTableWrapper = screen.getByRole('table').closest('div');
    expect(desktopTableWrapper?.className).toContain('hidden md:block');
    expect(within(cards).getAllByText('Alice Dupont').length).toBeGreaterThan(0);
    expect(within(cards).getAllByText('alice@euraxess-africa.org').length).toBeGreaterThan(0);
    expect(within(cards).getByText('admin')).toBeInTheDocument();
    expect(within(cards).getByText('Bob Martin')).toBeInTheDocument();
    expect(within(cards).getAllByTitle('Consulter').length).toBeGreaterThan(0);
    expect(within(cards).getAllByTitle('Supprimer').length).toBeGreaterThan(0);
  });

  it('displays an empty message when the API returns no users', async () => {
    const emptyMock = vi.fn(() => Promise.resolve(fakeJsonResponse({ users: [] })));
    vi.stubGlobal('fetch', emptyMock);
    renderAdminView();
    expect(await screen.findByText('Aucun utilisateur trouvé.')).toBeInTheDocument();
  });

  it('filters the user list by search query', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');

    fireEvent.change(screen.getByPlaceholderText('Rechercher par nom ou e-mail…'), { target: { value: 'bob' } });

    expect(screen.queryByText('Alice Dupont')).not.toBeInTheDocument();
    expect(screen.getAllByText('Bob Martin').length).toBeGreaterThan(0);
  });

  it('filters the user list by role', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');

    fireEvent.change(screen.getByTitle(/Filtrer par rôle/i), { target: { value: 'admin' } });

    expect(screen.getAllByText('Alice Dupont').length).toBeGreaterThan(0);
    expect(screen.queryByText('Bob Martin')).not.toBeInTheDocument();
  });

  it('warns and refuses to create a user whose email already exists', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');

    fireEvent.click(screen.getByRole('button', { name: /Créer un utilisateur/i }));
    fireEvent.change(screen.getByLabelText(/Nom complet/i), { target: { value: 'Alice Dupont' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'alice@euraxess-africa.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));

    expect(screen.getByText('Un compte existe déjà pour alice@euraxess-africa.org.')).toBeInTheDocument();
    expect(calls.some(c => c.url === '/api/admin/users' && c.init?.method === 'POST')).toBe(false);
  });

  it('creates a user via the confirmation panel and shows the temporary password', async () => {
    renderAdminView();
    await screen.findAllByText('Alice Dupont');

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
    fireEvent.click((await screen.findAllByText('Bob Martin'))[0]);

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
    await screen.findAllByText('Alice Dupont');

    const deleteButtons = screen.getAllByTitle('Supprimer');
    fireEvent.click(deleteButtons[0]);

    expect(await screen.findByText("Supprimer l'utilisateur")).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole('button', { name: 'Supprimer' });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    expect(await screen.findByText('Utilisateur supprimé.')).toBeInTheDocument();
    expect(calls.some(c => c.url === '/api/admin/users/u1' && c.init?.method === 'DELETE')).toBe(true);
  });
});
