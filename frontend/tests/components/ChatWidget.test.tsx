import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import { ChatWidget } from '../../src/components/chat/ChatWidget';
import { apiFetch } from '../../src/services/api';
import { downloadCsvFromEndpoint } from '../../src/utils/download';

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('remark-gfm', () => ({ default: {} }));

vi.mock('../../src/utils/download', () => ({
  downloadCsvFromEndpoint: vi.fn().mockResolvedValue({ fileName: 'export.csv', count: 5 }),
}));

vi.mock('../../src/utils/contactQuery', () => ({
  buildContactsExportQuery: vi.fn().mockReturnValue(new URLSearchParams()),
}));

vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn().mockResolvedValue({}),
  toApiError: vi.fn((err: any) => {
    if (err?.kind) return { kind: err.kind, message: err.message };
    if (err instanceof TypeError) return { kind: 'network', message: 'Impossible de contacter le serveur.' };
    return { kind: 'client', message: err?.message ?? String(err) };
  }),
  isServiceUnreachable: vi.fn(
    (err: any) => err?.kind === 'network' || err?.kind === 'timeout' || err?.kind === 'server'
  ),
  CHAT_TIMEOUT_MS: 45000,
}));

// Le panneau est toujours présent dans le DOM (visibilité + aria-hidden pilotés
// par isOpen) : on vérifie le basculement réel via l'attribut aria-hidden.
function getPanel(container: HTMLElement): HTMLElement {
  return screen.getByText(/EURAXESS AI Assistant/).closest('div[aria-hidden]') as HTMLElement;
}

function renderChat({
  getToken,
  omitToken = false,
}: { getToken?: () => string | null; omitToken?: boolean } = {}) {
  const resolved = omitToken ? undefined : (getToken ?? (() => 'test-token'));
  return render(
    <MemoryRouter>
      <ToastProvider>
        <ChatWidget getToken={resolved as (() => string | null) | undefined} />
      </ToastProvider>
    </MemoryRouter>
  );
}

function renderChatWithRoutes() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<ChatWidget getToken={() => 'test-token'} />} />
          <Route path="/contacts" element={<div>CONTACTS PAGE MARKER</div>} />
          <Route path="/contacts/:id" element={<div>CONTACT PROFILE MARKER</div>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>
  );
}

function openChat(container: HTMLElement) {
  fireEvent.click(screen.getByRole('button', { name: /ouvrir l'assistant/i }));
  expect(getPanel(container)).toHaveAttribute('aria-hidden', 'false');
}

beforeEach(() => {
  vi.clearAllMocks();
  (apiFetch as ReturnType<typeof vi.fn>).mockResolvedValue({});
  (downloadCsvFromEndpoint as ReturnType<typeof vi.fn>).mockResolvedValue({
    fileName: 'export.csv',
    count: 5,
  });
  sessionStorage.clear();
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ChatWidget', () => {
  it('renders the launcher button and keeps the panel closed initially', () => {
    const { container } = renderChat();
    expect(screen.getByRole('button', { name: /ouvrir l'assistant/i })).toBeInTheDocument();
    expect(getPanel(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('opens the chat panel when the launcher is clicked', () => {
    const { container } = renderChat();
    fireEvent.click(screen.getByRole('button', { name: /ouvrir l'assistant/i }));
    expect(getPanel(container)).toHaveAttribute('aria-hidden', 'false');
    expect(screen.getByText('EURAXESS AI Assistant')).toBeInTheDocument();
    expect(screen.getByText('En ligne · Assistant intelligent du CRM')).toBeInTheDocument();
  });

  it('displays the welcome message and quick action buttons', () => {
    const { container } = renderChat();
    openChat(container);
    expect(screen.getByText(/Bonjour ! Je suis l'assistant IA/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aide' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chercheurs au Sénégal' })).toBeInTheDocument();
  });

  it('closes the panel when the close button inside the panel is clicked', () => {
    const { container } = renderChat();
    openChat(container);
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
    expect(getPanel(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('sends a message and renders both user bubble and assistant reply', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Il y a 42 chercheurs au Sénégal.',
          actions: [],
        }),
      })
    );
    const { container } = renderChat();
    openChat(container);

    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Combien de chercheurs ?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByText('Il y a 42 chercheurs au Sénégal.')).toBeInTheDocument();
    });

    expect(screen.getByText('Combien de chercheurs ?')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/chatbot-api/api/chatbot/message',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('disables the input while a reply is pending, then re-enables it', async () => {
    let resolveFetch: (v: any) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () => new Promise((resolve) => { resolveFetch = resolve; })
      )
    );
    const { container } = renderChat();
    openChat(container);

    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await act(async () => {});
    expect(input).toBeDisabled();

    await act(async () => {
      resolveFetch!({
        ok: true,
        json: async () => ({ message: 'Réponse', actions: [] }),
      });
    });

    await waitFor(() => {
      expect(input).not.toBeDisabled();
    });
  });

  it('shows an error toast when the API returns a server error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Erreur interne' }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByText('Erreur interne')).toBeInTheDocument();
    });
  });

  it('shows offline status and a friendly error when the network fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByText('Hors ligne · Service momentanément indisponible')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(
        screen.getByText('Le service d\'assistance est actuellement injoignable. Veuillez réessayer dans un instant.')
      ).toBeInTheDocument();
    });
  });

  it('shows error for 401 unauthorized response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByText('Session expirée ou non autorisée. Veuillez vous reconnecter.')).toBeInTheDocument();
    });
  });

  it('does not send when the input is empty', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = renderChat();
    openChat(container);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders assistant actions as clickable buttons when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Voici les résultats.',
          actions: [
            { type: 'view_filtered_list', filters: { countryOfOrigin: 'Sénégal' } },
            { type: 'export_csv', filters: { countryOfOrigin: 'Sénégal' } },
          ],
        }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Senegal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voir la liste des contacts/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Exporter en CSV/ })).toBeInTheDocument();
    });
  });

  it('clears the conversation when clicking the reset button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'Réponse de test', actions: [] }),
      })
    );
    const { container } = renderChat();
    openChat(container);

    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Insight unique' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => {
      expect(screen.getByText('Réponse de test')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Effacer la conversation' }));
    expect(screen.queryByText('Insight unique')).not.toBeInTheDocument();
    expect(screen.queryByText('Réponse de test')).not.toBeInTheDocument();
  });

  it('submits quick action text directly', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: "Voici l'aide.", actions: [] }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    fireEvent.click(screen.getByRole('button', { name: 'Aide' }));

    await waitFor(() => {
      expect(screen.getByText("Voici l'aide.")).toBeInTheDocument();
    });
  });

  it('shows an error toast when the user is not authenticated', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = renderChat({ omitToken: true });
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Bonjour' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getByText("Vous devez être connecté pour utiliser l'assistant IA."),
      ).toBeInTheDocument();
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('resolves the auth token from storage when no getToken prop is provided', async () => {
    localStorage.setItem('auth_token', 'stored-token');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'ok', actions: [] }),
      })
    );
    const { container } = renderChat({ omitToken: true });
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
    expect(fetch).toHaveBeenCalledWith(
      '/chatbot-api/api/chatbot/message',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer stored-token' }),
      })
    );
  });

  it('falls back to a generated session id when crypto.randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {});
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'session ok', actions: [] }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'ping' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => expect(screen.getByText('session ok')).toBeInTheDocument());
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(init.body).session_id).toMatch(/^session-\d+-\d+$/);
  });

  it('shows a rate-limit error for HTTP 429 responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({}),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getByText('Trop de requêtes. Veuillez patienter quelques secondes avant de réessayer.'),
      ).toBeInTheDocument();
    });
  });

  it('shows a generic server error message for other HTTP errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({}),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByText('Erreur serveur (HTTP 400)')).toBeInTheDocument();
    });
  });

  it('shows a fallback reply when the response body cannot be parsed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('bad json');
        },
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByText('Je n\'ai pas pu formuler de réponse.')).toBeInTheDocument();
    });
  });

  it('navigates to the filtered contacts list when the view-list action is clicked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Voici les résultats.',
          actions: [
            { type: 'view_filtered_list', filters: { countryOfOrigin: 'Sénégal' } },
            { type: 'unknown_action' },
            { type: 42 },
          ],
        }),
      })
    );
renderChatWithRoutes();
    fireEvent.click(screen.getByRole('button', { name: /ouvrir l'assistant/i }));
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'Senegal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Voir la liste des contacts/ }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Voir la liste des contacts/ }));

    await waitFor(() => {
      expect(screen.getByText('CONTACTS PAGE MARKER')).toBeInTheDocument();
    });
  });

  it('navigates to a contact profile for a view_contact_profile action', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Voici le profil.',
          actions: [
            { type: 'view_contact_profile', contactId: 'c42' },
            { type: 'view_contact_profile', contact_id: 'c43' },
          ],
        }),
      })
    );
    renderChatWithRoutes();
    fireEvent.click(screen.getByRole('button', { name: /ouvrir l'assistant/i }));
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'profil' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getAllByRole('button', { name: /Voir le profil du chercheur/ }).length,
      ).toBeGreaterThanOrEqual(1);
    });
    const profileButtons = screen.getAllByRole('button', {
      name: /Voir le profil du chercheur/,
    });
    fireEvent.click(profileButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('CONTACT PROFILE MARKER')).toBeInTheDocument();
    });
  });

  it('exports CSV when the export action is clicked and logs the export', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Export prêt.',
          actions: [{ type: 'export_csv', filters: { countryOfOrigin: 'Sénégal' } }],
        }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'export' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Exporter en CSV/ }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Exporter en CSV/ }));

    await waitFor(() => {
      expect(downloadCsvFromEndpoint).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        '/api/export/log',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('shows an error toast when the CSV export fails', async () => {
    (downloadCsvFromEndpoint as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('export failed'),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Export prêt.',
          actions: [{ type: 'export_csv', filters: {} }],
        }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'export' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Exporter en CSV/ }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Exporter en CSV/ }));

    await waitFor(() => {
      expect(
        screen.getByText('Export CSV échoué. Veuillez réessayer.'),
      ).toBeInTheDocument();
    });
  });

  it('keeps the export successful when the export log call fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (apiFetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('log down'),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: 'Export prêt.',
          actions: [{ type: 'export_csv', filters: {} }],
        }),
      })
    );
    const { container } = renderChat();
    openChat(container);
    const input = screen.getByPlaceholderText('Écrivez votre message…');
    fireEvent.change(input, { target: { value: 'export' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Exporter en CSV/ }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Exporter en CSV/ }));

    await waitFor(() => {
      expect(downloadCsvFromEndpoint).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalledWith(
        'Échec de la journalisation de l\'export CSV.',
      );
    });
    expect(
      screen.queryByText('Export CSV échoué. Veuillez réessayer.'),
    ).not.toBeInTheDocument();
  });

  it('drags the launcher, snaps it to the nearest corner, and does not toggle the panel', async () => {
    const { container } = renderChat();
    const launcher = screen.getByRole('button', { name: /ouvrir l'assistant/i });

    await act(async () => {
      fireEvent.pointerDown(launcher, { clientX: 0, clientY: 0 });
    });
    await act(async () => {
      fireEvent.pointerMove(launcher, { clientX: 10, clientY: 10 });
    });
    await act(async () => {
      fireEvent.pointerDown(launcher, { clientX: 0, clientY: 0 });
    });
    await act(async () => {
      fireEvent.pointerMove(launcher, { clientX: 10, clientY: 10 });
    });
    await act(async () => {
      fireEvent.pointerUp(launcher, { clientX: 10, clientY: 10 });
      // The synthetic click following a drag must not reopen the panel
      fireEvent.click(launcher);
    });

    expect(localStorage.getItem('euraxess_chat_corner')).toBe('tl');
    expect(getPanel(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('restores the launcher corner from localStorage on mount', () => {
    localStorage.setItem('euraxess_chat_corner', 'tl');
    const { container } = renderChat();
    const launcher = screen.getByRole('button', { name: /ouvrir l'assistant/i });
    expect(launcher.parentElement).toHaveStyle({ left: '20px', top: '20px' });
  });

  it('ignores an invalid stored corner and defaults to bottom-right', () => {
    localStorage.setItem('euraxess_chat_corner', 'nowhere');
    const { container } = renderChat();
    const launcher = screen.getByRole('button', { name: /ouvrir l'assistant/i });
    const parent = launcher.parentElement as HTMLElement;
    expect(parseFloat(parent.style.left)).toBeGreaterThan(0);
    expect(parseFloat(parent.style.top)).toBeGreaterThan(0);
  });
});