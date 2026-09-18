import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FirstLoginWelcomeModal } from '../../src/components/FirstLoginWelcomeModal';
import { ToastProvider } from '../../src/components/Toast';

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn(),
  isServiceUnreachable: (err: any) => err?.kind === 'network' || err?.kind === 'timeout' || err?.kind === 'server'
}));

import { apiFetch } from '../../src/services/api';
const apiFetchMock = vi.mocked(apiFetch);

function renderModal(overrides: Partial<React.ComponentProps<typeof FirstLoginWelcomeModal>> = {}) {
  const props = { open: true, userName: 'Jean', onClose: vi.fn(), ...overrides };
  render(
    <ToastProvider>
      <FirstLoginWelcomeModal {...props} />
    </ToastProvider>
  );
  return props;
}

function fillPasswords(pwd: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: pwd } });
  fireEvent.change(screen.getByLabelText('Confirmer le mot de passe'), { target: { value: confirm } });
}

beforeEach(() => {
  apiFetchMock.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

describe('FirstLoginWelcomeModal', () => {
  it('renders nothing when closed', () => {
    const { queryByRole, queryByLabelText } = render(
      <ToastProvider>
        <FirstLoginWelcomeModal open={false} userName="Jean" onClose={() => {}} />
      </ToastProvider>
    );
    expect(queryByRole('heading', { name: 'Bienvenue Jean !' })).not.toBeInTheDocument();
    expect(queryByLabelText('Nouveau mot de passe')).not.toBeInTheDocument();
  });

  it('renders the welcome title and the password fields', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Bienvenue Jean !' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer le mot de passe')).toBeInTheDocument();
  });

  it('flags an empty submit', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));
    expect(screen.getByText('Veuillez remplir les deux champs.')).toBeInTheDocument();
  });

  it('rejects a password shorter than 8 characters', () => {
    renderModal();
    fillPasswords('short', 'short');
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));
    expect(screen.getByText('Le mot de passe doit contenir au moins 8 caractères.')).toBeInTheDocument();
  });

  it('rejects mismatching passwords', () => {
    renderModal();
    fillPasswords('abcdefgh', 'abcdefgi');
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));
    expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
  });

  it('stores the returned token in sessionStorage when no localStorage token exists', async () => {
    apiFetchMock.mockResolvedValue({ token: 'fresh-token' });
    const props = renderModal();
    fillPasswords('abcdefgh', 'abcdefgh');
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(sessionStorage.getItem('euraxess_token')).toBe('fresh-token');
    expect(localStorage.getItem('euraxess_token')).toBeNull();
    expect(screen.getByText('Mot de passe défini avec succès. Bienvenue !')).toBeInTheDocument();
  });

  it('keeps the token in localStorage when a localStorage token already exists', async () => {
    localStorage.setItem('euraxess_token', 'old-token');
    apiFetchMock.mockResolvedValue({ token: 'fresh-token' });
    const props = renderModal();
    fillPasswords('abcdefgh', 'abcdefgh');
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));

    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(localStorage.getItem('euraxess_token')).toBe('fresh-token');
  });

  it('shows the server validation error locally when not a service failure', async () => {
    apiFetchMock.mockRejectedValue(Object.assign(new Error('Le mot de passe a déjà été utilisé.'), { kind: 'client' }));
    renderModal();
    fillPasswords('abcdefgh', 'abcdefgh');
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));
    expect(await screen.findByText('Le mot de passe a déjà été utilisé.')).toBeInTheDocument();
  });

  it('closes without an error toast when the network is unreachable', async () => {
    apiFetchMock.mockRejectedValue(Object.assign(new Error('Impossible de contacter le serveur.'), { kind: 'network' }));
    const props = renderModal();
    fillPasswords('abcdefgh', 'abcdefgh');
    fireEvent.click(screen.getByRole('button', { name: 'Définir mon mot de passe' }));
    await waitFor(() => expect(props.onClose).not.toHaveBeenCalled());
  });

  it('skips and closes on success, showing the welcome toast', async () => {
    apiFetchMock.mockResolvedValue({});
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
    expect(screen.getByText('Bienvenue Jean ! Pensez à changer votre mot de passe depuis votre profil.')).toBeInTheDocument();
  });

  it('closes even when the skip request fails', async () => {
    apiFetchMock.mockRejectedValue(Object.assign(new Error('net'), { kind: 'network' }));
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Passer' }));
    await waitFor(() => expect(props.onClose).toHaveBeenCalled());
  });
});