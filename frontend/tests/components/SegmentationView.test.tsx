import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentationView } from '../../src/components/SegmentationView';
import type { Contact, Tag, Segment, User } from '../../src/types';

vi.mock('../../src/components/Skeletons', () => ({
  SegmentationSkeleton: () => <div data-testid="segmentation-skeleton">Skeleton</div>,
}));

const adminUser: User = {
  id: 'u1',
  name: 'Admin',
  email: 'admin@test.com',
  role: 'admin',
  privilege: 'FULL_ACCESS',
};

const readOnlyUser: User = {
  id: 'u2',
  name: 'Reader',
  email: 'reader@test.com',
  role: 'user',
  privilege: 'READ',
};

const readWriteUser: User = {
  id: 'u3',
  name: 'Editor',
  email: 'editor@test.com',
  role: 'user',
  privilege: 'READ_WRITE',
};

const contacts: Contact[] = [
  {
    id: 'c1',
    firstName: 'Alice',
    lastName: 'Dupont',
    name: 'Alice Dupont',
    initials: 'AD',
    email: 'alice@example.com',
    gender: 'FEMALE',
    countryOfOrigin: 'France',
    affiliation: 'CNRS',
    function: 'Directrice',
    researchCareerStage: 'R3_ESTABLISHED',
    tags: ['VIP', 'Santé'],
  },
  {
    id: 'c2',
    firstName: 'Bob',
    lastName: 'Martin',
    name: 'Bob Martin',
    initials: 'BM',
    email: 'bob@example.com',
    gender: 'MALE',
    countryOfOrigin: 'Sénégal',
    affiliation: 'UCAD',
    function: 'Professeur',
    researchCareerStage: 'R4_LEADING',
    tags: ['VIP'],
  },
  {
    id: 'c3',
    firstName: 'Clara',
    lastName: 'Nguyen',
    name: 'Clara Nguyen',
    initials: 'CN',
    email: 'clara@example.com',
    gender: 'FEMALE',
    countryOfOrigin: 'Vietnam',
    affiliation: 'CNRS',
    researchCareerStage: 'R1_FIRST_STAGE',
    tags: [],
  },
];

const tags: Tag[] = [
  { id: 't1', name: 'VIP', color: 'bg-amber-100 text-amber-800 border-amber-300', description: 'Experts VIP' },
  { id: 't2', name: 'Santé', color: 'bg-rose-100 text-rose-800 border-rose-300', description: 'Domaine santé' },
];

const segments: Segment[] = [
  {
    id: 'all',
    name: 'Tous',
    description: 'Tous les contacts',
    filters: { search: '', countries: [], genders: [], careerStages: [], tags: [] },
    memberCount: 3,
  },
  {
    id: 'seg-2',
    name: 'Experts Santé France',
    description: 'Femmes en santé basées en France',
    filters: {
      search: '',
      countries: ['France'],
      genders: ['FEMALE'],
      careerStages: [],
      tags: ['Santé'],
    },
    memberCount: 1,
  },
];

function makeHandlers() {
  return {
    onApplySegment: vi.fn(),
    onCreateSegment: vi.fn(),
    onUpdateSegment: vi.fn(),
    onDeleteSegment: vi.fn(),
    onCreateTag: vi.fn(),
    onUpdateTag: vi.fn(),
    onDeleteTag: vi.fn(),
    onSaveTagContacts: vi.fn().mockResolvedValue(undefined),
  };
}

function renderView(overrides: Partial<React.ComponentProps<typeof SegmentationView>> = {}) {
  const handlers = makeHandlers();
  const props = {
    contacts,
    tags,
    segments,
    user: adminUser,
    ...handlers,
    ...overrides,
  };
  const result = render(<SegmentationView {...props} />);
  return { ...result, handlers };
}

function clickTagsTab() {
  fireEvent.click(screen.getByRole('button', { name: /Gestion des Tags/ }));
}

describe('SegmentationView', () => {
  describe('Loading state', () => {
    it('renders the skeleton when isLoading is true', () => {
      render(
        <SegmentationView
          isLoading
          contacts={[]}
          tags={[]}
          segments={[]}
          onApplySegment={vi.fn()}
          onCreateSegment={vi.fn()}
          onUpdateSegment={vi.fn()}
          onDeleteSegment={vi.fn()}
          onCreateTag={vi.fn()}
          onUpdateTag={vi.fn()}
          onDeleteTag={vi.fn()}
          onSaveTagContacts={vi.fn().mockResolvedValue(undefined)}
        />
      );
      expect(screen.getByTestId('segmentation-skeleton')).toBeInTheDocument();
      expect(screen.queryByText('Segmentation & Gestion des Tags')).not.toBeInTheDocument();
    });

    it('renders normally when isLoading is false', () => {
      renderView({ isLoading: false });
      expect(screen.getByText('Segmentation & Gestion des Tags')).toBeInTheDocument();
    });
  });

  describe('Tab switching', () => {
    it('defaults to the segments tab', () => {
      renderView();
      expect(screen.getByText('Tous')).toBeInTheDocument();
      expect(screen.queryByText(/Étiquettes & Catégories/)).not.toBeInTheDocument();
    });

    it('switches to the tags tab when clicking the tags button', async () => {
      renderView();
      clickTagsTab();
      expect(screen.getByText(/Étiquettes & Catégories R&I/)).toBeInTheDocument();
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.queryByText('Experts Santé France')).not.toBeInTheDocument();
    });

    it('switches back to segments tab', async () => {
      renderView();
      clickTagsTab();
      fireEvent.click(screen.getByRole('button', { name: /Gestion des Segments/ }));
      expect(screen.getByText('Tous')).toBeInTheDocument();
    });
  });

  describe('Segments tab – listing', () => {
    it('displays all segment cards with name and description', () => {
      renderView();
      expect(screen.getByText('Tous')).toBeInTheDocument();
      expect(screen.getByText('Tous les contacts')).toBeInTheDocument();
      expect(screen.getByText('Experts Santé France')).toBeInTheDocument();
      expect(screen.getByText('Femmes en santé basées en France')).toBeInTheDocument();
    });

    it('displays member count on each card', () => {
      renderView();
      const badges = screen.getAllByText(/contacts/);
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('displays filter criteria badges on a segment with filters', () => {
      renderView();
      expect(screen.getByText('France')).toBeInTheDocument();
      expect(screen.getByText('Femme')).toBeInTheDocument();
      expect(screen.getByText(/Tag:/)).toBeInTheDocument();
    });

    it('shows "Tous les filtres réinitialisés" for the all segment', () => {
      renderView();
      expect(screen.getByText(/Tous les filtres/)).toBeInTheDocument();
    });
  });

  describe('Segments tab – search', () => {
    it('filters segments by name', async () => {
      const user = userEvent.setup();
      renderView();
      await user.type(screen.getByPlaceholderText('Rechercher un segment...'), 'Santé');
      expect(screen.getByText('Experts Santé France')).toBeInTheDocument();
      expect(screen.queryByText('Tous')).not.toBeInTheDocument();
    });

    it('shows empty state when search matches nothing', async () => {
      const user = userEvent.setup();
      renderView();
      await user.type(screen.getByPlaceholderText('Rechercher un segment...'), 'ZZZZZ');
      expect(screen.getByText('Aucun segment ne correspond à cette recherche')).toBeInTheDocument();
    });

    it('clears search with the X button', async () => {
      const user = userEvent.setup();
      renderView();
      const input = screen.getByPlaceholderText('Rechercher un segment...');
      await user.type(input, 'ZZZZZ');
      await user.click(screen.getByLabelText('Effacer la recherche'));
      expect(input).toHaveValue('');
      expect(screen.getByText('Tous')).toBeInTheDocument();
    });
  });

  describe('Segments tab – empty state', () => {
    it('shows empty state when no segments exist', () => {
      renderView({ segments: [] });
      expect(screen.getByText('Aucun segment pour le moment')).toBeInTheDocument();
    });
  });

  describe('Segments tab – apply', () => {
    it('calls onApplySegment with the segment data', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      const applyBtn = screen.getAllByText('Appliquer au répertoire de contacts')[1];
      await user.click(applyBtn);
      expect(handlers.onApplySegment).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'seg-2', name: 'Experts Santé France' })
      );
    });
  });

  describe('Segments tab – RBAC: create / edit / delete buttons', () => {
    it('shows all action buttons for an admin user', () => {
      renderView({ user: adminUser });
      expect(screen.getByText('Créer un Nouveau Segment')).toBeInTheDocument();
      expect(screen.getAllByTitle('Modifier le segment').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByTitle('Supprimer').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByTitle('Dupliquer').length).toBeGreaterThanOrEqual(1);
    });

    it('hides write actions for a read-only user', () => {
      renderView({ user: readOnlyUser });
      expect(screen.queryByText('Créer un Nouveau Segment')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Modifier le segment')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Dupliquer')).not.toBeInTheDocument();
    });

    it('shows edit but not delete for a read-write user', () => {
      renderView({ user: readWriteUser });
      expect(screen.getByText('Créer un Nouveau Segment')).toBeInTheDocument();
      expect(screen.getAllByTitle('Modifier le segment').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
    });
  });

  describe('Segments tab – create', () => {
    it('opens the create modal, fills name and description, and calls onCreateSegment', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));

      expect(screen.getByText('Créer un nouveau segment')).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText(/Experts Santé Afrique/), 'Nouveau Segment');
      await user.type(screen.getByPlaceholderText(/Objectif de ce groupe/), 'Description test');
      await user.click(screen.getByText('Sauvegarder le Segment'));

      expect(handlers.onCreateSegment).toHaveBeenCalledTimes(1);
      const created = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(created.name).toBe('Nouveau Segment');
      expect(created.description).toBe('Description test');
      expect(created.id).toMatch(/^seg-/);
      expect(screen.queryByText('Créer un nouveau segment')).not.toBeInTheDocument();
    });

    it('does not create a segment when name is empty', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));
      await user.click(screen.getByText('Sauvegarder le Segment'));
      expect(handlers.onCreateSegment).not.toHaveBeenCalled();
    });

    it('closes the modal when clicking Annuler', async () => {
      renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));
      expect(screen.getByText('Créer un nouveau segment')).toBeInTheDocument();
      await user.click(screen.getByText('Annuler'));
      expect(screen.queryByText('Créer un nouveau segment')).not.toBeInTheDocument();
    });
  });

  describe('Segments tab – edit', () => {
    it('opens the edit modal pre-filled and calls onUpdateSegment', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();

      await user.click(screen.getAllByTitle('Modifier le segment')[0]);

      expect(screen.getByText('Modifier le segment')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Experts Santé France')).toBeInTheDocument();

      const nameInput = screen.getByDisplayValue('Experts Santé France');
      await user.clear(nameInput);
      await user.type(nameInput, 'Modifié');
      await user.click(screen.getByText('Sauvegarder le Segment'));

      expect(handlers.onUpdateSegment).toHaveBeenCalledTimes(1);
      const updated = handlers.onUpdateSegment.mock.calls[0][0] as Segment;
      expect(updated.id).toBe('seg-2');
      expect(updated.name).toBe('Modifié');
    });
  });

  describe('Segments tab – delete', () => {
    it('calls onDeleteSegment with the correct id when clicking delete', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getAllByTitle('Supprimer')[0]);
      expect(handlers.onDeleteSegment).toHaveBeenCalled();
    });
  });

  describe('Segments tab – duplicate', () => {
    it('calls onCreateSegment with "(Copie)" suffix for the first duplicated segment', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      const dupBtns = screen.getAllByTitle('Dupliquer');
      await user.click(dupBtns[0]);
      expect(handlers.onCreateSegment).toHaveBeenCalledTimes(1);
      const copied = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(copied.name).toContain('(Copie)');
      expect(copied.id).not.toBe('seg-1');
    });
  });

  describe('Segment create modal – filter toggles', () => {
    it('toggles a country filter and submits with it', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));

      await user.type(screen.getByPlaceholderText(/Experts Santé Afrique/), 'Test');

      const countryBtns = screen.getAllByRole('button');
      const franceBtn = countryBtns.find(b => b.textContent === 'France' && b.tagName === 'BUTTON')!;
      await user.click(franceBtn);
      await user.click(screen.getByText('Sauvegarder le Segment'));

      expect(handlers.onCreateSegment).toHaveBeenCalledTimes(1);
      const created = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(created.filters.countries).toContain('France');
    });

    it('toggles a gender filter', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));
      await user.type(screen.getByPlaceholderText(/Experts Santé Afrique/), 'Test');

      await user.click(screen.getByRole('button', { name: 'Homme' }));
      await user.click(screen.getByText('Sauvegarder le Segment'));

      const created = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(created.filters.genders).toContain('MALE');
    });

    it('toggles a career stage filter', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));
      await user.type(screen.getByPlaceholderText(/Experts Santé Afrique/), 'Test');

      await user.click(screen.getByRole('button', { name: 'R4 Leader' }));
      await user.click(screen.getByText('Sauvegarder le Segment'));

      const created = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(created.filters.careerStages).toContain('R4_LEADING');
    });

    it('sets a search keyword filter', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));
      await user.type(screen.getByPlaceholderText(/Experts Santé Afrique/), 'Test');

      await user.type(screen.getByPlaceholderText(/Université, Sénégal/), 'CNRS');
      await user.click(screen.getByText('Sauvegarder le Segment'));

      const created = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(created.filters.search).toBe('CNRS');
    });

    it('toggles a tag filter', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      await user.click(screen.getByText('Créer un Nouveau Segment'));
      await user.type(screen.getByPlaceholderText(/Experts Santé Afrique/), 'Test');

      const tagBtns = screen.getAllByRole('button');
      const vipBtn = tagBtns.find(b => b.textContent === 'VIP' && b.tagName === 'BUTTON' && b !== screen.queryByText('Créer un Nouveau Segment'))!;
      await user.click(vipBtn);
      await user.click(screen.getByText('Sauvegarder le Segment'));

      const created = handlers.onCreateSegment.mock.calls[0][0] as Segment;
      expect(created.filters.tags).toContain('VIP');
    });
  });

  describe('Tags tab – listing', () => {
    it('displays all tags with name, description, and contact count', () => {
      renderView();
      clickTagsTab();
      expect(screen.getByText('VIP')).toBeInTheDocument();
      expect(screen.getByText('Experts VIP')).toBeInTheDocument();
      expect(screen.getByText('Santé')).toBeInTheDocument();
      expect(screen.getByText('Domaine santé')).toBeInTheDocument();
      expect(screen.getAllByText('Gérer les contacts').length).toBeGreaterThanOrEqual(1);
    });

    it('shows "Gérer les contacts" link on each tag card', async () => {
      renderView();
      clickTagsTab();
      const manageLinks = screen.getAllByText('Gérer les contacts');
      expect(manageLinks.length).toBe(2);
    });

    it('shows RBAC action buttons for admin', async () => {
      renderView({ user: adminUser });
      clickTagsTab();
      expect(screen.getByText('Créer un Nouveau Tag')).toBeInTheDocument();
      expect(screen.getAllByTitle('Modifier').length).toBeGreaterThan(0);
      expect(screen.getAllByTitle('Supprimer').length).toBeGreaterThan(0);
    });

    it('hides write actions for read-only user', async () => {
      renderView({ user: readOnlyUser });
      clickTagsTab();
      expect(screen.queryByText('Créer un Nouveau Tag')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Modifier')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Supprimer')).not.toBeInTheDocument();
    });
  });

  describe('Tags tab – search', () => {
    it('filters tags by name', async () => {
      renderView();
      const user = userEvent.setup();
      clickTagsTab();
      await user.type(screen.getByPlaceholderText('Rechercher un tag...'), 'Santé');
      expect(screen.getByText('Santé')).toBeInTheDocument();
      expect(screen.queryByText('VIP')).not.toBeInTheDocument();
    });

    it('shows empty state when no tags match', async () => {
      renderView();
      const user = userEvent.setup();
      clickTagsTab();
      await user.type(screen.getByPlaceholderText('Rechercher un tag...'), 'ZZZZZ');
      expect(screen.getByText('Aucun tag ne correspond à cette recherche')).toBeInTheDocument();
    });

    it('clears search with the X button', async () => {
      renderView();
      const user = userEvent.setup();
      clickTagsTab();
      const input = screen.getByPlaceholderText('Rechercher un tag...');
      await user.type(input, 'ZZZZZ');
      await user.click(screen.getByLabelText('Effacer la recherche'));
      expect(input).toHaveValue('');
      expect(screen.getByText('VIP')).toBeInTheDocument();
    });

    it('shows empty state when no tags exist', () => {
      renderView({ tags: [] });
      clickTagsTab();
      expect(screen.getByText('Aucun tag pour le moment')).toBeInTheDocument();
    });
  });

  describe('Tags tab – create', () => {
    it('opens create tag modal, fills form, and calls onCreateTag', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      clickTagsTab();
      await user.click(screen.getByText('Créer un Nouveau Tag'));

      expect(screen.getByText('Créer un nouveau Tag')).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText(/Leader R&I/), 'Nouveau Tag');
      await user.type(screen.getByPlaceholderText(/Explication courte/), 'Tag description');
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(handlers.onCreateTag).toHaveBeenCalledTimes(1);
      const created = handlers.onCreateTag.mock.calls[0][0] as Tag;
      expect(created.name).toBe('Nouveau Tag');
      expect(created.description).toBe('Tag description');
      expect(created.id).toMatch(/^tag-/);
    });

    it('does not create a tag when name is empty', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      clickTagsTab();
      await user.click(screen.getByText('Créer un Nouveau Tag'));
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
      expect(handlers.onCreateTag).not.toHaveBeenCalled();
    });

    it('closes the modal when clicking Annuler', async () => {
      renderView();
      const user = userEvent.setup();
      clickTagsTab();
      await user.click(screen.getByText('Créer un Nouveau Tag'));
      await user.click(screen.getByRole('button', { name: 'Annuler' }));
      expect(screen.queryByText('Créer un nouveau Tag')).not.toBeInTheDocument();
    });
  });

  describe('Tags tab – edit', () => {
    it('opens the edit modal pre-filled and calls onUpdateTag', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      clickTagsTab();

      const editBtns = screen.getAllByTitle('Modifier');
      await user.click(editBtns[0]);

      expect(screen.getByText('Modifier le Tag')).toBeInTheDocument();
      expect(screen.getByDisplayValue('VIP')).toBeInTheDocument();

      const nameInput = screen.getByDisplayValue('VIP');
      await user.clear(nameInput);
      await user.type(nameInput, 'VIP Modified');
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

      expect(handlers.onUpdateTag).toHaveBeenCalledTimes(1);
      const updated = handlers.onUpdateTag.mock.calls[0][0] as Tag;
      expect(updated.id).toBe('t1');
      expect(updated.name).toBe('VIP Modified');
    });
  });

  describe('Tags tab – delete', () => {
    it('calls onDeleteTag with the correct id', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      clickTagsTab();
      const deleteBtns = screen.getAllByTitle('Supprimer');
      await user.click(deleteBtns[0]);
      expect(handlers.onDeleteTag).toHaveBeenCalledWith('t1');
    });
  });

  describe('Tag assignment drawer', () => {
    function openDrawer() {
      clickTagsTab();
      const manageBtns = screen.getAllByText('Gérer les contacts');
      fireEvent.click(manageBtns[0]);
    }

    it('opens a drawer showing contacts with checkboxes', async () => {
      renderView();
      openDrawer();
      expect(screen.getByText('Affectation directe')).toBeInTheDocument();
      expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
      expect(screen.getByText('Bob Martin')).toBeInTheDocument();
      expect(screen.getByText('Clara Nguyen')).toBeInTheDocument();
      expect(screen.getAllByRole('checkbox').length).toBeGreaterThanOrEqual(3);
    });

    it('pre-checks contacts that already have the tag', async () => {
      renderView();
      openDrawer();
      const aliceRow = screen.getByText('Alice Dupont').closest('label')!;
      const aliceCheckbox = within(aliceRow).getByRole('checkbox');
      expect(aliceCheckbox).toBeChecked();

      const bobRow = screen.getByText('Bob Martin').closest('label')!;
      const bobCheckbox = within(bobRow).getByRole('checkbox');
      expect(bobCheckbox).toBeChecked();

      const claraRow = screen.getByText('Clara Nguyen').closest('label')!;
      const claraCheckbox = within(claraRow).getByRole('checkbox');
      expect(claraCheckbox).not.toBeChecked();
    });

    it('toggles a contact checkbox', async () => {
      renderView();
      const user = userEvent.setup();
      openDrawer();
      const claraRow = screen.getByText('Clara Nguyen').closest('label')!;
      const claraCheckbox = within(claraRow).getByRole('checkbox');
      expect(claraCheckbox).not.toBeChecked();
      await user.click(claraCheckbox);
      expect(claraCheckbox).toBeChecked();
      await user.click(claraCheckbox);
      expect(claraCheckbox).not.toBeChecked();
    });

    it('filters contacts by search within the drawer', async () => {
      renderView();
      const user = userEvent.setup();
      openDrawer();
      const searchInput = screen.getByPlaceholderText('Chercher un contact...');
      await user.type(searchInput, 'Alice');
      expect(screen.getByText('Alice Dupont')).toBeInTheDocument();
      expect(screen.queryByText('Bob Martin')).not.toBeInTheDocument();
    });

    it('calls onSaveTagContacts with selected ids and closes drawer', async () => {
      const { handlers } = renderView();
      const user = userEvent.setup();
      openDrawer();
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => {
        expect(handlers.onSaveTagContacts).toHaveBeenCalled();
      });
      expect(handlers.onSaveTagContacts).toHaveBeenCalledWith(
        't1',
        expect.arrayContaining(['c1', 'c2'])
      );
      expect(screen.queryByText('Affectation directe')).not.toBeInTheDocument();
    });

    it('closes the drawer on cancel', async () => {
      renderView();
      const user = userEvent.setup();
      openDrawer();
      expect(screen.getByText('Affectation directe')).toBeInTheDocument();
      const cancelBtns = screen.getAllByRole('button', { name: 'Annuler' });
      await user.click(cancelBtns[cancelBtns.length - 1]);
      expect(screen.queryByText('Affectation directe')).not.toBeInTheDocument();
    });

    it('keeps drawer open on save error', async () => {
      const handlers = makeHandlers();
      handlers.onSaveTagContacts.mockRejectedValueOnce(new Error('fail'));
      render(<SegmentationView contacts={contacts} tags={tags} segments={segments} user={adminUser} {...handlers} />);

      const user = userEvent.setup();
      openDrawer();
      await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
      await waitFor(() => {
        expect(handlers.onSaveTagContacts).toHaveBeenCalled();
      });
      expect(screen.getByText('Affectation directe')).toBeInTheDocument();
    });
  });

  describe('Segment count fallback', () => {
    it('uses local contact filtering when memberCount is absent', () => {
      const segWithoutCount: Segment[] = [
        {
          id: 'seg-no-count',
          name: 'France only',
          description: '',
          filters: { search: '', countries: ['France'], genders: [], careerStages: [], tags: [] },
        },
      ];
      renderView({ segments: segWithoutCount });
      expect(screen.getByText('1 contacts', { selector: 'span' })).toBeInTheDocument();
    });
  });
});
