import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExportView } from '../../src/components/ExportView';
import { ToastProvider } from '../../src/components/Toast';
import { ContactSelection, Tag } from '../../src/types';

function fakeDownloadResponse() {
  return {
    ok: true,
    status: 200,
    async blob() { return new Blob(['data']); },
    headers: {
      get(name: string) {
        if (name === 'Content-Disposition') return 'attachment; filename="contacts_export.csv"';
        if (name === 'X-Export-Count') return '2';
        return null;
      }
    }
  } as Response;
}

function fakeJsonResponse(body: unknown) {
  return { ok: true, status: 200, text: async () => JSON.stringify(body) } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;
let exportCalls: string[];
let previewPayload: unknown;
let listError: Error | null;

beforeEach(() => {
  exportCalls = [];
  previewPayload = {
    pagination: { totalRecords: 0 },
    data: { contacts: [] },
  };
  listError = null;
  fetchMock = vi.fn((url: string) => {
    if (listError && url.startsWith('/api/contacts?') && !url.startsWith('/api/contacts/export')) {
      return Promise.reject(listError);
    }
    if (url.startsWith('/api/contacts/export')) {
      exportCalls.push(url);
      return Promise.resolve(fakeDownloadResponse());
    }
    if (url.startsWith('/api/contacts?')) {
      return Promise.resolve(fakeJsonResponse(previewPayload));
    }
    if (url.startsWith('/api/export/log')) {
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    }
    return Promise.resolve(fakeJsonResponse({ ok: true }));
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => 'blob:test'),
    revokeObjectURL: vi.fn()
  }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

function makeSelection(overrides: Partial<ContactSelection> = {}): ContactSelection {
  return {
    mode: 'partial',
    ids: ['c1', 'c2'],
    filters: { search: '', countries: [], genders: [], careerStages: [], tags: [] },
    totalCount: 2,
    ...overrides
  };
}

function renderExportView(selection: ContactSelection, tags: Tag[] = []) {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ExportView selection={selection} tags={tags} />
      </ToastProvider>
    </MemoryRouter>
  );
}

describe('ExportView', () => {
  it('shows the selected count derived from the selection ids', () => {
    renderExportView(makeSelection());
    expect(screen.getByText('Exporter les contacts (2)')).toBeInTheDocument();
    expect(screen.getByText('2 contact(s) sélectionné(s)')).toBeInTheDocument();
  });

  it('defaults to the CSV format and switches selection to Excel', async () => {
    renderExportView(makeSelection());
    fireEvent.click(screen.getByRole('button', { name: /Excel \(XLSX\)/i }));
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i }));

    await vi.waitFor(() => expect(exportCalls.length).toBeGreaterThan(0));
    expect(exportCalls[0]).toContain('format=xlsx');
  });

  it('only includes the selected fields in the export query', async () => {
    renderExportView(makeSelection());

    fireEvent.click(screen.getByLabelText('Téléphone'));
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i }));

    await vi.waitFor(() => expect(exportCalls.length).toBeGreaterThan(0));
    expect(exportCalls[0]).toContain('fields=email');
    expect(exportCalls[0]).not.toContain('phone');
  });

  it('disables the export button when no field remains selected', () => {
    renderExportView(makeSelection());
    fireEvent.click(screen.getByRole('button', { name: 'Tout désélectionner' }));
    const exportBtn = screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('triggers the download and reports the exported file', async () => {
    renderExportView(makeSelection());
    fireEvent.click(screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i }));

    expect(await screen.findByText('Génération du fichier...')).toBeInTheDocument();
    expect(await screen.findByText('Exportation générée : contacts_export.csv (2 enregistrements).')).toBeInTheDocument();

    expect(exportCalls[0]).toContain('ids=c1');
    expect(exportCalls[0]).toContain('ids=c2');
    expect(exportCalls[0]).toContain('format=csv');
    expect(fetchMock).toHaveBeenCalledWith('/api/export/log', expect.objectContaining({ method: 'POST' }));
  });

  it('warns when the selection is empty and disables the export', () => {
    renderExportView(makeSelection({ mode: 'partial', ids: [] }));
    expect(screen.getByText(/Aucun contact n'est actuellement coché dans l'annuaire\./)).toBeInTheDocument();
    const exportBtn = screen.getByRole('button', { name: /Lancer l'exportation \(0\)/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('handles the "none" selection mode as an empty ids scope', () => {
    renderExportView(makeSelection({ mode: 'none', ids: [], totalCount: 0 }));
    expect(screen.getByText('Exporter les contacts (0)')).toBeInTheDocument();
    expect(screen.getByText(/Aucun contact n'est actuellement coché dans l'annuaire\./)).toBeInTheDocument();
    expect(
      screen.getByText(
        /L'aperçu détaillé n'est pas disponible pour une sélection individuelle/,
      ),
    ).toBeInTheDocument();
  });

  it('shows the preview count summary for an all-filtered selection', async () => {
    previewPayload = {
      pagination: { totalRecords: 3 },
      data: { contacts: [] },
    };
    renderExportView(makeSelection({ mode: 'all-filtered', ids: [], totalCount: 3 }));
    expect(
      await screen.findByText('3 contact(s) correspondant aux filtres'),
    ).toBeInTheDocument();

    await vi.waitFor(() =>
      expect(
        screen.getByText(/Aucun contact ne correspond à ce périmètre\./),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText('Tous les contacts des filtres actifs'),
    ).toBeInTheDocument();
  });

  it('renders the preview table with mapped contacts in all-filtered mode', async () => {
    previewPayload = {
      pagination: { totalRecords: 5 },
      data: {
        contacts: [
          { id: 'x1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.fr', gender: 'FEMALE', countryOfOrigin: 'UK', city: 'London', phone: '+44', affiliation: 'UCL', function: 'Prof', researchCareerStage: 'R3_ESTABLISHED', tags: [{ name: 'Maths' }] },
          { id: 'x2', firstName: 'Alan', lastName: 'Turing', email: 'alan@test.fr', gender: 'MALE', countryOfOrigin: 'UK', city: 'Manchester', phone: '+44', affiliation: 'Cambridge', researchCareerStage: 'R2_RECOGNIZED', tags: [] },
          { id: 'x3', firstName: 'N/A', lastName: 'N/A', email: 'x@test.fr', gender: 'NOT_SPECIFIED', countryOfOrigin: '', affiliation: 'INRIA', researchCareerStage: 'R1_FIRST_STAGE', tags: [] },
          { id: 'x4', firstName: '', lastName: '', email: 'blank@test.fr', gender: 'NOT_SPECIFIED', countryOfOrigin: '', affiliation: 'CNRS', researchCareerStage: 'R2_RECOGNIZED', tags: [] },
        ],
      },
    };
    renderExportView(makeSelection({ mode: 'all-filtered', ids: [], totalCount: 5 }));

    expect(await screen.findByText('ada@test.fr')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('Femme')).toBeInTheDocument();
    expect(screen.getByText('Homme')).toBeInTheDocument();
    expect(screen.getAllByText('Non spécifié').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/et 1 autres contacts seront inclus dans le fichier final\./),
    ).toBeInTheDocument();
  });

  it('shows the loading message for the preview while the count resolves', async () => {
    let resolveList: (v: unknown) => void;
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/contacts?') && !url.startsWith('/api/contacts/export')) {
        return new Promise((res) => { resolveList = res; });
      }
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    });
    renderExportView(makeSelection({ mode: 'all-filtered', ids: [], totalCount: 0 }));

    expect(screen.getByText(/Chargement de l'aperçu…/)).toBeInTheDocument();

    await act(async () => {
      resolveList!({
        pagination: { totalRecords: 0 },
        data: { contacts: [] },
      });
    });
    expect(
      screen.queryByText(/Chargement de l'aperçu…/),
    ).not.toBeInTheDocument();
  });

  it('shows an error message when the preview cannot be loaded', async () => {
    listError = new Error('Liste indisponible');
    renderExportView(makeSelection({ mode: 'all-filtered', ids: [], totalCount: 0 }));

    expect(
      await screen.findByText(/Liste indisponible/),
    ).toBeInTheDocument();
    const exportBtn = screen.getByRole('button', { name: /Lancer l'exportation \(0\)/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders a description of the active filters in the summary', async () => {
    previewPayload = {
      pagination: { totalRecords: 2 },
      data: { contacts: [] },
    };
    renderExportView(
      makeSelection({
        mode: 'all-filtered',
        ids: [],
        totalCount: 2,
        filters: {
          search: 'Paris',
          countries: ['FR'],
          genders: ['FEMALE'] as ContactSelection['filters']['genders'],
          careerStages: ['R2_RECOGNIZED'],
          tags: ['tag1'],
        },
      }),
    );

    await vi.waitFor(() =>
      expect(screen.getByText(/2 contact\(s\) correspondant aux filtres/)).toBeInTheDocument(),
    );
    expect(
      screen.getByText(
        /recherche « Paris », 1 pays, 1 genre\(s\), 1 stade\(s\), 1 tag\(s\)/,
      ),
    ).toBeInTheDocument();
  });

  it('still completes the export when the export log call fails', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/contacts/export')) {
        exportCalls.push(url);
        return Promise.resolve(fakeDownloadResponse());
      }
      if (url.startsWith('/api/export/log')) {
        return Promise.reject(new Error('log unavailable'));
      }
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    });
    renderExportView(makeSelection());

    fireEvent.click(screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i }));

    expect(
      await screen.findByText('Exportation générée : contacts_export.csv (2 enregistrements).'),
    ).toBeInTheDocument();
  });

  it('shows an error toast when the export fails with a client error', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/contacts/export')) {
        exportCalls.push(url);
        return Promise.resolve({
          ok: false,
          status: 400,
          json: async () => ({ error: 'Filtres invalides' }),
        } as Response);
      }
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    });
    renderExportView(makeSelection());

    fireEvent.click(screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i }));

    expect(
      await screen.findByText(/Échec de l'export : Filtres invalides/),
    ).toBeInTheDocument();
  });

  it('does not show an export error toast when the service is unreachable', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.startsWith('/api/contacts/export')) {
        exportCalls.push(url);
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ error: 'Server down' }),
        } as Response);
      }
      return Promise.resolve(fakeJsonResponse({ ok: true }));
    });
    renderExportView(makeSelection());

    fireEvent.click(screen.getByRole('button', { name: /Lancer l'exportation \(2\)/i }));

    await vi.waitFor(() => expect(exportCalls.length).toBeGreaterThan(0));
    const exportBtn = await screen.findByRole('button', {
      name: /Lancer l'exportation \(2\)/i,
    });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Échec de l'export/)).not.toBeInTheDocument();
  });
});
