import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ContactDetailView } from '../../src/components/ContactDetailView';
import { Contact, User } from '../../src/types';

const baseContact: Contact = {
  id: 'c1',
  firstName: 'Amina',
  lastName: 'Benali',
  name: 'Amina Benali',
  initials: 'AB',
  email: 'amina@univ.ma',
  gender: 'FEMALE',
  countryOfOrigin: 'Maroc',
  city: 'Rabat',
  phone: '+212600000000',
  affiliation: 'UM5',
  function: 'Professeure',
  experience: '15 ans',
  facultyDepartment: 'Sciences',
  researchCareerStage: 'R3_ESTABLISHED',
  avatarUrl: null,
  tags: ['IA', 'Santé'],
};

const adminUser: User = {
  id: 'u1',
  name: 'Admin',
  email: 'admin@test.fr',
  role: 'admin',
  privilege: 'FULL_ACCESS',
};

const readOnlyUser: User = {
  id: 'u2',
  name: 'Reader',
  email: 'reader@test.fr',
  role: 'user',
  privilege: 'READ',
};

function renderDetail(
  overrides: {
    contacts?: Contact[];
    user?: User | null;
    routeId?: string;
  } = {}
) {
  const { contacts = [baseContact], user = adminUser, routeId = 'c1' } = overrides;
  return render(
    <MemoryRouter initialEntries={[`/contacts/${routeId}`]}>
      <Routes>
        <Route path="/contacts/:id" element={<ContactDetailView contacts={contacts} user={user} />} />
        <Route path="/contacts" element={<div>Contacts list</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ContactDetailView', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('displays contact name and key information when provided via props', () => {
    renderDetail();
    expect(screen.getByRole('heading', { name: 'Amina Benali' })).toBeInTheDocument();
    expect(screen.getByText('amina@univ.ma')).toBeInTheDocument();
    expect(screen.getAllByText('Professeure').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('+212600000000')).toBeInTheDocument();
    expect(screen.getByText('Rabat')).toBeInTheDocument();
    expect(screen.getAllByText('UM5').length).toBeGreaterThanOrEqual(1);
  });

  it('displays the contact initials when no avatar is set', () => {
    renderDetail();
    expect(screen.getByText('AB')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('displays an avatar image when avatarUrl is provided', () => {
    const contact = { ...baseContact, avatarUrl: 'https://img.test/a.jpg' };
    renderDetail({ contacts: [contact] });
    const img = screen.getByRole('img', { name: 'Amina Benali' });
    expect(img).toHaveAttribute('src', 'https://img.test/a.jpg');
  });

  it('shows the affiliation badge next to the name', () => {
    renderDetail();
    const badges = screen.getAllByText('UM5');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('does not render the affiliation badge when affiliation is empty', () => {
    const contact = { ...baseContact, affiliation: '' };
    renderDetail({ contacts: [contact] });
    expect(screen.getByRole('heading', { name: 'Amina Benali' })).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });

  it('displays tags in both the header and R&I section', () => {
    renderDetail();
    const iaTags = screen.getAllByText('IA');
    const santeTags = screen.getAllByText('Santé');
    expect(iaTags.length).toBeGreaterThanOrEqual(2);
    expect(santeTags.length).toBeGreaterThanOrEqual(2);
  });

  it('shows placeholder when tags array is empty', () => {
    const contact = { ...baseContact, tags: [] };
    renderDetail({ contacts: [contact] });
    expect(screen.getByText('Aucun tag attribué')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation with links', () => {
    renderDetail();
    const links = screen.getAllByRole('link');
    const baseLinks = links.filter(l => l.getAttribute('href') === '/contacts');
    expect(baseLinks.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Base de données')).toBeInTheDocument();
    expect(screen.getByText('Chercheurs & Experts')).toBeInTheDocument();
  });

  it('shows the "Modifier" edit link for users with write access', () => {
    renderDetail({ user: adminUser });
    const editLink = screen.getByRole('link', { name: /Modifier/ });
    expect(editLink).toHaveAttribute('href', '/contacts/c1/edit');
  });

  it('hides the edit link for read-only users', () => {
    renderDetail({ user: readOnlyUser });
    expect(screen.queryByRole('link', { name: /Modifier/ })).not.toBeInTheDocument();
  });

  it('hides the edit link when user is null', () => {
    renderDetail({ user: null });
    expect(screen.queryByRole('link', { name: /Modifier/ })).not.toBeInTheDocument();
  });

  it('copies the current URL to clipboard and shows a toast on share', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderDetail();
    const shareBtn = screen.getByRole('button', { name: 'Partager la fiche' });
    await user.click(shareBtn);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(screen.getByText(/Lien du profil copié/)).toBeInTheDocument();
  });

  it('hides the share toast after a delay', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderDetail();
    await user.click(screen.getByRole('button', { name: 'Partager la fiche' }));
    expect(screen.getByText(/Lien du profil copié/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });
    await waitFor(() => {
      expect(screen.queryByText(/Lien du profil copié/)).not.toBeInTheDocument();
    });
    vi.useRealTimers();
  });

  it('renders identity fields with correct labels', () => {
    renderDetail();
    expect(screen.getByText('Genre')).toBeInTheDocument();
    expect(screen.getByText('Femme')).toBeInTheDocument();
    expect(screen.getByText('Stade de carrière')).toBeInTheDocument();
    expect(screen.getByText(/R3.*Chercheur établi/)).toBeInTheDocument();
    expect(screen.getByText("Pays d'origine")).toBeInTheDocument();
    expect(screen.getByText('Maroc')).toBeInTheDocument();
    expect(screen.getByText('Ville')).toBeInTheDocument();
  });

  it('renders R&I affiliation fields', () => {
    renderDetail();
    expect(screen.getByText('Affiliation R&I')).toBeInTheDocument();
    expect(screen.getByText('Fonction')).toBeInTheDocument();
    expect(screen.getAllByText('Professeure').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Expérience')).toBeInTheDocument();
    expect(screen.getByText('15 ans')).toBeInTheDocument();
    expect(screen.getByText('Faculté / Département')).toBeInTheDocument();
    expect(screen.getByText('Sciences')).toBeInTheDocument();
  });

  it('displays em-dash placeholder for missing optional fields', () => {
    const contact: Contact = {
      ...baseContact,
      city: null,
      phone: null,
      function: null,
      experience: null,
      facultyDepartment: null,
    };
    renderDetail({ contacts: [contact] });
    const emDashes = screen.getAllByText('—');
    expect(emDashes.length).toBeGreaterThanOrEqual(4);
  });

  it('fetches contact from API when not found in props', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          JSON.stringify({
            data: {
              contact: {
                id: 'c99',
                firstName: 'Jean',
                lastName: 'Dupont',
                gender: 'MALE',
                email: 'jean@test.fr',
                affiliation: 'CNRS',
                countryOfOrigin: 'France',
                tags: [],
              },
            },
          })
        ),
    });

    renderDetail({ contacts: [], routeId: 'c99' });
    expect(screen.queryByRole('heading', { name: 'Jean Dupont' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Jean Dupont' })).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/contacts/c99',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(screen.getByText('jean@test.fr')).toBeInTheDocument();
  });

  it('redirects to /contacts on API error', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    renderDetail({ contacts: [], routeId: 'c-fail' });
    await waitFor(() => {
      expect(screen.getByText('Contacts list')).toBeInTheDocument();
    });
  });

  it('redirects to /contacts when API returns no contact in body', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify({ data: {} })),
    });

    renderDetail({ contacts: [], routeId: 'c-missing' });
    await waitFor(() => {
      expect(screen.getByText('Contacts list')).toBeInTheDocument();
    });
  });

  it('shows skeleton while loading from API', async () => {
    fetchSpy.mockReturnValue(new Promise(() => {}));

    const { container } = renderDetail({ contacts: [], routeId: 'c-slow' });
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('displays section headings for Coordonnées and Identité & Carrière', () => {
    renderDetail();
    expect(screen.getByText('Coordonnées')).toBeInTheDocument();
    expect(screen.getByText('Identité & Carrière')).toBeInTheDocument();
  });

  it('uses country and city to compose the location string', () => {
    renderDetail();
    expect(screen.getByText('Maroc, Rabat')).toBeInTheDocument();
  });

  it('shows location em-dash when both country and city are empty', () => {
    const contact = { ...baseContact, countryOfOrigin: '', city: '' };
    renderDetail({ contacts: [contact] });
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
  });
});
