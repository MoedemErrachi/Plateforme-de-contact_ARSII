import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ResetPasswordPage } from '../../src/pages/ResetPasswordPage';

function renderPage(path: string) {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/reset-password-expired" element={<h1>PAGE EXPIRÉE</h1>} />
      </Routes>
    </MemoryRouter>
  );
  return fetchMock;
}

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, async json() { return body; } } as Response;
}

function errResponse(status: number, body: unknown): Response {
  return { ok: false, status, async json() { return body; } } as Response;
}

function fillPasswords(pwd: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: pwd } });
  fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: confirm } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: /Réinitialiser le mot de passe/ }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ResetPasswordPage', () => {
  it('redirects to the expired page when no token is present in the URL', async () => {
    renderPage('/reset-password');
    expect(await screen.findByRole('heading', { name: 'PAGE EXPIRÉE' })).toBeInTheDocument();
  });

  it('renders the form when a token is present', () => {
    renderPage('/reset-password/tok123');
    expect(screen.getByRole('button', { name: /Réinitialiser le mot de passe/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Retour à la connexion' })).toHaveAttribute('href', '/login');
  });

  it('flags an empty submit', () => {
    renderPage('/reset-password/tok123');
    submit();
    expect(screen.getByText('Veuillez remplir les deux champs.')).toBeInTheDocument();
  });

  it('rejects a password shorter than 8 characters', () => {
    renderPage('/reset-password/tok123');
    fillPasswords('short', 'short');
    submit();
    expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères.')).toBeInTheDocument();
  });

  it('rejects mismatching passwords', () => {
    renderPage('/reset-password/tok123');
    fillPasswords('abcdefgh', 'abcdefgi');
    submit();
    expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
  });

  it('shows the success view after a successful reset', async () => {
    const fetchMock = renderPage('/reset-password/tok123');
    fetchMock.mockResolvedValue(okResponse({}));
    fillPasswords('abcdefgh', 'abcdefgh');
    submit();
    expect(await screen.findByText('Mot de passe réinitialisé')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Se connecter/ })).toHaveAttribute('href', '/login');
  });

  it('redirects to the expired page on 400/404/410 responses', async () => {
    const fetchMock = renderPage('/reset-password/tok123');
    fetchMock.mockResolvedValue(errResponse(400, { error: 'lien expiré' }));
    fillPasswords('abcdefgh', 'abcdefgh');
    submit();
    expect(await screen.findByRole('heading', { name: 'PAGE EXPIRÉE' })).toBeInTheDocument();
  });

  it('shows a server error for other statuses', async () => {
    const fetchMock = renderPage('/reset-password/tok123');
    fetchMock.mockResolvedValue(errResponse(500, { error: 'erreur serveur' }));
    fillPasswords('abcdefgh', 'abcdefgh');
    submit();
    expect(await screen.findByText('erreur serveur')).toBeInTheDocument();
  });

  it('shows a network error message when fetch rejects', async () => {
    const fetchMock = renderPage('/reset-password/tok123');
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    fillPasswords('abcdefgh', 'abcdefgh');
    submit();
    expect(await screen.findByText('Erreur réseau. Vérifiez que le serveur est démarré.')).toBeInTheDocument();
  });

  it('toggles the password visibility with the eye button', () => {
    renderPage('/reset-password/tok123');
    const input = screen.getByLabelText('Nouveau mot de passe');
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.click(screen.getByRole('button', { name: '' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});