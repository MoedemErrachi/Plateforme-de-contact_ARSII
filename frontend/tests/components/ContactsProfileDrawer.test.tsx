import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ContactsProfileDrawer } from '../../src/components/ContactsProfileDrawer';
import { Contact } from '../../src/types';

const contact: Contact = {
  id: 'c1',
  firstName: 'Amina',
  lastName: 'Benali',
  name: 'Amina Benali',
  initials: 'AB',
  email: 'amina@x.fr',
  gender: 'FEMALE',
  countryOfOrigin: 'MA',
  city: 'Rabat',
  phone: '+2126',
  affiliation: 'UM5',
  function: 'Professeure',
  experience: '10 ans',
  facultyDepartment: 'Sciences',
  researchCareerStage: 'R3_ESTABLISHED',
  avatarUrl: null,
  tags: ['Santé', 'IA']
};

function renderDrawer(overrides: Partial<React.ComponentProps<typeof ContactsProfileDrawer>> = {}) {
  const props = {
    contact,
    getTagBadgeStyle: vi.fn(() => 'border-slate-200'),
    onNavigateToDetail: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };
  render(
    <MemoryRouter>
      <ContactsProfileDrawer {...props} />
    </MemoryRouter>
  );
  return props;
}

describe('ContactsProfileDrawer', () => {
  it('shows contact identity, coordinates and career labels', () => {
    renderDrawer();
    expect(screen.getByText('Amina Benali')).toBeInTheDocument();
    expect(screen.getByText('amina@x.fr')).toBeInTheDocument();
    expect(screen.getByText('Professeure')).toBeInTheDocument();
    expect(screen.getByText('UM5')).toBeInTheDocument();
    expect(screen.getByText(/Pays: MA/)).toBeInTheDocument();
    expect(screen.getByText(/Genre: Femme/)).toBeInTheDocument();
    expect(screen.getAllByText('R3 — Chercheur établi (Established)')).toHaveLength(2);
  });

  it('renders the contact tags with the style helper', () => {
    const props = renderDrawer();
    expect(screen.getByText('Santé')).toBeInTheDocument();
    expect(screen.getByText('IA')).toBeInTheDocument();
    expect(props.getTagBadgeStyle).toHaveBeenCalledWith('Santé');
    expect(props.getTagBadgeStyle).toHaveBeenCalledWith('IA');
  });

  it('shows a placeholder when the contact has no tags', () => {
    renderDrawer({ contact: { ...contact, tags: [] } });
    expect(screen.getByText('Aucun tag attribué')).toBeInTheDocument();
  });

  it('navigates to the detail page via the button handler', () => {
    const props = renderDrawer();
    fireEvent.click(screen.getByRole('button', { name: 'Voir la fiche complète' }));
    expect(props.onNavigateToDetail).toHaveBeenCalledWith('c1');
  });

  it('links to the edit route and closes the drawer', () => {
    const props = renderDrawer();
    fireEvent.click(screen.getByRole('link', { name: 'Modifier' }));
    expect(screen.getByRole('link', { name: 'Modifier' })).toHaveAttribute('href', '/contacts/c1/edit');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('closes the drawer with the close button', () => {
    const props = renderDrawer();
    const fermerButtons = screen.getAllByRole('button', { name: 'Fermer' });
    // Backdrop first, then the X button.
    fireEvent.click(fermerButtons[fermerButtons.length - 1]);
    expect(props.onClose).toHaveBeenCalled();
  });
});
