import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { WorldMapWidget, WorldMapCountry, WorldMapCountryGender } from '../../src/components/WorldMapWidget';

const mockChartOn = vi.fn();
const mockChartOff = vi.fn();
const mockChartDispose = vi.fn();
const mockChartResize = vi.fn();
const mockChartSetOption = vi.fn();
const mockChartGetModel = vi.fn().mockReturnValue(null);

vi.mock('echarts/core', () => ({
  init: vi.fn(() => ({
    on: mockChartOn,
    off: mockChartOff,
    dispose: mockChartDispose,
    resize: mockChartResize,
    setOption: mockChartSetOption,
    getModel: mockChartGetModel,
  })),
  use: vi.fn(),
  registerMap: vi.fn(),
}));

vi.mock('echarts/charts', () => ({ MapChart: {} }));
vi.mock('echarts/components', () => ({ TooltipComponent: {}, VisualMapComponent: {} }));
vi.mock('echarts/renderers', () => ({ CanvasRenderer: {} }));

vi.mock('../../src/assets/maps/world.json', () => ({ default: { type: 'FeatureCollection', features: [] } }));

const sampleCountries: WorldMapCountry[] = [
  { country: 'France', iso2: 'FR', count: 25, percentage: 35 },
  { country: 'Sénégal', iso2: 'SN', count: 15, percentage: 21 },
  { country: 'Unknown', iso2: null, count: 5, percentage: 7 },
];

const sampleCountryGender: WorldMapCountryGender[] = [
  { country: 'France', iso2: 'FR', gender: 'MALE', count: 15 },
  { country: 'France', iso2: 'FR', gender: 'FEMALE', count: 10 },
  { country: 'Sénégal', iso2: 'SN', gender: 'MALE', count: 8 },
  { country: 'Sénégal', iso2: 'SN', gender: 'FEMALE', count: 7 },
];

function renderMap(
  countries: WorldMapCountry[] = sampleCountries,
  countryGender: WorldMapCountryGender[] = sampleCountryGender
) {
  return render(
    <MemoryRouter>
      <WorldMapWidget
        distributionByCountry={countries}
        distributionByCountryGender={countryGender}
        countryLabels={[{ iso2: 'FR', country: 'France' }, { iso2: 'SN', country: 'Sénégal' }]}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = vi.fn();
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('WorldMapWidget', () => {
  it('renders the map container with correct aria-label', () => {
    renderMap();
    expect(screen.getByRole('img', { name: /carte mondiale/i })).toBeInTheDocument();
  });

  it('shows the "Recentrer" button', () => {
    renderMap();
    expect(screen.getByRole('button', { name: /recentrer la carte/i })).toBeInTheDocument();
  });

  it('shows instruction text when data is present', () => {
    renderMap();
    expect(screen.getByText(/Survolez un pays pour le détail/)).toBeInTheDocument();
  });

  it('shows the unknown-country count when some entries have no iso2', () => {
    renderMap();
    expect(screen.getByText(/5 chercheurs non positionnables/)).toBeInTheDocument();
  });

  it('hides the unknown-count note when all countries have iso2', () => {
    const allKnown: WorldMapCountry[] = [
      { country: 'France', iso2: 'FR', count: 25, percentage: 50 },
      { country: 'Sénégal', iso2: 'SN', count: 25, percentage: 50 },
    ];
    renderMap(allKnown, sampleCountryGender);
    expect(screen.queryByText(/non positionnables/)).not.toBeInTheDocument();
  });

  it('shows empty state when distributionByCountry is empty', () => {
    renderMap([], []);
    expect(screen.getByText('Aucune donnée géographique disponible pour le moment.')).toBeInTheDocument();
  });

  it('hides instruction text when no data', () => {
    renderMap([], []);
    expect(screen.queryByText(/Survolez un pays/)).not.toBeInTheDocument();
  });

  it('initializes and disposes echarts on mount/unmount', async () => {
    const { unmount } = renderMap();
    const { init } = await import('echarts/core');
    expect(init).toHaveBeenCalled();
    unmount();
    expect(mockChartDispose).toHaveBeenCalled();
  });

  it('sets chart options with map data derived from props', async () => {
    renderMap();
    await waitForECharts();
    expect(mockChartSetOption).toHaveBeenCalled();
    const call = mockChartSetOption.mock.calls[0][0];
    expect(call.series[0].map).toBe('arsiiWorld');
    expect(call.series[0].data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'FR', value: 25 }),
        expect.objectContaining({ name: 'SN', value: 15 }),
      ])
    );
  });

  it('registers click handlers on the chart', () => {
    renderMap();
    expect(mockChartOn).toHaveBeenCalledWith('click', expect.any(Function));
  });
});

async function waitForECharts() {
  await new Promise((r) => setTimeout(r, 0));
}
