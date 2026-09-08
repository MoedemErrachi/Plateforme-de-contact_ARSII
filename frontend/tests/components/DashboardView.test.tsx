import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import { DashboardView } from '../../src/components/DashboardView';
import { apiFetch, isServiceUnreachable } from '../../src/services/api';
import { Contact, User } from '../../src/types';

// Réseau : simule le backend (aucune dépendance serveur réelle en test).
vi.mock('../../src/services/api', () => ({
  apiFetch: vi.fn(),
  isServiceUnreachable: vi.fn(() => true),
}));

// Composants graphiques lourds (carte + graphique) : stubés pour rester
// concentré sur la logique métier du tableau de bord (agrégation, export, …).
vi.mock('../../src/components/WorldMapWidget', () => ({
  WorldMapWidget: () => <div data-testid="world-map-widget" />,
}));

vi.mock('../../src/components/DistributionChart', () => ({
  DistributionChart: () => <div data-testid="distribution-chart" />,
}));

const SERVER_STATS = {
  kpis: {
    totalContacts: 42,
    countriesCovered: 7,
    affiliationsCount: 9,
    seniorResearchers: { count: 3, percentage: 50 },
  },
  distributionByCountry: [],
  distributionByGender: [],
  distributionByCountryGender: [],
  countryLabels: [],
  distributionByCareerStage: [],
  distributionByTag: [],
};

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'c',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.c',
    gender: 'FEMALE',
    countryOfOrigin: 'FR',
    affiliation: 'INSERM',
    researchCareerStage: 'R1_FIRST_STAGE',
    tags: [],
    ...overrides,
  };
}

function renderDashboard(props: Partial<React.ComponentProps<typeof DashboardView>> = {}) {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <DashboardView contacts={[]} tags={[]} {...props} />
      </ToastProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  (isServiceUnreachable as any).mockReturnValue(true);
  (apiFetch as any).mockRejectedValue(new Error('unreachable'));
  document.elementFromPoint = vi.fn(() => null) as any;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DashboardView', () => {
  it('renders the dashboard header', () => {
    renderDashboard();
    expect(screen.getByText('Tableau de bord Innovation')).toBeInTheDocument();
    expect(screen.getByText('Bienvenue, voici le récapitulatif dynamique de votre réseau R&I Europe-Afrique.')).toBeInTheDocument();
  });

  it('shows a per-widget loading veil without hiding the content', () => {
    renderDashboard({ isLoading: true });
    expect(screen.getByLabelText('Rechargement des indicateurs clés')).toBeInTheDocument();
    expect(screen.getByText('TOTAL DES CONTACTS')).toBeInTheDocument();
  });

  it('renders KPI stats served by the backend', async () => {
    (apiFetch as any).mockResolvedValue({ data: SERVER_STATS });
    renderDashboard();
    const totalCard = (await screen.findByText('TOTAL DES CONTACTS')).closest<HTMLElement>('div')!;
    expect(await within(totalCard).findByText('42')).toBeInTheDocument();

    const countriesCard = screen.getByText('PAYS COUVERTS').closest<HTMLElement>('div')!;
    expect(await within(countriesCard).findByText('7')).toBeInTheDocument();

    const affiliationsCard = screen.getByText('AFFILIATIONS DISTINCTES').closest<HTMLElement>('div')!;
    expect(await within(affiliationsCard).findByText('9')).toBeInTheDocument();
  });

  it('triggers the export-all handler when clicking Exporter', () => {
    const onExportAll = vi.fn();
    renderDashboard({ onExportAll });
    fireEvent.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(onExportAll).toHaveBeenCalledTimes(1);
  });

  it('aggregates career-stage distribution from the contacts prop when no stats', () => {
    renderDashboard({
      contacts: [
        makeContact({ researchCareerStage: 'R1_FIRST_STAGE' }),
        makeContact({ researchCareerStage: 'R1_FIRST_STAGE' }),
        makeContact({ researchCareerStage: 'R2_RECOGNIZED' }),
        makeContact({ researchCareerStage: 'R2_RECOGNIZED' }),
        makeContact({ researchCareerStage: 'R3_ESTABLISHED' }),
      ],
    });
    expect(screen.getByText('R1 Débutant')).toBeInTheDocument();
    expect(screen.getByText('R2 Reconnu')).toBeInTheDocument();
    expect(screen.getByText('R3 Établi')).toBeInTheDocument();
    expect(screen.getAllByText('2 (40%)')).toHaveLength(2);
    expect(screen.getByText('1 (20%)')).toBeInTheDocument();
    expect(screen.getByText('0 (0%)')).toBeInTheDocument();
  });

  it('aggregates top tags from the contacts prop when no stats', () => {
    renderDashboard({
      contacts: [
        makeContact({ tags: ['IA', 'Data'] }),
        makeContact({ tags: ['IA'] }),
        makeContact({ tags: ['Data'] }),
      ],
    });
    expect(screen.getByText('Top Expertises & Tags')).toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
  });

  it('shows the empty state for top tags when no tag is present', () => {
    renderDashboard({
      contacts: [makeContact({ tags: [] }), makeContact({ tags: [] })],
    });
    expect(screen.getByText('Aucun tag attribué pour le moment.')).toBeInTheDocument();
  });

  it('hides a widget from the page via its header Masquer button', () => {
    renderDashboard();
    const hideButtons = screen.getAllByTitle('Masquer');
    fireEvent.click(hideButtons[0]);
    expect(screen.queryByText('TOTAL DES CONTACTS')).not.toBeInTheDocument();
  });

  it('opens and closes the customization modal', () => {
    renderDashboard();
    fireEvent.click(screen.getByRole('button', { name: 'Configurer' }));
    expect(screen.getByText('Personnaliser le Tableau de Bord')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(screen.queryByText('Personnaliser le Tableau de Bord')).not.toBeInTheDocument();
  });

  it('hides creation/import links for a read-only user', () => {
    const readOnly: User = { id: '1', name: 'Ro', email: 'ro@ex.com', role: 'user', privilege: 'READ' };
    renderDashboard({ user: readOnly });
    expect(screen.queryByText('Nouveau Contact')).not.toBeInTheDocument();
    expect(screen.queryByText('Importer CSV')).not.toBeInTheDocument();
  });

  it('shows creation/import links for a user with full access', () => {
    const full: User = { id: '1', name: 'F', email: 'f@ex.com', role: 'user', privilege: 'FULL_ACCESS' };
    renderDashboard({ user: full });
    expect(screen.getByText('Nouveau Contact')).toBeInTheDocument();
    expect(screen.getByText('Importer CSV')).toBeInTheDocument();
  });

  it('shows the stats error banner and a retry button when stats fail to load', async () => {
    (apiFetch as any).mockRejectedValue(new Error('boom'));
    (isServiceUnreachable as any).mockReturnValue(false);
    renderDashboard();
    expect(
      await screen.findByText(
        'Statistiques globales indisponibles (base de données injoignable). Les totaux affichés ne sont pas fiables.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument();
    expect(
      screen.getByText('Impossible de charger les statistiques du tableau de bord.')
    ).toBeInTheDocument();
  });

  it('loads a saved widget layout and merges it with default widgets', () => {
    localStorage.setItem(
      'euraxess_dashboard_widgets',
      JSON.stringify([
        { id: 'stats', title: 'Stats', visible: false, order: 2 },
        { id: 'topTags', title: 'Tags', visible: true, order: 1 },
        { id: 'myCustomWidget', title: 'Extra', visible: true, order: 0 },
      ])
    );
    const { container } = renderDashboard();
    expect(screen.queryByText('TOTAL DES CONTACTS')).not.toBeInTheDocument();
    expect(screen.getByText('Top Expertises & Tags')).toBeInTheDocument();
    const ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids[0]).toBe('topTags');
  });

  it('falls back to default widgets when the stored layout is corrupted', () => {
    localStorage.setItem('euraxess_dashboard_widgets', 'not-valid-json{{');
    renderDashboard();
    expect(screen.getByText('TOTAL DES CONTACTS')).toBeInTheDocument();
    expect(screen.getByText('Top Expertises & Tags')).toBeInTheDocument();
  });

  it('persists widget visibility changes back to localStorage', async () => {
    renderDashboard();
    fireEvent.click(screen.getAllByTitle('Masquer')[0]);
    await waitFor(() => {
      const saved = JSON.parse(
        localStorage.getItem('euraxess_dashboard_widgets') || '[]'
      );
      const stats = (saved as any[]).find((w: any) => w.id === 'stats');
      expect(stats?.visible).toBe(false);
    });
  });

  it('migrates the world map widget to sit right after the KPIs on first load', () => {
    localStorage.setItem(
      'euraxess_dashboard_widgets',
      JSON.stringify([
        { id: 'worldMap', title: 'Map', visible: true, order: 0 },
        { id: 'stats', title: 'Stats', visible: true, order: 1 },
        { id: 'topTags', title: 'Tags', visible: true, order: 2 },
      ])
    );
    const { container } = renderDashboard();
    const ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids[0]).toBe('stats');
    expect(ids[1]).toBe('distributionChart');
    expect(ids[2]).toBe('worldMap');
    expect(localStorage.getItem('euraxess_dashboard_widgets_layout_v')).toBe('2');
  });

  it('skips the world map migration when the layout version is current', () => {
    localStorage.setItem('euraxess_dashboard_widgets_layout_v', '2');
    localStorage.setItem(
      'euraxess_dashboard_widgets',
      JSON.stringify([
        { id: 'worldMap', title: 'Map', visible: true, order: 0 },
        { id: 'stats', title: 'Stats', visible: true, order: 1 },
      ])
    );
    const { container } = renderDashboard();
    const ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids[0]).toBe('worldMap');
    expect(ids[1]).toBe('stats');
  });

  it('reorders widgets with the move up/down header buttons', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const { container } = renderDashboard();

    fireEvent.click(
      container.querySelector('[data-widget-id="stats"] button[title="Descendre"]')!
    );
    let ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids[0]).toBe('worldMap');
    expect(ids[1]).toBe('stats');

    fireEvent.click(
      container.querySelector('[data-widget-id="stats"] button[title="Monter"]')!
    );
    ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids[0]).toBe('stats');
    expect(ids[1]).toBe('worldMap');
  });

  it('does not reorder a widget beyond the first or last position', () => {
    const { container } = renderDashboard();
    const originalIds = Array.from(
      container.querySelectorAll('[data-widget-id]')
    ).map(el => el.getAttribute('data-widget-id'));
    fireEvent.click(screen.getAllByTitle('Monter')[0]);
    fireEvent.click(screen.getAllByTitle('Descendre')[4]);
    const afterIds = Array.from(
      container.querySelectorAll('[data-widget-id]')
    ).map(el => el.getAttribute('data-widget-id'));
    expect(afterIds).toEqual(originalIds);
  });

  it('reorders widgets via drag and drop', () => {
    const { container } = renderDashboard();
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'stats'),
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    const statsWidget = container.querySelector(
      '[data-widget-id="stats"]'
    )!;
    const distWidget = container.querySelector(
      '[data-widget-id="distributionChart"]'
    )!;

    fireEvent.dragStart(statsWidget, { dataTransfer });
    fireEvent.dragOver(distWidget, { dataTransfer });
    fireEvent.dragLeave(distWidget);
    fireEvent.drop(distWidget, { dataTransfer });

    const ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids).toEqual([
      'worldMap',
      'distributionChart',
      'stats',
      'careerStage',
      'topTags',
    ]);
  });

  it('cancels widget drag when starting on the map pan surface', () => {
    const panEl = document.createElement('div');
    panEl.setAttribute('data-map-pan', '');
    const pointSpy = vi
      .spyOn(document, 'elementFromPoint')
      .mockReturnValue(panEl as any);
    const { container } = renderDashboard();
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'worldMap'),
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    const mapWidget = container.querySelector('[data-widget-id="worldMap"]')!;
    fireEvent.dragStart(mapWidget, { dataTransfer, clientX: 10, clientY: 10 });
    expect(dataTransfer.setData).not.toHaveBeenCalled();
    pointSpy.mockRestore();
  });

  it('ignores dropping a widget onto itself', () => {
    const { container } = renderDashboard();
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'stats'),
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    const statsWidget = container.querySelector('[data-widget-id="stats"]')!;
    fireEvent.dragStart(statsWidget, { dataTransfer });
    fireEvent.drop(statsWidget, { dataTransfer });
    const ids = Array.from(container.querySelectorAll('[data-widget-id]')).map(
      el => el.getAttribute('data-widget-id')
    );
    expect(ids[0]).toBe('stats');
  });

  it('resets the layout to defaults from the customization modal', () => {
    renderDashboard();
    fireEvent.click(screen.getAllByTitle('Masquer')[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Configurer' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Réinitialiser la disposition' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Terminer' }));
    expect(screen.getByText('TOTAL DES CONTACTS')).toBeInTheDocument();
  });

  it('renders top tags from server distribution data with colors', async () => {
    (apiFetch as any).mockResolvedValue({
      data: {
        ...SERVER_STATS,
        distributionByTag: [
          { tagId: 't1', name: 'IA', color: '#35B8B2', count: 5 },
          { tagId: 't2', name: 'Data', color: '', count: 3 },
          { tagId: 't3', name: 'Quantum', color: '', count: 1 },
        ],
      },
    });
    (isServiceUnreachable as any).mockReturnValue(true);
    renderDashboard({ tags: [{ id: 't2', name: 'Data', color: '#FF0000' }] });

    expect(await screen.findByText('IA')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('Quantum')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('auto-scrolls the page when dragging near the top or bottom edge', async () => {
    const { container } = renderDashboard();
    const dataTransfer = {
      setData: vi.fn(),
      getData: vi.fn(() => 'stats'),
      effectAllowed: 'move',
      dropEffect: 'move',
    };
    const statsWidget = container.querySelector('[data-widget-id="stats"]')!;
    fireEvent.dragStart(statsWidget, { dataTransfer });

    Object.defineProperty(window, 'scrollY', {
      value: 150,
      configurable: true,
    });
    const scrollBy = vi.fn();
    window.scrollBy = scrollBy as any;

    fireEvent(
      document,
      Object.assign(new Event('dragover', { bubbles: true }), { clientY: 40 })
    );
    expect(scrollBy).toHaveBeenCalledWith(0, -18);

    scrollBy.mockClear();
    Object.defineProperty(window, 'scrollY', {
      value: 0,
      configurable: true,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });
    fireEvent(
      document,
      Object.assign(new Event('dragover', { bubbles: true }), { clientY: 700 })
    );
    expect(scrollBy).toHaveBeenCalledWith(0, 18);

    fireEvent(
      document,
      new Event('dragend', { bubbles: true })
    );
  });

  it('tolerates localStorage write failures during display and migration', () => {
    localStorage.setItem(
      'euraxess_dashboard_widgets',
      JSON.stringify([
        { id: 'worldMap', title: 'Map', visible: true, order: 0 },
        { id: 'stats', title: 'Stats', visible: true, order: 1 },
      ])
    );
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    renderDashboard();
    Storage.prototype.setItem = originalSetItem;
    expect(screen.getByText('TOTAL DES CONTACTS')).toBeInTheDocument();
  });
});
