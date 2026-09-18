import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthView } from '../../src/components/AuthView';
import { ToastProvider } from '../../src/components/Toast';

function fakeResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function renderAuthView(onLoginSuccess = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <ToastProvider>
        <AuthView onLoginSuccess={onLoginSuccess} />
      </ToastProvider>
    </MemoryRouter>
  );
  return { onLoginSuccess };
}

describe('AuthView', () => {
  it('calls onLoginSuccess with the returned user after a successful login', async () => {
    const { onLoginSuccess } = renderAuthView();
    fetchMock.mockResolvedValue(fakeResponse({
      token: 'abc123',
      user: { id: 'u1', name: 'Alice Dupont', email: 'alice@euraxess-africa.org', role: 'admin', privilege: 'FULL_ACCESS' }
    }));

    fireEvent.change(screen.getByLabelText(/IDENTIFIANT \/ E-MAIL/i), { target: { value: 'alice@euraxess-africa.org' } });
    fireEvent.change(screen.getByLabelText(/MOT DE PASSE/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

    await vi.waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(onLoginSuccess).toHaveBeenCalledWith(expect.objectContaining({
      id: 'u1',
      name: 'Alice Dupont',
      email: 'alice@euraxess-africa.org',
      role: 'admin',
      privilege: 'FULL_ACCESS'
    }));

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      email: 'alice@euraxess-africa.org',
      password: 'secret',
      rememberMe: true
    });
  });

  it('shows an error toast when credentials are invalid', async () => {
    renderAuthView();
    fetchMock.mockResolvedValue(fakeResponse({ message: 'Identifiants invalides.' }, false, 401));

    fireEvent.change(screen.getByLabelText(/IDENTIFIANT \/ E-MAIL/i), { target: { value: 'alice@euraxess-africa.org' } });
    fireEvent.change(screen.getByLabelText(/MOT DE PASSE/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

    expect(await screen.findByText('Identifiants invalides.')).toBeInTheDocument();
  });

  it('stores the token in sessionStorage when "Se souvenir de moi" is unchecked', async () => {
    const { onLoginSuccess } = renderAuthView();
    fetchMock.mockResolvedValue(fakeResponse({
      token: 'tok789',
      user: { id: 'u2', name: 'Bob', email: 'bob@euraxess-africa.org', role: 'user' }
    }));

    fireEvent.change(screen.getByLabelText(/IDENTIFIANT \/ E-MAIL/i), { target: { value: 'bob@euraxess-africa.org' } });
    fireEvent.change(screen.getByLabelText(/MOT DE PASSE/i), { target: { value: 'pw' } });
    fireEvent.click(screen.getByText('Se souvenir de moi'));
    fireEvent.click(screen.getByRole('button', { name: /Se connecter/i }));

    await vi.waitFor(() => expect(onLoginSuccess).toHaveBeenCalledTimes(1));
    expect(sessionStorage.getItem('euraxess_token')).toBe('tok789');
    expect(localStorage.getItem('euraxess_token')).toBeNull();
  });

  it('toggles password visibility with the eye button', () => {
    renderAuthView();
    const passwordInput = screen.getByLabelText(/MOT DE PASSE/i) as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    fireEvent.click(screen.getByTitle('Afficher'));
    expect((screen.getByLabelText(/MOT DE PASSE/i) as HTMLInputElement).type).toBe('text');

    fireEvent.click(screen.getByTitle('Masquer'));
    expect((screen.getByLabelText(/MOT DE PASSE/i) as HTMLInputElement).type).toBe('password');
  });

  it('shows the loading state and disables the submit button during login', async () => {
    let resolveFetch: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(r => { resolveFetch = r; }));

    renderAuthView();
    fireEvent.change(screen.getByLabelText(/IDENTIFIANT \/ E-MAIL/i), { target: { value: 'a@b.org' } });
    fireEvent.change(screen.getByLabelText(/MOT DE PASSE/i), { target: { value: 'pw' } });
    const submit = screen.getByRole('button', { name: /Se connecter/i });
    fireEvent.click(submit);

    const spinning = screen.getByText('Connexion en cours...');
    expect(spinning).toBeInTheDocument();
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    resolveFetch!(fakeResponse({ token: 't', user: { id: 'u', name: 'N', email: 'a@b.org', role: 'user' } }));
    await vi.waitFor(() => expect(screen.queryByText('Connexion en cours...')).not.toBeInTheDocument());
  });

  it('opens the forgot-password modal and shows a success message after sending', async () => {
    renderAuthView();
    fetchMock.mockResolvedValue(fakeResponse({ ok: true }));

    fireEvent.click(screen.getByRole('button', { name: /Mot de passe oublié/i }));
    expect(screen.getByText('Réinitialisation du mot de passe')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/E-mail professionnel EURAXESS Africa/i), { target: { value: 'alice@euraxess-africa.org' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(await screen.findByText('Un e-mail de réinitialisation a été envoyé !')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/forgot-password',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
