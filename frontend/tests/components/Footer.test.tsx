import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '../../src/components/Footer';

describe('Footer', () => {
  it('renders the EURAXESS Africa brand and copyright line', () => {
    render(<Footer />);
    expect(screen.getByText('EURAXESS Africa')).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Réseau de Recherche & Innovation EURAXESS Africa/)).toBeInTheDocument();
  });

  it('renders the three navigation links', () => {
    render(<Footer />);
    expect(screen.getByRole('link', { name: /État du système/ })).toHaveAttribute('href', '#status');
    expect(screen.getByRole('link', { name: /Centre d'aide/ })).toHaveAttribute('href', '#help');
    expect(screen.getByRole('link', { name: /Politique de confidentialité/ })).toHaveAttribute('href', '#privacy');
  });
});