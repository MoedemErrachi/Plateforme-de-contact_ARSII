import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useLocation, Routes, Route } from 'react-router-dom';
import { WorldMapWidget, WorldMapCountry, WorldMapCountryGender } from '../../src/components/WorldMapWidget';

const mockChartOn = vi.fn();
const mockChartOff = vi.fn();
const mockChartDispose = vi.fn();
const mockChartResize = vi.fn();
const mockChartSetOption = vi.fn();

let mockGetModelReturn: any = null;
const mockChartGetModel = vi.fn().mockImplementation(() => mockGetModelReturn);

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
vi.mock('../../src/assets/maps/world.json', () => ({
  default: { type: 'FeatureCollection', features: [] },
}));

const countries: WorldMapCountry[] = [
  { country: 'France', iso2: 'FR', count: 25, percentage: 35 },
  { country: 'SÃ©nÃ©gal', iso2: 'SN', count: 15, percentage: 21 },
  { country: 'Unknown', iso2: null, count: 5, percentage: 7 },
];

const countryGender: WorldMapCountryGender[] = [
  { country: 'France', iso2: 'FR', gender: 'MALE', count: 15 },
  { country: 'France', iso2: 'FR', gender: 'FEMALE', count: 10 },
  { country: 'France', iso2: 'FR', gender: 'NOT_SPECIFIED', count: 0 },
  { country: 'SÃ©nÃ©gal', iso2: 'SN', gender: 'MALE', count: 8 },
  { country: 'SÃ©nÃ©gal', iso2: 'SN', gender: 'FEMALE', count: 7 },
];

function makeGeo(props: any = {}) {
  return {
    pointToData: () => [120, 40],
    dataToPoint: () => [50, 60],
    getRoamTransform: () => [1, 0, 0, 1],
    getBoundingRect: () => ({ x: -50, y: -40, width: 100, height: 80 }),
    containPoint: () => true,
    ...props,
  };
}

function renderMap(
  c = countries,
  g = countryGender,
  labels = [{ iso2: 'FR', country: 'France' }, { iso2: 'SN', country: 'SÃ©nÃ©gal' }]
) {
  return render(
    <MemoryRouter initialEntries={['/map']}>
      <Routes>
        <Route
          path="/map"
          element={
            <WorldMapWidget
              distributionByCountry={c}
              distributionByCountryGender={g}
              countryLabels={labels}
            />
          }
        />
        <Route path="/contacts" element={<TestContacts />} />
      </Routes>
    </MemoryRouter>
  );
}

function TestContacts() {
  const location = useLocation();
  return <div>CONTACTS_PAGE:{JSON.stringify(location.state)}</div>;
}

function findClickHandler() {
  const call = mockChartOn.mock.calls.find((c) => c[0] === 'click');
  return call ? call[1] : null;
}

function findRoamHandler() {
  const call = mockChartOn.mock.calls.find(
    (c) => c[0] === 'georoam' || c[0] === 'geoRoam'
  );
  return call ? call[1] : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetModelReturn = null;
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => 800,
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 400,
  });
  HTMLElement.prototype.getBoundingClientRect = (() => ({
    left: 10,
    top: 20,
    width: 800,
    height: 400,
    right: 810,
    bottom: 420,
    x: 10,
    y: 20,
    toJSON: () => ({}),
  })) as any;
  (globalThis as any).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('WorldMapWidget behavior', () => {
  it('opens the popup with gender breakdown when clicking a recognized country', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({
        coordinateSystem: makeGeo(),
      }),
    };
    renderMap();
    const handler = findClickHandler();
    expect(handler).toBeTruthy();

    act(() => {
      handler({
        componentType: 'series',
        name: 'FR',
        event: { offsetX: 60, offsetY: 40 },
      });
    });

    // Pin + panel (portal) displayed with the country header and its ISO
    expect(screen.getAllByText(/France/).length).toBeGreaterThan(0);
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('35 % du total')).toBeInTheDocument();
    // Gender labels + counts from gender data for FR (15 M + 10 F)
    expect(screen.getByText('Homme')).toBeInTheDocument();
    expect(screen.getByText('Femme')).toBeInTheDocument();
  });

  it('does not open the popup for an unknown (no-iso2) country name', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({ coordinateSystem: makeGeo() }),
    };
    renderMap();
    const handler = findClickHandler();
    act(() => {
      handler({ componentType: 'series', name: 'XX', event: { offsetX: 10 } });
    });
    expect(screen.queryByText(/% du total/)).not.toBeInTheDocument();
  });

  it('closes the popup when clicking the Fermer button', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({ coordinateSystem: makeGeo() }),
    };
    renderMap();
    const handler = findClickHandler();
    act(() => {
      handler({ componentType: 'series', name: 'SN', event: { offsetX: 60, offsetY: 40 } });
    });
    expect(screen.getByText(/SÃ©nÃ©gal/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(screen.queryByText(/% du total/)).not.toBeInTheDocument();
  });

  it('closes the popup when clicking outside of the panel', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({ coordinateSystem: makeGeo() }),
    };
    renderMap();
    const handler = findClickHandler();
    act(() => {
      handler({ componentType: 'series', name: 'FR', event: { offsetX: 60, offsetY: 40 } });
    });
    expect(screen.getByText(/% du total/)).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(/% du total/)).not.toBeInTheDocument();
  });

  it('navigates to /contacts with country filter when opening contacts', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({ coordinateSystem: makeGeo() }),
    };
    renderMap();
    const handler = findClickHandler();
    act(() => {
      handler({ componentType: 'series', name: 'FR', event: { offsetX: 60, offsetY: 40 } });
    });
    fireEvent.click(screen.getByRole('button', { name: /voir les contacts/i }));
    expect(screen.getByText(/CONTACTS_PAGE/)).toBeInTheDocument();
    const state = JSON.parse(
      screen.getByText(/CONTACTS_PAGE/).textContent!.replace('CONTACTS_PAGE:', '')
    );
    expect(state.filters.countries).toEqual(['France']);
  });

  it('Recentrer button resets the map view to the default center and zoom', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({
        coordinateSystem: makeGeo({
          getBoundingRect: () => ({ x: -100, y: -80, width: 200, height: 160 }),
          pointToData: () => [50, 10],
          getRoamTransform: () => [3, 0, 0, 3],
          containPoint: () => true,
        }),
      }),
    };
    renderMap();
    const roam = findRoamHandler();
    expect(roam).toBeTruthy();

    // First georoam records the good view (defaultViewRef captured on init)
    act(() => {
      roam();
    });

    const setOptionCallsBefore = mockChartSetOption.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /recentrer la carte/i }));

    const resetCall = mockChartSetOption.mock.calls[setOptionCallsBefore];
    expect(resetCall).toBeTruthy();
    const seriesArg = resetCall[0].series[0];
    expect(seriesArg.type).toBe('map');
    expect(seriesArg.map).toBe('arsiiWorld');
    expect(seriesArg.zoom).toBe(1);
  });

  it('snaps back to the last good view when the map is panned too far', async () => {
    let series = {
      getSeriesByIndex: () => series,
    } as any;
    series.coordinateSystem = makeGeo({
      getBoundingRect: () => ({ x: -100, y: -80, width: 200, height: 160 }),
      pointToData: () => [50, 10],
      getRoamTransform: () => [1, 0, 0, 1],
      containPoint: () => true,
    });
    mockGetModelReturn = { getSeriesByIndex: () => series };
    renderMap();
    const roam = findRoamHandler();

    // 1st roam: centered and within bounds -> recorded as last good, no snap
    act(() => {
      roam();
    });

    const callsAfterGood = mockChartSetOption.mock.calls.length;

    // 2nd roam: far from the map region -> triggers snap-back setOption
    series.coordinateSystem = makeGeo({
      getBoundingRect: () => ({ x: -100, y: -80, width: 200, height: 160 }),
      pointToData: () => [300, 500],
      getRoamTransform: () => [1, 0, 0, 1],
      containPoint: () => true,
    });
    act(() => {
      roam();
    });
    const snapCalls = mockChartSetOption.mock.calls.slice(callsAfterGood);
    expect(snapCalls.length).toBeGreaterThan(0);
    expect(snapCalls[0][1]).toEqual({ notMerge: false });
  });

  it('includes a continuous visualMap scale matching the data', async () => {
    renderMap();
    await waitFor(() => expect(mockChartSetOption).toHaveBeenCalled());
    const option = mockChartSetOption.mock.calls[0][0];
    expect(option.series[0]).toMatchObject({
      roam: true,
    });
    // max derives from the highest country count in the fixture (France = 25)
    expect(option.visualMap).toMatchObject({
      type: 'continuous',
      min: 0,
      max: 25,
    });
  });

  it('tooltip formatter falls back to the country label and unknown value', async () => {
    renderMap();
    await waitFor(() => expect(mockChartSetOption).toHaveBeenCalled());
    const option = mockChartSetOption.mock.calls[0][0];
    const formatter = option.tooltip.formatter;
    const html = formatter({ name: 'SN', data: { country: 'SÃ©nÃ©gal', value: 15, percentage: 21 } });
    expect(html).toContain('SÃ©nÃ©gal');
    expect(html).toContain('15 chercheur');
    expect(html).toContain('21');
  });

  it('series data excludes countries without iso2 and aggregates counts by iso2', async () => {
    renderMap();
    await waitFor(() => expect(mockChartSetOption).toHaveBeenCalled());
    const option = mockChartSetOption.mock.calls[0][0];
    const names = option.series[0].data.map((d: any) => d.name);
    expect(names).toEqual(['FR', 'SN']);
    expect(names).not.toContain('Unknown');
  });

  it('projects the selected country pin via pointToData when a country is selected', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({
        coordinateSystem: makeGeo({ dataToPoint: () => [80, 100] }),
      }),
    };
    renderMap();
    const handler = findClickHandler();
    act(() => {
      handler({ componentType: 'series', name: 'FR', event: { offsetX: 60, offsetY: 40 } });
    });
    expect(mockChartGetModel).toHaveBeenCalled();
    expect(screen.getByText(/% du total/)).toBeInTheDocument();
  });

  it('clears the selected popup when its country disappears from data', async () => {
    mockGetModelReturn = {
      getSeriesByIndex: () => ({ coordinateSystem: makeGeo() }),
    };
    const { rerender } = renderMap();
    const handler = findClickHandler();
    act(() => {
      handler({ componentType: 'series', name: 'FR', event: { offsetX: 60, offsetY: 40 } });
    });
    expect(screen.getByText(/% du total/)).toBeInTheDocument();

    const remaining: WorldMapCountry[] = [
      { country: 'SÃ©nÃ©gal', iso2: 'SN', count: 15, percentage: 100 },
    ];
    rerender(
      <MemoryRouter initialEntries={['/map']}>
        <Routes>
          <Route
            path="/map"
            element={
              <WorldMapWidget
                distributionByCountry={remaining}
                distributionByCountryGender={countryGender}
                countryLabels={[{ iso2: 'SN', country: 'SÃ©nÃ©gal' }]}
              />
            }
          />
          <Route path="/contacts" element={<TestContacts />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.queryByText(/% du total/)).not.toBeInTheDocument();
  });

  it('registers and removes geoRoam and click listeners on mount/unmount', async () => {
    const { unmount } = renderMap();
    expect(mockChartOn).toHaveBeenCalledWith('click', expect.any(Function));
    expect(
      mockChartOn.mock.calls.some((c) => c[0] === 'georoam' || c[0] === 'geoRoam')
    ).toBe(true);
    unmount();
    expect(mockChartDispose).toHaveBeenCalled();
  });

  it('shows the unknown count only when countries lack an iso2', async () => {
    const mixed: WorldMapCountry[] = [
      { country: 'France', iso2: 'FR', count: 25, percentage: 50 },
      { country: 'A', iso2: null, count: 3, percentage: 6 },
      { country: 'B', iso2: null, count: 2, percentage: 4 },
    ];
    renderMap(mixed, []);
    expect(screen.getByText(/5 chercheurs non positionnables/)).toBeInTheDocument();
  });
});
