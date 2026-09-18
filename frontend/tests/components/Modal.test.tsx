import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '../../src/components/Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}} title="Titre">
        <div>Contenu</div>
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the title and children in the portal when open (centered)', () => {
    render(
      <Modal open onClose={() => {}} title="Confirmation">
        <p>Un contenu</p>
      </Modal>
    );
    expect(screen.getByText('Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Un contenu')).toBeInTheDocument();
  });

  it('closes the modal when clicking the backdrop', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titre">
        <div>Contenu</div>
      </Modal>
    );
    // Backdrop is the first of the two "Fermer" buttons (no X icon class).
    const buttons = screen.getAllByRole('button', { name: 'Fermer' });
    fireEvent.click(buttons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes the modal on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Titre">
        <div>Contenu</div>
      </Modal>
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it after unmount', () => {
    const { unmount } = render(
      <Modal open onClose={() => {}} title="Titre">
        <div>Contenu</div>
      </Modal>
    );
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('hides the close (X) button when showClose is false', () => {
    render(
      <Modal open onClose={() => {}} title="Titre" showClose={false}>
        <div>Contenu</div>
      </Modal>
    );
    // Backdrop button still present; the X button must not be.
    expect(screen.getAllByRole('button', { name: 'Fermer' })).toHaveLength(1);
  });

  it('renders without a header when no title is provided', () => {
    render(
      <Modal open onClose={() => {}}>
        <div>Contenu</div>
      </Modal>
    );
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });

  it('renders a drawer variant into the portal', () => {
    render(
      <Modal open onClose={() => {}} variant="drawer">
        <div className="drawer-content">Contenu du tiroir</div>
      </Modal>
    );
    expect(screen.getByText('Contenu du tiroir')).toBeInTheDocument();
  });
});