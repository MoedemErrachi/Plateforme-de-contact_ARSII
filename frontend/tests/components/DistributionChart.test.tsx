import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { DistributionChart, DistributionServerData } from '../../src/components/DistributionChart';
import { Contact } from '../../src/types';

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: 'c',
    firstName: 'A',
    lastName: 'B',
    email: 'a@b.c',
    gender: 'FEMALE',
    countryOfOrigin: 'FR',
    affiliation: 'UM5',
    researchCareerStage: 'R1_FIRST_STAGE',
    tags: [],
    ...overrides,
  };
}

const SERVER_DATA: DistributionServerData = {
  distributionByCountry: [
    { country: 'France', count: 10 },
    { country: 'Sénégal', count: 6 },
    { country: 'Maroc', count: 4 },
  ],
  distributionByGender: [
    { gender: 'FEMALE', count: 12 },
    { gender: 'MALE', count: 8 },
  ],
  distributionByCountryGender: [
    { country: 'France', gender: 'MALE', count: 6 },
    { country: 'France', gender: 'FEMALE', count: 4 },
    { country: 'Sénégal', gender: 'FEMALE', count: 6 },
  ],
  totalCount: 20,
};

describe('DistributionChart', () => {
  it('renders all three mode toggle buttons', () => {
    render(<DistributionChart contacts={[]} />);
    expect(screen.getByRole('button', { name: 'Pays & Genre (empilé)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Par pays' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Par genre' })).toBeInTheDocument();
  });

  it('defaults to country & gender (empilé) mode', () => {
    render(<DistributionChart contacts={[]} serverData={SERVER_DATA} />);
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
    // La légende des genres n'apparaît que dans le mode empilé.
    expect(screen.getByText('Homme')).toBeInTheDocument();
    expect(screen.getByText('Femme')).toBeInTheDocument();
  });

  it('aggregates country/gender data from contacts (no serverData)', () => {
    const contacts = [
      makeContact({ countryOfOrigin: 'Sénégal', gender: 'MALE' }),
      makeContact({ countryOfOrigin: 'Sénégal', gender: 'FEMALE' }),
      makeContact({ countryOfOrigin: 'France', gender: 'MALE' }),
      makeContact({ countryOfOrigin: 'France', gender: 'MALE' }),
    ];
    render(<DistributionChart contacts={contacts} />);
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
  });

  it('normalizes missing country and N/A to "Inconnu" when aggregating from contacts', () => {
    const contacts = [
      makeContact({ countryOfOrigin: '' }),
      makeContact({ countryOfOrigin: 'N/A' }),
      makeContact({ countryOfOrigin: '  ' }),
    ];
    render(<DistributionChart contacts={contacts} />);
    expect(screen.getAllByText('Inconnu').length).toBeGreaterThanOrEqual(1);
  });

  it('switches to "Par pays" mode and shows country totals', () => {
    const contacts = [
      makeContact({ countryOfOrigin: 'France' }),
      makeContact({ countryOfOrigin: 'France' }),
      makeContact({ countryOfOrigin: 'Sénégal' }),
    ];
    render(<DistributionChart contacts={contacts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Par pays' }));
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
  });

  it('switches to "Par genre" mode and shows gender totals with counts', () => {
    const contacts = [
      makeContact({ gender: 'FEMALE' }),
      makeContact({ gender: 'FEMALE' }),
      makeContact({ gender: 'MALE' }),
      makeContact({ gender: 'MALE' }),
      makeContact({ gender: 'NOT_SPECIFIED' }),
    ];
    render(<DistributionChart contacts={contacts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Par genre' }));
    expect(screen.getByText('Femme')).toBeInTheDocument();
    expect(screen.getByText('Homme')).toBeInTheDocument();
    expect(screen.getAllByText('2 (40%)')).toHaveLength(2);
    expect(screen.getByText('1 (20%)')).toBeInTheDocument();
  });

  it('uses serverData for gender totals and totalCount when provided', () => {
    render(<DistributionChart contacts={[]} serverData={SERVER_DATA} />);
    fireEvent.click(screen.getByRole('button', { name: 'Par genre' }));
    expect(screen.getByText('Femme')).toBeInTheDocument();
    expect(screen.getByText('12 (60%)')).toBeInTheDocument();
    expect(screen.getByText('8 (40%)')).toBeInTheDocument();
  });

  it('uses serverData distributionByCountry in "Par pays" mode', () => {
    render(<DistributionChart contacts={[]} serverData={SERVER_DATA} />);
    fireEvent.click(screen.getByRole('button', { name: 'Par pays' }));
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Sénégal')).toBeInTheDocument();
    expect(screen.getByText('Maroc')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('shows stacked gender segments in country & gender mode using serverData', () => {
    render(<DistributionChart contacts={[]} serverData={SERVER_DATA} />);
    const row = screen.getByText('France').closest('.flex.items-center.gap-3') as HTMLElement;
    const segments = Array.from(row.querySelectorAll('[style]')).filter(
      (el) => (el as HTMLElement).style.width.includes('%')
    ) as HTMLElement[];
    expect(segments.length).toBeGreaterThanOrEqual(2);

    // Le segment "Femme" (rose) affiche son badge de décompte au survol.
    const female = segments.find((s) => s.style.backgroundColor.includes('184, 22, 124'));
    fireEvent.mouseEnter(female!);
    expect(within(row).getByText('4')).toBeInTheDocument();

    // Hover un autre segment remplace le badge.
    const male = segments.find((s) => s.style.backgroundColor.includes('0, 85, 150'));
    fireEvent.mouseEnter(male!);
    expect(within(row).getByText('6')).toBeInTheDocument();
    expect(within(row).queryByText('4')).not.toBeInTheDocument();
  });

  it('sorts countries by descending total in country mode', () => {
    const contacts = [
      makeContact({ countryOfOrigin: 'B' }),
      makeContact({ countryOfOrigin: 'B' }),
      makeContact({ countryOfOrigin: 'B' }),
      makeContact({ countryOfOrigin: 'A' }),
    ];
    const { container } = render(<DistributionChart contacts={contacts} />);
    fireEvent.click(screen.getByRole('button', { name: 'Par pays' }));
    const rows = container.querySelectorAll('.flex.items-center.gap-3');
    const labels = Array.from(rows).map((r) => r.textContent);
    expect(labels[0]).toContain('B');
    expect(labels[1]).toContain('A');
  });

  it('shows gender legend in country & gender mode', () => {
    render(<DistributionChart contacts={[]} serverData={SERVER_DATA} />);
    expect(screen.getByText('Femme')).toBeInTheDocument();
    expect(screen.getByText('Homme')).toBeInTheDocument();
  });
});
