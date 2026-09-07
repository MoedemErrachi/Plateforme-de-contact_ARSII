import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../../src/components/Pagination';

describe('Pagination', () => {
  it('renders nothing when there is a single page', () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a page button for every page when ranges do not overlap', () => {
    render(<Pagination page={3} totalPages={5} onPageChange={vi.fn()} />);
    for (const n of [1, 2, 3, 4, 5]) {
      expect(screen.getByRole('button', { name: String(n) })).toBeInTheDocument();
    }
  });

  it('marks the active page with aria-current="page"', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: '3' })).not.toHaveAttribute('aria-current');
  });

  it('inserts ellipses for large page ranges', () => {
    render(<Pagination page={5} totalPages={20} onPageChange={vi.fn()} />);
    // Pages 1,2 · 4,5,6 · 19,20 with ellipses in between.
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '19' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20' })).toBeInTheDocument();
  });

  it('calls onPageChange when a page button is clicked', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} totalPages={5} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });
});