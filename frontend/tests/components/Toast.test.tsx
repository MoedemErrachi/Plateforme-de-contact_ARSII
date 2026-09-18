import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '../../src/components/Toast';

function FireButton({ message }: { message: string }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, 'success')}>fire</button>;
}

function renderHost(message = 'Opération réussie') {
  return render(
    <ToastProvider>
      <FireButton message={message} />
    </ToastProvider>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('does not render any toast initially', () => {
    renderHost();
    expect(screen.queryByText('Opération réussie')).not.toBeInTheDocument();
  });

  it('displays a toast message after showToast is called', () => {
    renderHost();
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByText('Opération réussie')).toBeInTheDocument();
  });

  it('removes the toast after 4.5 s', async () => {
    vi.useFakeTimers();
    renderHost();
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByText('Opération réussie')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(4600);
    });
    expect(screen.queryByText('Opération réussie')).not.toBeInTheDocument();
  });

  it('deduplicates identical consecutive messages within 2.5 s', () => {
    vi.useFakeTimers();
    renderHost();
    const button = screen.getByRole('button', { name: 'fire' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getAllByText('Opération réussie')).toHaveLength(1);
  });

  it('shows two distinct toasts for different messages on different hosts', () => {
    const { unmount } = renderHost();
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    unmount();
    renderHost('Autre message');
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    expect(screen.getByText('Autre message')).toBeInTheDocument();
  });

  it('dismisses a toast when its close button is clicked', () => {
    renderHost();
    fireEvent.click(screen.getByRole('button', { name: 'fire' }));
    const dismissButton = screen.getAllByRole('button')[1];
    fireEvent.click(dismissButton);
    expect(screen.queryByText('Opération réussie')).not.toBeInTheDocument();
  });
});