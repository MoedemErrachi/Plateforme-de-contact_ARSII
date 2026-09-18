import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveSegmentModal } from '../../src/components/SaveSegmentModal';
import { FilterState } from '../../src/types';

const EMPTY_FILTERS: FilterState = { search: '', countries: [], genders: [], careerStages: [], tags: [] };

function renderModal(overrides: Partial<React.ComponentProps<typeof SaveSegmentModal>> = {}) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    pendingFilters: EMPTY_FILTERS,
    segmentNameInput: '',
    onSegmentNameInputChange: vi.fn(),
    onSubmit: vi.fn((e) => e.preventDefault()),
    ...overrides
  };
  render(<SaveSegmentModal {...props} />);
  return props;
}

describe('SaveSegmentModal', () => {
  it('renders the title, the name input and the empty-filters placeholder', () => {
    renderModal();
    expect(screen.getByText('Enregistrer les filtres comme segment')).toBeInTheDocument();
    expect(screen.getByText('Tous les contacts (aucun filtre restreint)')).toBeInTheDocument();
  });

  it('lists every non-empty filter kind', () => {
    renderModal({
      pendingFilters: {
        search: 'IA',
        countries: ['MA', 'TN'],
        genders: ['FEMALE'],
        careerStages: ['R3_ESTABLISHED'],
        tags: ['Santé']
      }
    });
    expect(screen.getByText('Recherche: "IA"')).toBeInTheDocument();
    expect(screen.getByText('Pays d\'origine: MA, TN')).toBeInTheDocument();
    expect(screen.getByText('Genres: Femme')).toBeInTheDocument();
    expect(screen.getByText('Stades de carrière: R3 Établi')).toBeInTheDocument();
    expect(screen.getByText('Tags: Santé')).toBeInTheDocument();
    expect(screen.queryByText(/Tous les contacts/)).not.toBeInTheDocument();
  });

  it('propagates the name input via onChange', () => {
    const props = renderModal();
    fireEvent.change(screen.getByPlaceholderText('ex: Experts Santé Afrique 2024'), { target: { value: 'Santé 2024' } });
    expect(props.onSegmentNameInputChange).toHaveBeenCalledWith('Santé 2024');
  });

  it('submits the form with the onSubmit handler', () => {
    const props = renderModal({ segmentNameInput: 'Santé 2024' });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(props.onSubmit).toHaveBeenCalled();
  });

  it('closes via the cancel button', () => {
    const props = renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(props.onClose).toHaveBeenCalled();
  });
});