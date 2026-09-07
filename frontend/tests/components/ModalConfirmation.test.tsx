import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalConfirmation } from '../../src/components/ModalConfirmation';

function renderModal(overrides: Partial<React.ComponentProps<typeof ModalConfirmation>> = {}) {
  const props = {
    open: true,
    title: 'Supprimer le contact ?',
    message: 'Cette action est définitive.',
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides
  };
  return { ...render(<ModalConfirmation {...props} />), props };
}

describe('ModalConfirmation', () => {
  it('renders the title, message and default labels', () => {
    renderModal();
    expect(screen.getByText('Supprimer le contact ?')).toBeInTheDocument();
    expect(screen.getByText('Cette action est définitive.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmer' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
  });

  it('calls onCancel when the cancel button is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(props.onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when the confirm button is clicked', () => {
    const { props } = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(props.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while the confirm promise is pending', async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    renderModal({ onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    const confirm = screen.getByRole('button', { name: /Confirmer/ });
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
    resolve();
    await waitFor(() => expect(confirm).not.toBeDisabled());
  });

  it('keeps buttons disabled and blocks onConfirm while isLoading is true', () => {
    const { props } = renderModal({ isLoading: true });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    expect(props.onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeDisabled();
  });

  it('reset the submitting state even when onConfirm rejects', async () => {
    const onConfirm = vi.fn(() => Promise.reject(new Error('boom')));
    renderModal({ onConfirm });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmer' }));
    const confirm = screen.getByRole('button', { name: /Confirmer/ });
    await waitFor(() => expect(confirm).not.toBeDisabled());
    // Unhandled rejection handled by the caller; the modal must recover.
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('uses the primary variant styling for non-danger modals', () => {
    renderModal({ variant: 'primary', title: 'Valider ?' });
    expect(screen.getByText('Valider ?')).toBeInTheDocument();
  });
});