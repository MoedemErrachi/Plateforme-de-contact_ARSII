import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import { ContactsView } from '../../src/components/ContactsView';
import { apiFetch } from '../../src/services/api';
import {
  ContactSelection,
  FilterState,
  Segment,
  Tag,
  User,
  PaginationInfo,
} from '../../src/types';

vi.mock('../../src/services/api', () => ({ apiFetch: vi.fn() }));

const EMPTY_FILTERS: FilterState = {
  search: '',
  countries: [],
  genders: [],
  careerStages: [],
  tags: [],
};

const DEFAULT_SELECTION: ContactSelection = {
  mode: 'none',
  ids: [],
  filters: EMPTY_FILTERS,
  totalCount: 0,
};

const RAW_CONTACT_1 = {
  id: 'c1',
  firstName: 'Amina',
  lastName: 'Benali',
  email: 'amina@example.com',
  gender: 'FEMALE',
  countryOfOrigin: 'Maroc',
  city: 'Rabat',
  affiliation: 'Université Mohammed V',
  function: 'Professeure',
  researchCareerStage: 'R3_ESTABLISHED',
  avatarUrl: null,
  tags: [{ tag: { name: 'Santé', id: 'tag1' } }, { tag: { name: 'IA', id: 'tag2' } }],
};

const RAW_CONTACT_2 = {
  id: 'c2',
  firstName: 'Jean',
  lastName: 'Dupont',
  email: 'jean@example.com',
  gender: 'MALE',
  countryOfOrigin: 'France',
  city: 'Lyon',
  affiliation: 'CNRS',
  function: 'Chercheur',
  researchCareerStage: 'R2_RECOGNIZED',
  avatarUrl: 'https://example.com/avatar.jpg',
  tags: [{ tag: { name: 'Énergie', id: 'tag3' } }],
};

const RAW_CONTACT_3 = {
  id: 'c3',
  firstName: 'Wei',
  lastName: 'Zhang',
  email: 'wei@example.com',
  gender: 'MALE',
  countryOfOrigin: 'Chine',
  city: 'Pékin',
  affiliation: 'Tsinghua University',
  function: 'Postdoc',
  researchCareerStage: 'R1_FIRST_STAGE',
  avatarUrl: null,
  tags: [],
};

const TWO_CONTACTS_RESPONSE = {
  data: { contacts: [RAW_CONTACT_1, RAW_CONTACT_2] },
  pagination: {
    page: 1,
    limit: 10,
    totalCount: 2,
    totalPages: 1,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
    totalRecords: 2,
  } satisfies PaginationInfo,
};

const THREE_CONTACTS_PAGE1 = {
  data: { contacts: [RAW_CONTACT_1, RAW_CONTACT_2, RAW_CONTACT_3] },
  pagination: {
    page: 1,
    limit: 2,
    totalCount: 3,
    totalPages: 2,
    currentPage: 1,
    hasNextPage: true,
    hasPrevPage: false,
    totalRecords: 3,
  } satisfies PaginationInfo,
};

const EMPTY_RESPONSE = {
  data: { contacts: [] },
  pagination: {
    page: 1,
    limit: 10,
    totalCount: 0,
    totalPages: 0,
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
    totalRecords: 0,
  } satisfies PaginationInfo,
};

const COUNTRIES_RESPONSE = { data: { countries: ['Maroc', 'France', 'Tunisie'] } };

const TAGS: Tag[] = [
  { id: 'tag1', name: 'Santé', color: 'bg-green-100 text-green-800 border-green-200' },
  { id: 'tag2', name: 'IA', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { id: 'tag3', name: 'Énergie', color: 'bg-orange-100 text-orange-800 border-orange-200' },
];

const SEGMENTS: Segment[] = [
  { id: 'seg1', name: 'Experts Santé', filters: { ...EMPTY_FILTERS, tags: ['Santé'] } },
  { id: 'seg2', name: 'Maroc', filters: { ...EMPTY_FILTERS, countries: ['Maroc'] } },
];

const FULL_ACCESS_USER: User = {
  id: 'u1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  privilege: 'FULL_ACCESS',
};

const READ_ONLY_USER: User = {
  id: 'u2',
  name: 'Viewer',
  email: 'viewer@test.com',
  role: 'user',
  privilege: 'READ',
};

const READ_WRITE_USER: User = {
  id: 'u3',
  name: 'Editor',
  email: 'editor@test.com',
  role: 'user',
  privilege: 'READ_WRITE',
};

function makeDefaultProps(overrides: Partial<React.ComponentProps<typeof ContactsView>> = {}) {
  return {
    segments: SEGMENTS,
    tags: TAGS,
    activeSegmentId: 'all',
    onSelectSegment: vi.fn(),
    onSaveCurrentAsSegment: vi.fn(),
    onSelectContact: vi.fn(),
    onDeleteContact: vi.fn(),
    onDeleteContacts: vi.fn(),
    selection: DEFAULT_SELECTION,
    onSelectionChange: vi.fn(),
    user: FULL_ACCESS_USER,
    ...overrides,
  };
}

function setupApi(responses?: { contacts?: any; countries?: any }) {
  const mock = vi.mocked(apiFetch);
  mock.mockReset();
  mock.mockImplementation(async (url: string) => {
    const u = String(url);
    if (u.includes('/api/contacts/countries')) {
      return responses?.countries ?? COUNTRIES_RESPONSE;
    }
    return responses?.contacts ?? TWO_CONTACTS_RESPONSE;
  });
  return mock;
}

function renderView(overrides?: Partial<React.ComponentProps<typeof ContactsView>>) {
  const props = makeDefaultProps(overrides);
  const result = render(
    <MemoryRouter>
      <ContactsView {...props} />
    </MemoryRouter>,
  );
  return { ...result, props };
}

async function waitForContacts() {
  await waitFor(() => {
    expect(screen.getAllByText('Amina Benali').length).toBeGreaterThan(0);
  });
}

beforeEach(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ContactsView', () => {
  describe('Data loading', () => {
    it('shows a loading skeleton before contacts are fetched', () => {
      setupApi({
        contacts: new Promise(() => {}),
        countries: new Promise(() => {}),
      });
      const { container } = renderView();
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('renders contact rows after data loads', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getAllByText('Jean Dupont').length).toBeGreaterThan(0);
      expect(screen.getAllByText('amina@example.com').length).toBeGreaterThan(0);
      expect(screen.getAllByText('jean@example.com').length).toBeGreaterThan(0);
    });

    it('shows career stage and gender labels in each row', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getAllByText('R3 Établi').length).toBeGreaterThan(0);
      expect(screen.getAllByText('R2 Reconnu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Femme').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Homme').length).toBeGreaterThan(0);
    });

    it('shows affiliation and country columns', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getAllByText('Université Mohammed V').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CNRS').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Maroc').length).toBeGreaterThan(0);
      expect(screen.getAllByText('France').length).toBeGreaterThan(0);
    });

    it('shows tags for each contact', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getAllByText('Santé').length).toBeGreaterThan(0);
      expect(screen.getAllByText('IA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Énergie').length).toBeGreaterThan(0);
    });

    it('displays pagination info text', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getByText(/Affichage de/)).toBeInTheDocument();
      const allMatches = screen.getAllByText(/Affichage de/);
      expect(allMatches.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Error state', () => {
    it('shows error message when contacts fetch fails', async () => {
      const mock = vi.mocked(apiFetch);
      mock.mockReset();
      mock.mockImplementation(async (url: string) => {
        const u = String(url);
        if (u.includes('/api/contacts/countries')) return COUNTRIES_RESPONSE;
        throw new Error('Network error');
      });
      renderView();
      await waitFor(() => {
        expect(screen.getAllByText('Network error').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('retries fetching when the retry button is clicked', async () => {
      const mock = vi.mocked(apiFetch);
      mock.mockReset();
      let callCount = 0;
      mock.mockImplementation(async (url: string) => {
        const u = String(url);
        if (u.includes('/api/contacts/countries')) return COUNTRIES_RESPONSE;
        callCount++;
        if (callCount === 1) throw new Error('Server error');
        return TWO_CONTACTS_RESPONSE;
      });
      renderView();
      await waitFor(() => {
        expect(screen.getAllByText('Server error').length).toBeGreaterThanOrEqual(1);
      });
      const retryBtns = screen.getAllByRole('button', { name: 'Réessayer' });
      fireEvent.click(retryBtns[0]);
      await waitForContacts();
      expect(screen.queryByText('Server error')).not.toBeInTheDocument();
    });
  });

  describe('Empty state', () => {
    it('shows empty message and reset button when no contacts match', async () => {
      setupApi({ contacts: EMPTY_RESPONSE });
      renderView();
      await waitFor(() => {
        expect(screen.getByText('Aucun contact ne correspond à ces critères')).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: 'Réinitialiser tous les filtres' })).toBeInTheDocument();
    });
  });

  describe('Search', () => {
    it('filters contacts when the user types in the search box', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const searchInput = screen.getByPlaceholderText(/Rechercher par nom/);
      fireEvent.change(searchInput, { target: { value: 'Amina' } });

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('search=Amina'))).toBe(true);
      });
    });

    it('clears the search when the X button is clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const searchInput = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(searchInput.value).toBe('test');

      fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
      expect(searchInput.value).toBe('');
    });
  });

  describe('Segment selection', () => {
    it('renders segment pills including "Tous les contacts"', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getByText('Tous les contacts')).toBeInTheDocument();
      expect(screen.getByText('Experts Santé')).toBeInTheDocument();
      expect(screen.getAllByText('Maroc').length).toBeGreaterThanOrEqual(1);
    });

    it('calls onSelectSegment when a segment pill is clicked', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();
      fireEvent.click(screen.getByText('Experts Santé'));
      expect(props.onSelectSegment).toHaveBeenCalledWith('seg1');
    });

    it('calls onSelectSegment with "all" when "Tous les contacts" is clicked', async () => {
      setupApi();
      const { props } = renderView({ activeSegmentId: 'seg1' });
      await waitForContacts();
      fireEvent.click(screen.getByText('Tous les contacts'));
      expect(props.onSelectSegment).toHaveBeenCalledWith('all');
    });
  });

  describe('Filter sidebar', () => {
    it('renders filter sections for countries, genders, career stages, and tags', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      expect(screen.getByText("Pays d'origine")).toBeInTheDocument();
      expect(screen.getByText('Genre')).toBeInTheDocument();
      expect(screen.getByText('Stade de carrière')).toBeInTheDocument();
      expect(screen.getByText('Étiquettes / Tags')).toBeInTheDocument();
    });

    it('shows fetched countries as checkboxes in the sidebar', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      const countrySection = screen.getByText("Pays d'origine").closest('section')!;
      expect(within(countrySection).getByText('Maroc')).toBeInTheDocument();
      expect(within(countrySection).getByText('France')).toBeInTheDocument();
      expect(within(countrySection).getByText('Tunisie')).toBeInTheDocument();
    });

    it('shows gender labels as checkboxes in the sidebar', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      const genderSection = screen.getByText('Genre').closest('section')!;
      expect(within(genderSection).getByText('Femme')).toBeInTheDocument();
      expect(within(genderSection).getByText('Homme')).toBeInTheDocument();
      expect(within(genderSection).getByText('Non spécifié')).toBeInTheDocument();
    });

    it('shows career stage labels as checkboxes in the sidebar', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      const careerSection = screen.getByText('Stade de carrière').closest('section')!;
      expect(within(careerSection).getByText('R1 Débutant')).toBeInTheDocument();
      expect(within(careerSection).getByText('R2 Reconnu')).toBeInTheDocument();
      expect(within(careerSection).getByText('R3 Établi')).toBeInTheDocument();
      expect(within(careerSection).getByText('R4 Leader')).toBeInTheDocument();
    });

    it('shows tag buttons in the sidebar', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      const tagSection = screen.getByText('Étiquettes / Tags').closest('section')!;
      expect(within(tagSection).getByText('Santé')).toBeInTheDocument();
      expect(within(tagSection).getByText('IA')).toBeInTheDocument();
      expect(within(tagSection).getByText('Énergie')).toBeInTheDocument();
    });

    it('applies gender filter when checkbox is checked and "Appliquer les filtres" clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const genderSection = screen.getByText('Genre').closest('section')!;
      const femmeLabel = within(genderSection).getByText('Femme').closest('label')!;
      const femmeCheckbox = femmeLabel.querySelector('input')!;
      fireEvent.click(femmeCheckbox);

      fireEvent.click(screen.getByRole('button', { name: /Appliquer les filtres/ }));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('gender=FEMALE'))).toBe(true);
      });
    });

    it('applies country filter when checkbox is checked and "Appliquer les filtres" clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const countrySection = screen.getByText("Pays d'origine").closest('section')!;
      const marocLabel = within(countrySection).getByText('Maroc').closest('label')!;
      const marocCheckbox = marocLabel.querySelector('input')!;
      fireEvent.click(marocCheckbox);

      fireEvent.click(screen.getByRole('button', { name: /Appliquer les filtres/ }));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('countryOfOrigin=Maroc'))).toBe(true);
      });
    });

    it('applies career stage filter when checkbox is checked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const careerSection = screen.getByText('Stade de carrière').closest('section')!;
      const r3Label = within(careerSection).getByText('R3 Établi').closest('label')!;
      const r3Checkbox = r3Label.querySelector('input')!;
      fireEvent.click(r3Checkbox);

      fireEvent.click(screen.getByRole('button', { name: /Appliquer les filtres/ }));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('researchCareerStage=R3_ESTABLISHED'))).toBe(true);
      });
    });

    it('resets all filters when the reset button is clicked', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      const genderSection = screen.getByText('Genre').closest('section')!;
      const femmeLabel = within(genderSection).getByText('Femme').closest('label')!;
      const femmeCheckbox = femmeLabel.querySelector('input')!;
      fireEvent.click(femmeCheckbox);

      fireEvent.click(screen.getByRole('button', { name: /Appliquer les filtres/ }));
      await waitFor(() => {
        expect(vi.mocked(apiFetch).mock.calls.some(c => String(c[0]).includes('gender=FEMALE'))).toBe(true);
      });

      fireEvent.click(screen.getByTitle('Réinitialiser les filtres'));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls;
        const lastUrl = String(calls[calls.length - 1][0]);
        expect(lastUrl).not.toContain('gender=');
      });
      expect(props.onSelectSegment).toHaveBeenCalledWith('all');
    });
  });

  describe('Saving current filters as a segment', () => {
    it('opens the SaveSegmentModal when filters are active and button is clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const genderSection = screen.getByText('Genre').closest('section')!;
      const femmeLabel = within(genderSection).getByText('Femme').closest('label')!;
      const femmeCheckbox = femmeLabel.querySelector('input')!;
      fireEvent.click(femmeCheckbox);

      const saveBtn = screen.getByRole('button', { name: /Enregistrer comme segment/ });
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);

      await waitFor(() => {
        expect(screen.getByText('Enregistrer les filtres comme segment')).toBeInTheDocument();
      });
    });

    it('calls onSaveCurrentAsSegment with name and pending filters on submit', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      const genderSection = screen.getByText('Genre').closest('section')!;
      const femmeLabel = within(genderSection).getByText('Femme').closest('label')!;
      const femmeCheckbox = femmeLabel.querySelector('input')!;
      fireEvent.click(femmeCheckbox);

      fireEvent.click(screen.getByRole('button', { name: /Enregistrer comme segment/ }));

      await waitFor(() => {
        expect(screen.getByText('Enregistrer les filtres comme segment')).toBeInTheDocument();
      });

      const nameInput = screen.getByPlaceholderText(/Experts Santé Afrique 2024/);
      fireEvent.change(nameInput, { target: { value: 'Mes Femmes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(props.onSaveCurrentAsSegment).toHaveBeenCalledWith(
        'Mes Femmes',
        expect.objectContaining({ genders: ['FEMALE'] }),
      );
    });
  });

  describe('Contact row interactions', () => {
    it('opens the profile drawer when a row is clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      fireEvent.click(screen.getAllByText('Amina Benali')[0]);

      await waitFor(() => {
        expect(screen.getAllByText('Professeure').length).toBeGreaterThanOrEqual(2);
      });
      expect(screen.getByRole('button', { name: 'Voir la fiche complète' })).toBeInTheDocument();
    });

    it('calls onSelectContact when "Voir la fiche complète" is clicked in the drawer', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      fireEvent.click(screen.getAllByText('Amina Benali')[0]);
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Voir la fiche complète' })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Voir la fiche complète' }));
      expect(props.onSelectContact).toHaveBeenCalledWith('c1');
    });
  });

  describe('Row-level edit and delete actions', () => {
    it('renders edit and delete buttons for full-access user', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      const editLinks = screen.getAllByTitle('Modifier');
      expect(editLinks.length).toBeGreaterThanOrEqual(2);
      const deleteButtons = screen.getAllByTitle('Supprimer');
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2);
    });

    it('calls onDeleteContact when the delete button on a row is clicked', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      const deleteButtons = screen.getAllByTitle('Supprimer');
      fireEvent.click(deleteButtons[0]);
      expect(props.onDeleteContact).toHaveBeenCalledWith('c1');
    });

    it('links to the correct edit route for each contact', async () => {
      setupApi();
      renderView();
      await waitForContacts();
      const editLinks = screen.getAllByTitle('Modifier');
      expect(editLinks[0]).toHaveAttribute('href', '/contacts/c1/edit');
      expect(editLinks[1]).toHaveAttribute('href', '/contacts/c2/edit');
    });
  });

  describe('Checkbox selection', () => {
    it('selects the entire page when the header checkbox is checked', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      const pageLabel = screen.getByText(/Sélectionner cette page/).closest('label')!;
      const pageCheckbox = pageLabel.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(pageCheckbox);

      expect(props.onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'page' }),
      );
    });

    it('deselects the entire page when the header checkbox is unchecked', async () => {
      setupApi();
      const { props } = renderView({
        selection: { mode: 'page', ids: ['c1', 'c2'], filters: EMPTY_FILTERS, totalCount: 2 },
      });
      await waitForContacts();

      const pageLabel = screen.getByText(/Sélectionner cette page/).closest('label')!;
      const pageCheckbox = pageLabel.querySelector('input[type="checkbox"]') as HTMLInputElement;
      fireEvent.click(pageCheckbox);

      expect(props.onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'none' }),
      );
    });

    it('selects all filtered results via the button', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      fireEvent.click(screen.getByText(/Sélectionner les/));

      expect(props.onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'all-filtered' }),
      );
    });

    it('toggles individual row selection via the row checkbox', async () => {
      setupApi();
      const { props } = renderView();
      await waitForContacts();

      const checkboxes = screen.getAllByRole('checkbox');
      const rowCheckbox = checkboxes.find(
        (cb) => cb.closest('td') !== null,
      )!;
      fireEvent.click(rowCheckbox);

      expect(props.onSelectionChange).toHaveBeenCalled();
    });
  });

  describe('Floating selection action bar', () => {
    it('appears when selection mode is not "none"', async () => {
      setupApi();
      renderView({
        selection: { mode: 'page', ids: ['c1'], filters: EMPTY_FILTERS, totalCount: 2 },
      });
      await waitForContacts();

      expect(screen.getByText('Contacts sélectionnés')).toBeInTheDocument();
      expect(screen.getByText('Exporter')).toBeInTheDocument();
    });

    it('shows "all filtered" text when mode is "all-filtered"', async () => {
      setupApi();
      renderView({
        selection: { mode: 'all-filtered', ids: [], filters: EMPTY_FILTERS, totalCount: 10 },
      });
      await waitForContacts();

      expect(screen.getByText('Tous les résultats sélectionnés')).toBeInTheDocument();
    });

    it('calls onDeleteContacts when "Supprimer" is clicked in the floating bar', async () => {
      setupApi();
      const { props } = renderView({
        selection: { mode: 'page', ids: ['c1'], filters: EMPTY_FILTERS, totalCount: 2 },
      });
      await waitForContacts();

      const floatingBar = screen.getByText('Contacts sélectionnés').closest('div')!.parentElement!;
      const deleteBtn = within(floatingBar).getByText('Supprimer');
      fireEvent.click(deleteBtn);

      expect(props.onDeleteContacts).toHaveBeenCalledWith(['c1']);
    });

    it('clears selection when the X button is clicked', async () => {
      setupApi();
      const { props } = renderView({
        selection: { mode: 'page', ids: ['c1'], filters: EMPTY_FILTERS, totalCount: 2 },
      });
      await waitForContacts();

      const clearBtn = screen.getByTitle('Effacer la sélection');
      fireEvent.click(clearBtn);

      expect(props.onSelectionChange).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'none' }),
      );
    });
  });

  describe('Sorting', () => {
    it('toggles sort when a column header is clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      fireEvent.click(screen.getByText('CONTACT'));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('sortBy=name'))).toBe(true);
      });
    });

    it('toggles sort direction when the sort arrow is clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const nameHeader = screen.getByText('CONTACT').closest('th')!;
      const buttons = within(nameHeader).getAllByRole('button');
      const nameLabel = buttons[0];
      const sortBtn = buttons[1];

      fireEvent.click(nameLabel);
      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('sortBy=name') && u.includes('sortOrder=asc'))).toBe(true);
      });

      fireEvent.click(sortBtn);

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('sortBy=name') && u.includes('sortOrder=desc'))).toBe(true);
      });
    });

    it('sorts by a different column when another header is clicked', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      fireEvent.click(screen.getByText('AFFILIATION & FONCTION'));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('sortBy=affiliation'))).toBe(true);
      });
    });
  });

  describe('Pagination', () => {
    it('shows next/prev page buttons', async () => {
      setupApi({ contacts: THREE_CONTACTS_PAGE1 });
      renderView({ itemsPerPage: 2 });
      await waitForContacts();

      expect(screen.getByTitle('Page précédente')).toBeInTheDocument();
      expect(screen.getByTitle('Page suivante')).toBeInTheDocument();
    });

    it('disables the "previous" button on the first page', async () => {
      setupApi({ contacts: THREE_CONTACTS_PAGE1 });
      renderView({ itemsPerPage: 2 });
      await waitForContacts();

      expect(screen.getByTitle('Page précédente')).toBeDisabled();
    });
  });

  describe('Items per page', () => {
    it('renders a dropdown with 10, 20, 50, 100 options', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const select = screen.getByRole('combobox');
      expect(select).toBeInTheDocument();
      expect(within(select).getByText('10')).toBeInTheDocument();
      expect(within(select).getByText('20')).toBeInTheDocument();
      expect(within(select).getByText('50')).toBeInTheDocument();
      expect(within(select).getByText('100')).toBeInTheDocument();
    });

    it('calls onItemsPerPageChange when the dropdown value changes', async () => {
      setupApi();
      const onItemsPerPageChange = vi.fn();
      const { props } = renderView({ onItemsPerPageChange });
      await waitForContacts();

      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: '20' } });

      expect(onItemsPerPageChange).toHaveBeenCalledWith(20);
    });
  });

  describe('RBAC: read-only user', () => {
    it('hides the create button for read-only users', async () => {
      setupApi();
      renderView({ user: READ_ONLY_USER });
      await waitForContacts();

      expect(screen.queryByText('Nouveau Contact')).not.toBeInTheDocument();
    });

    it('hides edit and delete buttons on rows for read-only users', async () => {
      setupApi();
      renderView({ user: READ_ONLY_USER });
      await waitForContacts();

      expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
    });

    it('shows create button for full-access users', async () => {
      setupApi();
      renderView({ user: FULL_ACCESS_USER });
      await waitForContacts();

      expect(screen.getByText('Nouveau Contact')).toBeInTheDocument();
    });
  });

  describe('RBAC: read-write user', () => {
    it('shows edit buttons but hides delete buttons', async () => {
      setupApi();
      renderView({ user: READ_WRITE_USER });
      await waitForContacts();

      expect(screen.getAllByTitle('Modifier').length).toBeGreaterThan(0);
      expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
    });
  });

  describe('Create contact link', () => {
    it('links to /contacts/new', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const link = screen.getByText('Nouveau Contact').closest('a');
      expect(link).toHaveAttribute('href', '/contacts/new');
    });
  });

  describe('Tag filtering via sidebar', () => {
    it('applies tag filter when a tag button is clicked and filters applied', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const tagSection = screen.getByText('Étiquettes / Tags').closest('section')!;
      fireEvent.click(within(tagSection).getByText('Santé'));

      fireEvent.click(screen.getByRole('button', { name: /Appliquer les filtres/ }));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('tagId=tag1'))).toBe(true);
      });
    });
  });

  describe('Search clearing refreshes the contact list', () => {
    it('re-fetches contacts with empty search after clearing', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const searchInput = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;
      fireEvent.change(searchInput, { target: { value: 'xyz' } });

      await waitFor(() => {
        expect(vi.mocked(apiFetch).mock.calls.some(c => String(c[0]).includes('search=xyz'))).toBe(true);
      });

      fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
      expect(searchInput.value).toBe('');

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        const lastCalls = calls.slice(-3);
        expect(lastCalls.some(u => !u.includes('search=xyz'))).toBe(true);
      });
    });
  });

  describe('Row drawer shows all profile fields', () => {
    it('displays contact details including career stage label in the drawer', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      fireEvent.click(screen.getAllByText('Jean Dupont')[0]);

      await waitFor(() => {
        expect(screen.getAllByText('Chercheur').length).toBeGreaterThanOrEqual(3);
      });
      expect(screen.getAllByText('CNRS').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('Énergie').length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Segment pills react to activeSegmentId prop', () => {
    it('applies active styling to the selected segment pill', async () => {
      setupApi();
      renderView({ activeSegmentId: 'seg1' });
      await waitForContacts();

      const seg1Btn = screen.getByText('Experts Santé').closest('button')!;
      expect(seg1Btn.className).toContain('bg-[#005596]');
    });
  });

  describe('Column sort off-toggles and direction cycles', () => {
    it('turns the sort off when the same column header is clicked twice', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      fireEvent.click(screen.getByText('CONTACT'));
      await waitFor(() => {
        expect(vi.mocked(apiFetch).mock.calls.some(c => String(c[0]).includes('sortBy=name'))).toBe(true);
      });

      fireEvent.click(screen.getByText('CONTACT'));

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        const last = calls[calls.length - 1];
        expect(last).not.toContain('sortBy=name');
      });
    });

    it('switches the direction back to ascending when the arrow is clicked twice', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const nameHeader = screen.getByText('CONTACT').closest('th')!;
      const sortArrow = within(nameHeader).getAllByRole('button')[1];

      fireEvent.click(screen.getByText('CONTACT'));
      await waitFor(() => {
        expect(vi.mocked(apiFetch).mock.calls.some(c => String(c[0]).includes('sortOrder=asc'))).toBe(true);
      });

      fireEvent.click(sortArrow);
      await waitFor(() => {
        expect(vi.mocked(apiFetch).mock.calls.some(c => String(c[0]).includes('sortOrder=desc'))).toBe(true);
      });

      fireEvent.click(sortArrow);

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        const last = calls[calls.length - 1];
        expect(last).toContain('sortBy=name');
        expect(last).toContain('sortOrder=asc');
      });
    });
  });

  describe('Filters restored from router state', () => {
    it('applies location.state.filters when provided', async () => {
      setupApi();
      const props = makeDefaultProps();
      render(
        <MemoryRouter
          initialEntries={[
            { pathname: '/', state: { filters: { ...EMPTY_FILTERS, search: 'xavier' } } },
          ]}
        >
          <ContactsView {...props} />
        </MemoryRouter>
      );

      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('search=xavier'))).toBe(true);
      });
      const searchInput = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;
      expect(searchInput.value).toBe('xavier');
    });
  });

  describe('Recent searches', () => {
    it('saves the search on Enter, reopens on focus, and applies a suggestion', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const input = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;

      fireEvent.change(input, { target: { value: 'lyon' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(localStorage.getItem('euraxess_recent_searches')).toContain('lyon');
      });
      expect(screen.queryByText('Recherches récentes')).not.toBeInTheDocument();

      fireEvent.focus(input);

      expect(await screen.findByText('Recherches récentes')).toBeInTheDocument();
      const suggestion = screen.getByText('lyon').closest('button')!;
      fireEvent.click(suggestion);

      await waitFor(() => {
        expect(input.value).toBe('lyon');
      });
      await waitFor(() => {
        const calls = vi.mocked(apiFetch).mock.calls.map(c => String(c[0]));
        expect(calls.some(u => u.includes('search=lyon'))).toBe(true);
      });
    });

    it('tolerates corrupt recent-searches storage and skips empty searches', async () => {
      localStorage.setItem('euraxess_recent_searches', '{bad json');
      setupApi();
      renderView();
      await waitForContacts();

      const input = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;
      fireEvent.focus(input);
      expect(screen.queryByText('Recherches récentes')).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: '' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(localStorage.getItem('euraxess_recent_searches')).toBe('{bad json');
    });

    it('closes the suggestions dropdown with the Escape key', async () => {
      localStorage.setItem('euraxess_recent_searches', JSON.stringify(['ia']));
      setupApi();
      renderView();
      await waitForContacts();

      const input = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;
      fireEvent.focus(input);
      expect(await screen.findByText('Recherches récentes')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByText('Recherches récentes')).not.toBeInTheDocument();
    });

    it('ignores storage failures when saving a recent search', async () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      setupApi();
      renderView();
      await waitForContacts();

      const input = screen.getByPlaceholderText(/Rechercher par nom/) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'lyon' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(setItemSpy).toHaveBeenCalled();
      setItemSpy.mockRestore();
    });
  });

  describe('Segment bar overflow and scroll buttons', () => {
    it('enables scroll arrows when the segment bar overflows and scrolls on click', async () => {
      const originalRO = (globalThis as any).ResizeObserver;
      const roCallbacks: Array<() => void> = [];
      (globalThis as any).ResizeObserver = class {
        constructor(cb: () => void) {
          roCallbacks.push(cb);
        }
        observe() {
          roCallbacks.forEach(cb => cb());
        }
        unobserve() {}
        disconnect() {}
      };

      const scrollBy = vi.fn();
      (Element.prototype as any).scrollBy = scrollBy;

      const { container } = renderView();
      await waitForContacts();

      const scrollEl = container.querySelector('.scrollbar-none')! as HTMLElement;
      Object.defineProperty(scrollEl, 'clientWidth', { value: 200, configurable: true });
      Object.defineProperty(scrollEl, 'scrollWidth', { value: 600, configurable: true });
      Object.defineProperty(scrollEl, 'scrollLeft', { value: 150, configurable: true });

      fireEvent.scroll(scrollEl);

      const rightBtn = screen.getByTitle('Défiler les segments vers la droite');
      expect(rightBtn).not.toBeDisabled();
      fireEvent.click(rightBtn);
      expect(scrollBy).toHaveBeenCalledWith({ left: 200, behavior: 'smooth' });

      const leftBtn = screen.getByTitle('Défiler les segments vers la gauche');
      expect(leftBtn).not.toBeDisabled();
      fireEvent.click(leftBtn);
      expect(scrollBy).toHaveBeenCalledWith({ left: -200, behavior: 'smooth' });

      (globalThis as any).ResizeObserver = originalRO;
    });
  });

  describe('Sidebar filter toggles', () => {
    it('deselects the active segment when toggling a filter from a segment context', async () => {
      setupApi();
      const { props } = renderView({ activeSegmentId: 'seg1' });
      await waitForContacts();

      const section = screen.getByText("Pays d'origine").closest('section')!;
      const label = within(section).getByText('Maroc').closest('label')!;
      fireEvent.click(label.querySelector('input')!);

      expect(props.onSelectSegment).toHaveBeenCalledWith('all');
    });

    it('removes a country, gender, career stage and tag when toggled twice', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      const countrySection = screen.getByText("Pays d'origine").closest('section')!;
      const countryBox = within(countrySection).getByText('Maroc').closest('label')!.querySelector('input')!;
      fireEvent.click(countryBox);
      expect((countryBox as HTMLInputElement).checked).toBe(true);
      fireEvent.click(countryBox);
      expect((countryBox as HTMLInputElement).checked).toBe(false);

      const genderSection = screen.getByText('Genre').closest('section')!;
      const genderBox = within(genderSection).getByText('Femme').closest('label')!.querySelector('input')!;
      fireEvent.click(genderBox);
      expect((genderBox as HTMLInputElement).checked).toBe(true);
      fireEvent.click(genderBox);
      expect((genderBox as HTMLInputElement).checked).toBe(false);

      const stageSection = screen.getByText('Stade de carrière').closest('section')!;
      const stageBox = within(stageSection).getByText('R1 Débutant').closest('label')!.querySelector('input')!;
      fireEvent.click(stageBox);
      expect((stageBox as HTMLInputElement).checked).toBe(true);
      fireEvent.click(stageBox);
      expect((stageBox as HTMLInputElement).checked).toBe(false);

      const tagSection = screen.getByText('Étiquettes / Tags').closest('section')!;
      const tagBtn = within(tagSection).getByText('Santé');
      fireEvent.click(tagBtn);
      fireEvent.click(tagBtn);
    });
  });

  describe('Selection management state machine', () => {
    function renderControlled(initialSelection: ContactSelection, overrides = {}) {
      const mock = setupApi();
      let selection = initialSelection;
      const onSelectionChange = vi.fn((next: ContactSelection | ((prev: ContactSelection) => ContactSelection)) => {
        selection = typeof next === 'function' ? next(selection) : next;
      });
      const initialProps = makeDefaultProps({ ...overrides, selection, onSelectionChange });
      const api = render(<MemoryRouter><ContactsView {...initialProps} /></MemoryRouter>);
      const refresh = () =>
        api.rerender(
          <MemoryRouter>
            <ContactsView {...makeDefaultProps({ ...overrides, selection, onSelectionChange })} />
          </MemoryRouter>
        );
      return { ...api, mock, onSelectionChange, refresh, getSelection: () => selection };
    }

    function rowCheckboxes(container: HTMLElement) {
      return Array.from(container.querySelectorAll('tbody input[type="checkbox"]')) as HTMLInputElement[];
    }

    it('checks the first row from none to partial', async () => {
      const { container, refresh, getSelection } = renderControlled(DEFAULT_SELECTION);
      await waitForContacts();
      const [c1, c2] = rowCheckboxes(container);
      fireEvent.click(c1);
      refresh();
      expect(getSelection()).toEqual(expect.objectContaining({ mode: 'partial', ids: ['c1'] }));
      expect(c2).not.toBeNull();
    });

    it('adds a second row from partial', async () => {
      const { container, refresh, getSelection } = renderControlled({
        mode: 'partial', ids: ['c1'], filters: EMPTY_FILTERS, totalCount: 2,
      });
      await waitForContacts();
      const [c1, c2] = rowCheckboxes(container);
      fireEvent.click(c2);
      refresh();
      expect(getSelection()).toEqual(expect.objectContaining({ mode: 'partial', ids: ['c1', 'c2'] }));
      expect(c1).not.toBeNull();
    });

    it('removes a row from page mode', async () => {
      const { container, refresh, getSelection } = renderControlled({
        mode: 'page', ids: ['c1', 'c2'], filters: EMPTY_FILTERS, totalCount: 2,
      });
      await waitForContacts();
      const [c1] = rowCheckboxes(container);
      fireEvent.click(c1);
      refresh();
      expect(getSelection()).toEqual(expect.objectContaining({ mode: 'partial', ids: ['c2'] }));
    });

    it('removes a row from all-filtered mode', async () => {
      const { container, refresh, getSelection } = renderControlled({
        mode: 'all-filtered', ids: [], filters: EMPTY_FILTERS, totalCount: 2,
      });
      await waitForContacts();
      const [c1] = rowCheckboxes(container);
      fireEvent.click(c1);
      refresh();
      expect(getSelection()).toEqual(expect.objectContaining({ mode: 'partial', ids: ['c2'] }));
    });

    it('clears the selection when the last row is unchecked', async () => {
      const { container, refresh, getSelection } = renderControlled({
        mode: 'partial', ids: ['c1'], filters: EMPTY_FILTERS, totalCount: 1,
      });
      await waitForContacts();
      const [c1] = rowCheckboxes(container);
      fireEvent.click(c1);
      refresh();
      expect(getSelection()).toEqual(expect.objectContaining({ mode: 'none', ids: [] }));
    });
  });

  describe('Filter changes invalidate page selection', () => {
    it('resets an all-filtered selection to none when filters change', async () => {
      const mock = setupApi();
      let selection: ContactSelection = {
        mode: 'all-filtered', ids: [], filters: EMPTY_FILTERS, totalCount: 2,
      };
      const onSelectionChange = vi.fn((next: ContactSelection | ((prev: ContactSelection) => ContactSelection)) => {
        selection = typeof next === 'function' ? next(selection) : next;
      });
      const api = render(
        <MemoryRouter>
          <ContactsView {...makeDefaultProps({ selection, onSelectionChange })} />
        </MemoryRouter>
      );
      const refresh = () =>
        api.rerender(
          <MemoryRouter>
            <ContactsView {...makeDefaultProps({ selection, onSelectionChange })} />
          </MemoryRouter>
        );

      await waitForContacts();

      const section = screen.getByText("Pays d'origine").closest('section')!;
      const label = within(section).getByText('Maroc').closest('label')!;
      fireEvent.click(label.querySelector('input')!);
      fireEvent.click(screen.getByRole('button', { name: /Appliquer les filtres/ }));

      await waitFor(() => {
        expect(mock.mock.calls.some(c => String(c[0]).includes('countryOfOrigin=Maroc'))).toBe(true);
      });
      refresh();
      expect(selection.mode).toBe('none');
    });
  });

  describe('Export navigation', () => {
    it('navigates to the export page from the floating selection bar', async () => {
      setupApi();
      const props = makeDefaultProps({
        selection: { mode: 'page', ids: ['c1'], filters: EMPTY_FILTERS, totalCount: 2 },
      });
      render(
        <MemoryRouter initialEntries={['/']}>
          <Routes>
            <Route path="/export" element={<div>EXPORT_ROUTE_MARKER</div>} />
            <Route path="*" element={<ContactsView {...props} />} />
          </Routes>
        </MemoryRouter>
      );
      await waitForContacts();

      fireEvent.click(screen.getByTitle('Exporter la sélection'));
      expect(await screen.findByText('EXPORT_ROUTE_MARKER')).toBeInTheDocument();
    });
  });

  describe('Tag styling fallback', () => {
    it('falls back to the neutral badge for tags not present in the tags catalog', async () => {
      const customContact = {
        ...RAW_CONTACT_1,
        tags: [{ tag: { name: 'Biochimie', id: 'tagX' } }],
      };
      setupApi({
        contacts: {
          data: { contacts: [customContact] },
          pagination: {
            page: 1, limit: 10, totalCount: 1, totalPages: 1, currentPage: 1,
            hasNextPage: false, hasPrevPage: false, totalRecords: 1,
          } satisfies PaginationInfo,
        },
      });
      renderView();
      await waitForContacts();

      const badges = screen.getAllByText('Biochimie');
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].className).toContain('bg-slate-100');
    });
  });

  describe('Mobile filter backdrop', () => {
    it('opens on the Filtres toggle and closes on backdrop click or Enter', async () => {
      setupApi();
      renderView();
      await waitForContacts();

      fireEvent.click(screen.getByTitle('Afficher les filtres'));
      const backdrop = screen.getByRole('button', { name: 'Fermer les filtres' });
      expect(backdrop).toBeInTheDocument();

      fireEvent.click(backdrop);
      expect(screen.queryByRole('button', { name: 'Fermer les filtres' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByTitle('Afficher les filtres'));
      fireEvent.keyDown(screen.getByRole('button', { name: 'Fermer les filtres' }), { key: 'Enter' });
      expect(screen.queryByRole('button', { name: 'Fermer les filtres' })).not.toBeInTheDocument();
    });
  });

  describe('Hidden tags popover', () => {
    it('shows and clears the extra-tags popover for a contact with many tags', async () => {
      const contactWithManyTags = {
        ...RAW_CONTACT_1,
        tags: [
          { tag: { name: 'Santé', id: 'tag1' } },
          { tag: { name: 'IA', id: 'tag2' } },
          { tag: { name: 'Énergie', id: 'tag3' } },
          { tag: { name: 'Bio', id: 'tag4' } },
        ],
      };
      setupApi({
        contacts: {
          data: { contacts: [contactWithManyTags, RAW_CONTACT_2] },
          pagination: {
            page: 1, limit: 10, totalCount: 2, totalPages: 1, currentPage: 1,
            hasNextPage: false, hasPrevPage: false, totalRecords: 2,
          } satisfies PaginationInfo,
        },
      });
      renderView();
      await waitForContacts();

      const plusButton = screen.getByText('+2');
      fireEvent.click(plusButton);

      const popover = (await screen.findByText('Tous les tags:')).closest('div')!;
      expect(within(popover).getByText('Bio')).toBeInTheDocument();
      expect(within(popover).getByText('Énergie')).toBeInTheDocument();

      fireEvent.click(plusButton);
      expect(screen.queryByText('Tous les tags:')).not.toBeInTheDocument();
    });
  });

  describe('Mobile card interactions', () => {
    it('opens the drawer via click and via Enter/Space, and toggles its checkbox', async () => {
      setupApi();
      const { container } = renderView();
      await waitForContacts();

      const cards = Array.from(
        container.querySelectorAll('[role="button"][tabindex="0"]')
      ) as HTMLElement[];
      const card = cards.find(c => c.textContent?.includes('Amina Benali'))!;

      fireEvent.click(card);
      expect(await screen.findByText('Voir la fiche complète')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }));
      await waitFor(() => {
        expect(screen.queryByText('Voir la fiche complète')).not.toBeInTheDocument();
      });

      fireEvent.keyDown(card, { key: 'Enter' });
      expect(await screen.findByText('Voir la fiche complète')).toBeInTheDocument();

      const checkbox = card.querySelector('input[type="checkbox"]')!;
      fireEvent.click(checkbox);
      expect(checkbox).not.toBeNull();
    });
  });
});
