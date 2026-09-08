import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../../src/components/Header';
import { User } from '../../src/types';

function renderHeader(overrides: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props = {
    isAuthenticated: true,
    user: { id: '1', name: 'Jean Pierre Dupont', email: 'jpd@x.fr', role: 'user', privilege: 'FULL_ACCESS' } as User,
    onLogout: vi.fn(),
    onExportAll: vi.fn(),
    ...overrides
  };
  render(
    <MemoryRouter>
      <Header {...props} />
    </MemoryRouter>
  );
  return props;
}

describe('Header', () => {
  it('shows a login link when unauthenticated', () => {
    renderHeader({ isAuthenticated: false, user: undefined });
    expect(screen.getByRole('link', { name: 'Se connecter' })).toBeInTheDocument();
  });

  it('shows researcher navigation links for a non-admin user', () => {
    renderHeader();
    expect(screen.getByRole('link', { name: 'Tableau de bord' })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: 'Contacts' })).toHaveAttribute('href', '/contacts');
    expect(screen.getByRole('link', { name: 'Importation' })).toHaveAttribute('href', '/import');
    expect(screen.getByRole('link', { name: 'Segmentation' })).toHaveAttribute('href', '/segments');
  });

  it('shows an always-visible Administration title (no nav dropdown/link) for an admin user', () => {
    renderHeader({ user: { id: '1', name: 'Admin', email: 'a@x.fr', role: 'admin' } as User });
    // Le titre remplace le lien/nav : l'admin n'a qu'une seule page.
    expect(screen.getByText('Administration')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Contacts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Toggle Navigation' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link').some(l => l.getAttribute('href') === '/admin')).toBe(true);
  });

  it('never hides the header on scroll for an admin user', () => {
    const props = renderHeader({ user: { id: '1', name: 'Admin', email: 'a@x.fr', role: 'admin' } as User, isHeaderVisible: false });
    const header = screen.getByRole('banner');
    expect(header.className).toContain('translate-y-0');
    expect(header.className).not.toContain('-translate-y-full');
  });

  it('hides the header on scroll for a non-admin user when isHeaderVisible is false', () => {
    renderHeader({ isHeaderVisible: false });
    const header = screen.getByRole('banner');
    expect(header.className).not.toContain('translate-y-0');
    expect(header.className).toContain('-translate-y-full');
  });

  it('opens the profile dropdown and shows profile + admin-scoped entries for admin', () => {
    const onLogout = vi.fn();
    renderHeader({ user: { id: '1', name: 'Admin', email: 'a@x.fr', role: 'admin' } as User, onLogout });
    // Profile button is the first button in the header (before mobile toggle).
    const header = screen.getByRole('banner');
    const profileButton = header.querySelector('button.rounded-full');
    fireEvent.click(profileButton as HTMLElement);

    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mon profil' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Nouveau contact' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  it('shows create/export entries for a researcher and triggers onExportAll', () => {
    const onExportAll = vi.fn();
    renderHeader({ onExportAll });
    const header = screen.getByRole('banner');
    fireEvent.click(header.querySelector('button.rounded-full') as HTMLElement);

    expect(screen.getByRole('link', { name: 'Nouveau contact' })).toHaveAttribute('href', '/contacts/new');
    fireEvent.click(screen.getByRole('button', { name: 'Exporter les données' }));
    expect(onExportAll).toHaveBeenCalledTimes(1);
  });

  it('does not show the create link for a READ-only user', () => {
    renderHeader({ user: { id: '1', name: 'Lecteur', email: 'l@x.fr', role: 'user', privilege: 'READ' } as User });
    const header = screen.getByRole('banner');
    fireEvent.click(header.querySelector('button.rounded-full') as HTMLElement);
    expect(screen.queryByRole('link', { name: 'Nouveau contact' })).not.toBeInTheDocument();
  });

  it('closes the profile dropdown when clicking outside', async () => {
    renderHeader();
    const header = screen.getByRole('banner');
    fireEvent.click(header.querySelector('button.rounded-full') as HTMLElement);
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument());
  });

  it('toggles the mobile menu and renders navigation links inside it', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Navigation' }));
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toBeInTheDocument();
    // Mobile drawer links include the same destinations.
    expect(screen.getAllByRole('link', { name: 'Contacts' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Navigation' }));
    expect(screen.queryByRole('button', { name: 'Fermer le menu' })).not.toBeInTheDocument();
  });
});
