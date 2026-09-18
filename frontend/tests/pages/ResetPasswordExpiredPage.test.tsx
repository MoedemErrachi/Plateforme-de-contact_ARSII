import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResetPasswordExpiredPage } from '../../src/pages/ResetPasswordExpiredPage';

describe('ResetPasswordExpiredPage', () => {
  it('explains the expired link and offers to request a new one', () => {
    render(
      <MemoryRouter>
        <ResetPasswordExpiredPage />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: 'Lien expiré' })).toBeInTheDocument();
    expect(screen.getByText(/invalide, expiré ou a déjà été utilisé/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Demander un nouveau lien' })).toHaveAttribute('href', '/login?forgot=1');
  });
});