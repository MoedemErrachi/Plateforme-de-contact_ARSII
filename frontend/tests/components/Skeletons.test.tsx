import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  SkeletonBox, LoadingSpinner, DashboardSkeleton, ContactProfileSkeleton,
  ContactsTableSkeleton, AuthSplash, SegmentationSkeleton, OcrResultSkeleton,
  ChatThinkingBubble
} from '../../src/components/Skeletons';

describe('Skeleton primitives', () => {
  it('renders a skeleton box with extra classes', () => {
    const { container } = render(<SkeletonBox className="w-10 h-10" />);
    const box = container.firstChild as HTMLElement;
    expect(box.className).toContain('animate-pulse');
    expect(box.className).toContain('w-10 h-10');
  });

  it('renders a default loading spinner with its message', () => {
    render(<LoadingSpinner />);
    expect(screen.getByText('Chargement en cours...')).toBeInTheDocument();
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders a large spinner variant', () => {
    const { container } = render(<LoadingSpinner size="lg" text="Synchronisation..." />);
    expect(screen.getByText('Synchronisation...')).toBeInTheDocument();
    expect(container.querySelector('.w-12.h-12')).not.toBeNull();
  });

  it('renders a spinner without text when text is empty', () => {
    const { container } = render(<LoadingSpinner size="sm" text="" />);
    expect(screen.queryByText('Chargement en cours...')).not.toBeInTheDocument();
    expect(container.querySelector('.w-5.h-5')).not.toBeNull();
  });
});

describe('Composite skeletons', () => {
  it('renders the dashboard skeleton with four KPI blocks', () => {
    const { container } = render(<DashboardSkeleton />);
    const kpis = Array.from(container.querySelectorAll('div')).filter(
      el => el.className.includes('h-40') && el.className.includes('justify-between')
    );
    expect(kpis).toHaveLength(4);
  });

  it('renders the contact profile skeleton', () => {
    const { container } = render(<ContactProfileSkeleton />);
    expect(container.querySelectorAll('.rounded-full').length).toBeGreaterThan(0);
  });

  it('renders the contacts table skeleton', () => {
    const { container } = render(<ContactsTableSkeleton />);
    expect(container.querySelectorAll('.divide-y').length).toBe(1);
  });

  it('renders the auth splash with a loading message', () => {
    render(<AuthSplash />);
    expect(screen.getByText('Chargement...')).toBeInTheDocument();
  });

  it('renders the segmentation skeleton', () => {
    const { container } = render(<SegmentationSkeleton />);
    expect(container.textContent).toContain('');
  });

  it('renders the OCR result skeleton with eight field placeholders', () => {
    const { container } = render(<OcrResultSkeleton />);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
    const fields = Array.from(container.querySelectorAll('div')).filter(
      el => el.className.includes('bg-[#F4F6F8]')
    );
    expect(fields).toHaveLength(8);
  });

  it('renders the chatbot thinking bubble with the polite label', () => {
    render(<ChatThinkingBubble />);
    expect(screen.getByLabelText("L'assistant est en train de rédiger une réponse")).toBeInTheDocument();
  });
});