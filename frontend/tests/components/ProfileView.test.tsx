import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import { ProfileView } from '../../src/components/ProfileView';
import { User } from '../../src/types';

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn(),
  isServiceUnreachable: vi.fn(() => false),
}));

import { apiFetch, isServiceUnreachable } from '../../src/services/api';

const baseUser: User = {
  id: 'u1',
  name: 'Alice Dupont',
  email: 'alice@test.com',
  role: 'admin',
  avatarUrl: null,
};

function renderProfile(user: User | null = baseUser, overrides: Record<string, unknown> = {}) {
  const onUserUpdate = vi.fn();
  const onLogout = vi.fn();
  const result = render(
    <MemoryRouter>
      <ToastProvider>
        <ProfileView user={user} onUserUpdate={onUserUpdate} onLogout={onLogout} {...overrides} />
      </ToastProvider>
    </MemoryRouter>
  );
  return { ...result, onUserUpdate, onLogout };
}

// Dans la modale de changement de mot de passe, le bouton d'envoi est le seul
// bouton "submit" portant ce libellé (le lien d'ouverture est type="button").
function getPasswordSubmit() {
  return screen
    .getAllByRole('button', { name: /^Modifier le mot de passe$/i })
    .find((b) => b.getAttribute('type') === 'submit');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  (apiFetch as any).mockReset();
  (isServiceUnreachable as any).mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ProfileView', () => {
  it('renders user info in the avatar card and role badge', () => {
    renderProfile();
    expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
    expect(screen.getByText('alice@test.com')).toBeInTheDocument();
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });

  it('shows initials in the avatar when no avatarUrl', () => {
    renderProfile();
    expect(screen.getByText('AD')).toBeInTheDocument();
  });

  it('shows the avatar image when avatarUrl is set', () => {
    renderProfile({ ...baseUser, avatarUrl: 'https://img.test/a.png' });
    const img = screen.getByAltText('Photo de profil');
    expect(img).toHaveAttribute('src', 'https://img.test/a.png');
  });

  it('shows "Profil non disponible" when user is null', () => {
    renderProfile(null);
    expect(screen.getByText('Profil non disponible.')).toBeInTheDocument();
  });

  it('shows "Membre EURAXESS Africa" for a non-admin user', () => {
    renderProfile({ ...baseUser, role: 'user' });
    expect(screen.getByText('Membre EURAXESS Africa')).toBeInTheDocument();
  });

  it('pre-fills name and email from user prop', () => {
    renderProfile();
    expect(screen.getByLabelText('Nom complet')).toHaveValue('Alice Dupont');
    expect(screen.getByLabelText('Adresse e-mail')).toHaveValue('alice@test.com');
  });

  it('validates name is required before saving', async () => {
    renderProfile();
    const nameInput = screen.getByLabelText('Nom complet');
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() => {
      expect(screen.getByText('Le nom complet est requis.')).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('validates email must be present before saving', async () => {
    renderProfile();
    const emailInput = screen.getByLabelText('Adresse e-mail');
    fireEvent.change(emailInput, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() => {
      expect(screen.getByText('Adresse e-mail invalide.')).toBeInTheDocument();
    });
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it('saves profile and calls onUserUpdate on success', async () => {
    const { onUserUpdate } = renderProfile();
    const nameInput = screen.getByLabelText('Nom complet');
    fireEvent.change(nameInput, { target: { value: 'Alice Martin' } });

    (apiFetch as any).mockResolvedValueOnce({ user: { ...baseUser, name: 'Alice Martin' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({ method: 'PUT' }));
    });
    await waitFor(() => {
      expect(onUserUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice Martin' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Profil mis à jour avec succès.')).toBeInTheDocument();
    });
  });

  it('calls onLogout when the logout button is clicked', () => {
    const { onLogout } = renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /se déconnecter/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('opens the password change modal when clicking "Modifier le mot de passe"', () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /modifier le mot de passe/i }));
    expect(screen.getByLabelText('Mot de passe actuel')).toBeInTheDocument();
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer le nouveau mot de passe')).toBeInTheDocument();
  });

  it('validates all password fields are required', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /modifier le mot de passe/i }));
    const form = screen.getByLabelText('Mot de passe actuel').closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText('Tous les champs sont requis.')).toBeInTheDocument();
    });
  });

  it('validates minimum password length', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /modifier le mot de passe/i }));
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'short' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'short' } });
    fireEvent.click(getPasswordSubmit()!);

    await waitFor(() => {
      expect(screen.getByText('Le nouveau mot de passe doit contenir au moins 8 caractères.')).toBeInTheDocument();
    });
  });

  it('validates password confirmation matches', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /modifier le mot de passe/i }));
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'different' } });
    fireEvent.click(getPasswordSubmit()!);

    await waitFor(() => {
      expect(screen.getByText('Les mots de passe ne correspondent pas.')).toBeInTheDocument();
    });
  });

  it('shows confirmation modal after valid password inputs, then calls API on confirm', async () => {
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /modifier le mot de passe/i }));
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'newpass123' } });
    fireEvent.click(getPasswordSubmit()!);

    await waitFor(() => {
      expect(screen.getByText('Confirmer le changement')).toBeInTheDocument();
    });

    (apiFetch as any).mockResolvedValueOnce({ token: 'new-token-abc' });
    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/change-password', expect.objectContaining({ method: 'PUT' }));
    });
    await waitFor(() => {
      expect(screen.getByText('Mot de passe modifié avec succès.')).toBeInTheDocument();
    });
  });

  it('stores new token in localStorage when token was already present', async () => {
    localStorage.setItem('euraxess_token', 'old-token');
    renderProfile();
    fireEvent.click(screen.getByRole('button', { name: /modifier le mot de passe/i }));
    fireEvent.change(screen.getByLabelText('Mot de passe actuel'), { target: { value: 'oldpass1' } });
    fireEvent.change(screen.getByLabelText('Nouveau mot de passe'), { target: { value: 'newpass123' } });
    fireEvent.change(screen.getByLabelText('Confirmer le nouveau mot de passe'), { target: { value: 'newpass123' } });
    fireEvent.click(getPasswordSubmit()!);
    await waitFor(() => {
      expect(screen.getByText('Confirmer le changement')).toBeInTheDocument();
    });
    (apiFetch as any).mockResolvedValueOnce({ token: 'new-token-xyz' });
    fireEvent.click(screen.getByRole('button', { name: /confirmer/i }));
    await waitFor(() => {
      expect(localStorage.getItem('euraxess_token')).toBe('new-token-xyz');
    });
  });

  it('handles file input with an invalid file type and shows validation error', async () => {
    renderProfile();
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(['data'], 'test.gif', { type: 'image/gif' });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    await waitFor(() => {
      expect(screen.getByText('Format non autorisé. Formats acceptés : PNG, JPEG, WebP.')).toBeInTheDocument();
    });
  });

  it('shows the API error message in a toast when saving fails', async () => {
    renderProfile();
    fireEvent.change(screen.getByLabelText('Nom complet'), { target: { value: 'X' } });
    (apiFetch as any).mockRejectedValueOnce(new Error('Échec de la sauvegarde'));
    (isServiceUnreachable as any).mockReturnValueOnce(false);

    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    await waitFor(() => {
      expect(screen.getByText('Échec de la sauvegarde')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /enregistrer/i })).not.toBeDisabled();
  });

  it('shows breadcrumb navigation link to dashboard', () => {
    renderProfile();
    expect(screen.getByText('Tableau de bord')).toHaveAttribute('href', '/dashboard');
  });
});
