import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { init, use, registerMap } from 'echarts/core';
import { MapChart } from 'echarts/charts';
import { TooltipComponent, VisualMapComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { ComposeOption } from 'echarts/core';
import type { MapSeriesOption } from 'echarts/charts';
import type { TooltipComponentOption, VisualMapComponentOption } from 'echarts/components';
import { Gender, GENDER_LABELS, FilterState } from '../types';
import { Crosshair, ExternalLink, Globe, MapPin, Users, X } from 'lucide-react';
import worldGeo from '../assets/maps/world.json';

use([MapChart, TooltipComponent, VisualMapComponent, CanvasRenderer]);
registerMap('arsiiWorld', worldGeo as any);

type ECOption = ComposeOption<
  MapSeriesOption | TooltipComponentOption | VisualMapComponentOption
>;

export interface WorldMapCountry {
  country: string;
  iso2: string | null;
  count: number;
  percentage: number;
}

export interface WorldMapCountryGender {
  country: string;
  iso2: string | null;
  gender: string;
  count: number;
}

interface WorldMapWidgetProps {
  distributionByCountry: WorldMapCountry[];
  distributionByCountryGender: WorldMapCountryGender[];
  countryLabels?: { iso2: string; country: string }[];
}

interface SelectedCountry {
  country: string;
  iso2: string;
  count: number;
  percentage: number;
  genders: Record<Gender, number>;
}

type ViewState = { center: [number, number]; zoom: number };

const GENDER_COLORS: Record<Gender, string> = {
  FEMALE: '#B8167C',
  MALE: '#005596',
  NOT_SPECIFIED: '#8A98A1'
};

const GENDERS: Gender[] = ['FEMALE', 'MALE', 'NOT_SPECIFIED'];

// Dimensions du pin + du panneau (rendus en overlay fixe, coordonnées écran).
const PANEL_W = 304;
const PANEL_H = 308;
const PIN_Y_OFFSET = 24; // hauteur de l'icône MapPin (pointe en bas)
const TAIL = 16;         // taille du losange de liaison
const GAP = 22;          // espace pin → panneau

type PanelMode = 'above' | 'below' | 'side' | 'over';

interface PanelLayout {
  mode: PanelMode;
  placeRight: boolean;
  left: number;
  top: number;
}

// Calcul du placement du panneau : au-dessus du pin si la place y est, en dessous
// sinon, à côté du pays (pin visible) si aucun des deux côtés verticaux ne tient,
// et enfin « recouvrant » uniquement si la carte est trop étroite pour le latéral.
// Dans tous les cas le panneau reste clampé aux bords de la carte (même en recouvrant).
function computePanelLayout(
  anchor: { x: number; y: number } | null,
  mapLeft: number,
  mapTop: number,
  mapW: number,
  mapH: number,
  panelW: number
): PanelLayout {
  const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(hi, lo));
  const minX = mapLeft + 8;
  const maxX = Math.max(mapLeft + mapW - panelW - 8, minX);
  const minY = mapTop + 8;
  const maxY = Math.max(mapTop + mapH - PANEL_H - 8, minY);
  if (!anchor) {
    return { mode: 'over', placeRight: true, left: minX, top: minY };
  }
  const fitsAbove = anchor.y - PANEL_H - GAP >= minY;
  const fitsBelow = anchor.y + GAP + PANEL_H <= maxY;
  let mode: PanelMode = 'over';
  let placeRight = true;
  let panelLeft = minX;
  let panelTop = minY;
  if (fitsAbove) {
    mode = 'above';
    panelLeft = clamp(anchor.x - panelW / 2, minX, maxX);
    panelTop = clamp(anchor.y - GAP - PANEL_H, minY, maxY);
  } else if (fitsBelow) {
    mode = 'below';
    panelLeft = clamp(anchor.x - panelW / 2, minX, maxX);
    panelTop = clamp(anchor.y + GAP, minY, maxY);
  } else {
    // Latéral : panneau à droite du pays (à gauche sinon), pin toujours visible.
    placeRight = anchor.x < mapLeft + mapW / 2;
    panelTop = clamp(anchor.y - PANEL_H / 2, minY, maxY);
    panelLeft = clamp(placeRight ? anchor.x + GAP : anchor.x - GAP - panelW, minX, maxX);
    const coversPin = placeRight
      ? panelLeft <= anchor.x + 12
      : anchor.x - 12 <= panelLeft + panelW;
    if (coversPin) {
      // Carte trop étroite : repli « recouvrant » (le panneau masque le pin).
      mode = 'over';
      panelLeft = clamp(anchor.x - panelW / 2, minX, maxX);
      panelTop = clamp(anchor.y - PANEL_H / 2, minY, maxY);
    } else {
      mode = 'side';
    }
  }
  return { mode, placeRight, left: panelLeft, top: panelTop };
}

// Points de référence des régions habitées (lon, lat) : utilisés pour détecter
// qu'on s'est éloigné de la carte (ex. pan jusqu'à l'océan ou dans le vide).
const MAP_ANCHORS: [number, number][] = [
  [-99, 40], [-99, 18], [-70, -14],
  [10, 50], [20, 42], [3, 35], [20, 8], [30, -10], [35, -22],
  [60, 35], [90, 25], [110, 20], [100, -5], [135, 35], [140, -25]
];

function toGender(value?: string): Gender {
  return value === 'MALE' ? 'MALE' : value === 'FEMALE' ? 'FEMALE' : 'NOT_SPECIFIED';
}

function getSeriesGeo(chart: any): any {
  return chart?.getModel?.()?.getSeriesByIndex(0)?.coordinateSystem ?? null;
}

// Projette un point géographique (lon, lat) vers les pixels du canvas.
// Retourne `null` quand le point est hors de la vue (pays panoramé hors écran).
function projectGeo(
  lng: number,
  lat: number,
  geo: any,
  w: number,
  h: number
): { x: number; y: number } | null {
  if (!geo?.dataToPoint || !w || !h) return null;
  const pt = geo.dataToPoint([lng, lat]);
  if (!Array.isArray(pt) || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) return null;
  const x = pt[0];
  const y = pt[1];
  if (x < -12 || x > w + 12 || y < -12 || y > h + 12) return null;
  return { x, y };
}

function chercheurs(count: number): string {
  return `${count} chercheur${count > 1 ? 's' : ''}`;
}

export const WorldMapWidget: React.FC<WorldMapWidgetProps> = ({
  distributionByCountry,
  distributionByCountryGender,
  countryLabels = []
}) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof init> | null>(null);
  const [selected, setSelected] = useState<SelectedCountry | null>(null);
  const [anchorGeo, setAnchorGeo] = useState<{ lng: number; lat: number } | null>(null);
  const [anchorPx, setAnchorPx] = useState<{ x: number; y: number } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // État de déplacement de la carte : vue par défaut + dernière vue valide.
  const defaultViewRef = useRef<ViewState | null>(null);
  const lastGoodRef = useRef<ViewState | null>(null);
  const snappedRef = useRef(false);

  // Indexe les effectifs par pays (clé ISO) pour le coloriage + le tooltip.
  const byIso2 = useMemo(() => {
    return new Map(
      distributionByCountry
        .filter(c => c.iso2)
        .map(c => [c.iso2 as string, c])
    );
  }, [distributionByCountry]);

  // Indexe la répartition par genre (clé ISO) pour la popup de détail.
  const gendersByIso2 = useMemo(() => {
    const map = new Map<string, Record<Gender, number>>();
    distributionByCountryGender.forEach(g => {
      if (!g.iso2) return;
      const rec = map.get(g.iso2) || { FEMALE: 0, MALE: 0, NOT_SPECIFIED: 0 };
      rec[toGender(g.gender)] += g.count;
      map.set(g.iso2, rec);
    });
    return map;
  }, [distributionByCountryGender]);

  const mapData = useMemo(() => {
    return [...byIso2.entries()].map(([iso2, c]) => ({
      name: iso2,
      value: c.count,
      country: c.country,
      percentage: c.percentage
    }));
  }, [byIso2]);

  const unknownCount = useMemo(() => {
    return distributionByCountry
      .filter(c => !c.iso2)
      .reduce((sum, c) => sum + c.count, 0);
  }, [distributionByCountry]);

  // ISO2 → libellé français pour tous les pays du glossaire (pays sans contact inclus)
  const labelByIso2 = useMemo(() => {
    return new Map(countryLabels.map(l => [l.iso2, l.country]));
  }, [countryLabels]);

  const maxValue = mapData.reduce((max, d) => Math.max(max, d.value), 0);

  // Initialise le graphique ECharts une seule fois.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = init(el, undefined, { renderer: 'canvas' });
    chartRef.current = chart;
    let raf = 0;
    const resizeObserver = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => chart.resize());
    });
    resizeObserver.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  // Met à jour l'option (données + interceptions au clic) à chaque changement de données.
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const option: ECOption = {
      tooltip: {
        trigger: 'item',
        confine: true,
        backgroundColor: '#1C2529',
        borderWidth: 0,
        textStyle: { color: '#FFFFFF', fontSize: 12 },
        formatter: (params: any) => {
          const iso2 = String(params?.name ?? '');
          const d = params?.data;
          const label = d?.country || labelByIso2.get(iso2) || iso2;
          const value = d?.value ?? 0;
          const pct = d?.percentage ?? 0;
          return `<b>${label}</b><br/>${chercheurs(value)} (${pct}%)`;
        }
      },
      visualMap: {
        type: 'continuous',
        min: 0,
        max: Math.max(maxValue, 1),
        left: 12,
        bottom: 12,
        itemWidth: 12,
        itemHeight: 90,
        calculable: false,
        inRange: { color: ['#E8F1F8', '#BCD7EE', '#86B6D9', '#005596'] },
        textStyle: { color: '#55636B', fontSize: 10 }
      },
      series: [
        {
          name: 'Chercheurs',
          type: 'map',
          map: 'arsiiWorld',
          roam: true,
          scaleLimit: { min: 1, max: 8 },
          label: { show: false },
          select: { disabled: true },
          itemStyle: {
            areaColor: '#EDF1F4',
            borderColor: '#C9D4DE',
            borderWidth: 0.6
          },
          emphasis: {
            label: { show: false },
            itemStyle: { areaColor: '#FFC20C' }
          },
          data: mapData
        }
      ]
    };

    chart.setOption(option, true);

    // Conserve la vue de l'utilisateur (déplacement/zoom) lors d'un rafraîchissement.
    const last = lastGoodRef.current;
    const def = defaultViewRef.current;
    if (
      last && def &&
      (last.zoom !== def.zoom || last.center[0] !== def.center[0] || last.center[1] !== def.center[1])
    ) {
      chart.setOption(
        { series: [{ type: 'map', map: 'arsiiWorld', center: last.center, zoom: last.zoom }] },
        { notMerge: false }
      );
    }

    const handleClick = (params: any) => {
      if (!params || params.componentType !== 'series' || !params.name) return;
      const entry = byIso2.get(String(params.name));
      if (!entry) return;

      // Point géographique cliqué : c'est l'ancre du pin, qui restera sur le
      // pays pendant les déplacements/zooms de la carte.
      const container = containerRef.current;
      const rect = container?.getBoundingClientRect();
      const offsetX =
        typeof params.event?.offsetX === 'number'
          ? params.event.offsetX
          : (params.event?.clientX ?? 0) - (rect?.left ?? 0);
      const offsetY =
        typeof params.event?.offsetY === 'number'
          ? params.event.offsetY
          : (params.event?.clientY ?? 0) - (rect?.top ?? 0);
      const geo = getSeriesGeo(chart);
      const gpt = geo?.pointToData?.([offsetX, offsetY]);
      if (geo && Array.isArray(gpt) && Number.isFinite(gpt[0]) && Number.isFinite(gpt[1])) {
        setAnchorGeo({ lng: gpt[0], lat: gpt[1] });
      } else {
        setAnchorGeo(null);
      }
      setSelected({
        country: entry.country,
        iso2: entry.iso2 as string,
        count: entry.count,
        percentage: entry.percentage,
        genders: gendersByIso2.get(entry.iso2 as string) || { FEMALE: 0, MALE: 0, NOT_SPECIFIED: 0 }
      });
    };

    chart.on('click', handleClick);
    return () => {
      chart.off('click', handleClick);
    };
  }, [byIso2, gendersByIso2, mapData, maxValue, labelByIso2]);

  // Nettoie la popup si le pays sélectionné disparaît des données (rafraîchissement).
  useEffect(() => {
    if (selected && !byIso2.has(selected.iso2)) {
      setSelected(null);
      setAnchorGeo(null);
    }
  }, [selected, byIso2]);

  // Fermeture au clic à l'extérieur du panneau (y compris ailleurs sur la carte :
  // le `click` ECharts sur un autre pays rouvre la popup avec le nouveau pays).
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelected(null);
        setAnchorGeo(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  // Déplacement borné de la carte : on surveille `geoRoam` et on revient en
  // douceur dès qu'on s'écarte trop loin (plus de « carte perdue jusqu'au refresh »).
  useEffect(() => {
    const chart = chartRef.current;
    const container = containerRef.current;
    if (!chart || !container) return;

    const getGeo = (): any => (chart as any)?.getModel?.()?.getSeriesByIndex(0)?.coordinateSystem ?? null;

    const readDefault = (geo: any): ViewState | null => {
      const rect = geo?.getBoundingRect?.();
      if (!rect || typeof rect.x !== 'number') return null;
      return { center: [rect.x + rect.width / 2, rect.y + rect.height / 2], zoom: 1 };
    };

    const readCurrent = (geo: any): ViewState | null => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;
      const pt = geo?.pointToData?.([w / 2, h / 2]);
      const mat = geo?.getRoamTransform?.();
      const scale = mat && mat.length >= 2 ? Math.hypot(mat[0] || 0, mat[1] || 0) : 1;
      return {
        center: [
          Array.isArray(pt) && Number.isFinite(pt[0]) ? pt[0] : 0,
          Array.isArray(pt) && Number.isFinite(pt[1]) ? pt[1] : 0
        ],
        zoom: Number.isFinite(scale) && scale > 0 ? scale : 1
      };
    };

    const geo = getGeo();
    if (geo) defaultViewRef.current = defaultViewRef.current ?? readDefault(geo);

    const onRoam = () => {
      if (snappedRef.current) return;
      const g = getGeo();
      if (!g) return;
      const state = readCurrent(g);
      if (!state) return;

      const rect = g.getBoundingRect();
      if (!rect || typeof rect.x !== 'number') return;
      const halfW = Math.max(rect.width / 2, 1e-6);
      const halfH = Math.max(rect.height / 2, 1e-6);
      const margin = state.zoom > 4.5 ? 30 / state.zoom : 18 / state.zoom;
      const outOfLng = Math.abs(state.center[0] - (rect.x + rect.width / 2)) > halfW + margin;
      const outOfLat = Math.abs(state.center[1] - (rect.y + rect.height / 2)) > halfH + margin;

      let lost = outOfLng || outOfLat;

      if (!lost && state.zoom <= 4.5 && typeof g.containPoint === 'function') {
        // Le centre reste dans la carte : on exige qu'au moins un point de
        // référence (continents + voisinage du centre) soit encore visible.
        const probes: [number, number][] = [
          ...MAP_ANCHORS,
          [state.center[0] + 16, state.center[1]],
          [state.center[0] - 16, state.center[1]],
          [state.center[0], state.center[1] + 16],
          [state.center[0], state.center[1] - 16]
        ];
        lost = !probes.some(p => g.containPoint(p));
      }

      if (!lost) {
        lastGoodRef.current = state;
        return;
      }

      // Trop loin : retour en douceur vers la dernière vue valide (ou la vue par défaut).
      const target = lastGoodRef.current ?? defaultViewRef.current ?? state;
      snappedRef.current = true;
      window.setTimeout(() => { snappedRef.current = false; }, 500);
      chart.setOption(
        { series: [{ type: 'map', map: 'arsiiWorld', center: target.center, zoom: target.zoom }] },
        { notMerge: false }
      );
      requestAnimationFrame(() => reprojectRef.current?.());
    };

    chart.on('geoRoam', onRoam);
    chart.on('georoam', onRoam);
    return () => {
      chart.off('geoRoam', onRoam);
      chart.off('georoam', onRoam);
    };
  }, []);

  // Bouton « Recentrer » : retour immédiat à la vue par défaut.
  const resetView = () => {
    const chart = chartRef.current;
    const target = defaultViewRef.current;
    if (!chart || !target) return;
    snappedRef.current = true;
    window.setTimeout(() => { snappedRef.current = false; }, 500);
    chart.setOption(
      { series: [{ type: 'map', map: 'arsiiWorld', center: target.center, zoom: target.zoom }] },
      { notMerge: false }
    );
    requestAnimationFrame(() => reprojectRef.current?.());
  };

  // Re-projection du pin : l'ancre est géographique, on recalcule sa position en
  // pixels à chaque déplacement (geoRoam), redimensionnement, reset, ou snap-back.
  const reprojectRef = useRef<() => void>(() => {});
  const reproject = useCallback(() => {
    const geo = getSeriesGeo(chartRef.current);
    const container = containerRef.current;
    if (!geo || !container || !anchorGeo) {
      setAnchorPx(null);
      return;
    }
    setAnchorPx(
      projectGeo(anchorGeo.lng, anchorGeo.lat, geo, container.clientWidth, container.clientHeight)
    );
  }, [anchorGeo]);

  useEffect(() => {
    reprojectRef.current = reproject;
  }, [reproject]);

  useEffect(() => {
    const chart = chartRef.current;
    const el = containerRef.current;
    const update = () => reprojectRef.current?.();
    chart?.on('geoRoam', update);
    chart?.on('georoam', update);
    window.addEventListener('resize', update);
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      chart?.off('geoRoam', update);
      chart?.off('georoam', update);
      window.removeEventListener('resize', update);
      ro?.disconnect();
    };
  }, []);

  useEffect(() => {
    reprojectRef.current?.();
  }, [anchorGeo]);

  // Position à l'écran de la carte : les overlay pin/panneau sont rendus en fixe
  // et ancrés dessus, donc on re-suit le rect à chaque scroll/redimensionnement.
  const [viewRect, setViewRect] = useState({ left: 0, top: 0, width: 0, height: 0 });
  useEffect(() => {
    const update = () => {
      const r = containerRef.current?.getBoundingClientRect();
      if (r) setViewRect({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('scroll', update, true);
    const el = containerRef.current;
    let ro: ResizeObserver | null = null;
    if (el) {
      ro = new ResizeObserver(update);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', update);
      document.removeEventListener('scroll', update, true);
      ro?.disconnect();
    };
  }, []);

  const openContacts = () => {
    if (!selected) return;
    const filters: FilterState = {
      search: '',
      countries: [selected.country],
      genders: [],
      careerStages: [],
      tags: []
    };
    setSelected(null);
    setAnchorGeo(null);
    navigate('/contacts', { state: { filters } });
  };

  const closePopup = () => {
    setSelected(null);
    setAnchorGeo(null);
  };

  // Positionnement en coordonnées-écran : le pin + le panneau sont rendus en
  // overlay fixe (portail), clampés aux bords de la carte — le panneau reste
  // dans le cadre du widget même quand il la recouvre.
  const mapLeft = viewRect.left;
  const mapTop = viewRect.top;
  const mapW = viewRect.width;
  const mapH = viewRect.height;
  const panelW = mapW ? Math.min(PANEL_W, mapW - 16) : PANEL_W;
  const pin = anchorPx && mapW ? { x: mapLeft + anchorPx.x, y: mapTop + anchorPx.y } : null;
  const anchor = pin;
  const { mode, placeRight, left: panelLeft, top: panelTop } = computePanelLayout(anchor, mapLeft, mapTop, mapW, mapH, panelW);
  // Queue pointant vers le pin : verticale en modes above/below, horizontale en mode side.
  const tailPos = !anchor
    ? null
    : mode === 'above'
      ? { left: anchor.x - panelLeft - TAIL / 2, top: PANEL_H - 8, cls: 'bg-slate-50' }
      : mode === 'below'
        ? { left: anchor.x - panelLeft - TAIL / 2, top: -8, cls: 'bg-[#005596]' }
        : mode === 'side'
          ? placeRight
            ? { left: -8, top: anchor.y - panelTop - TAIL / 2, cls: 'bg-white' }
            : { left: panelW - 8, top: anchor.y - panelTop - TAIL / 2, cls: 'bg-white' }
          : null;

  return (
    <div className="relative space-y-3">
      <button
        onClick={resetView}
        data-map-pan="1"
        className="absolute top-2 right-2 z-10 flex items-center gap-1.5 bg-white/95 hover:bg-white text-[#005596] text-[11px] font-bold px-2.5 py-1.5 rounded-full shadow border border-slate-200 transition-all active:scale-95"
        title="Recentrer la carte"
        aria-label="Recentrer la carte"
      >
        <Crosshair className="w-3.5 h-3.5" />
        Recentrer
      </button>

      <div
        ref={containerRef}
        data-map-pan="1"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="h-[360px] sm:h-[440px] w-full touch-auto"
        role="img"
        aria-label="Carte mondiale des chercheurs par pays d'origine"
      />

      {mapData.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Globe className="w-10 h-10 text-slate-300" />
          <p className="text-sm text-[#55636B] italic">
            Aucune donnée géographique disponible pour le moment.
          </p>
        </div>
      )}

      {(unknownCount > 0 || mapData.length > 0) && (
        <p className="text-[11px] text-[#55636B]">
          Survolez un pays pour le détail, cliquez pour ouvrir la répartition par genre.
          {unknownCount > 0 && (
            <span className="text-slate-400"> · {chercheurs(unknownCount)} non positionnables (pays non reconnu)</span>
          )}
        </p>
      )}

      {selected && anchor && createPortal(
        <>
          {/* Pin (overlay fixe, re-projeté sur le pays à chaque déplacement/zoom) */}
          {mode !== 'over' && (
            <div
              className="fixed z-[60] pointer-events-none animate-in zoom-in-95 fade-in duration-150"
              style={{ left: anchor.x - 12, top: anchor.y - PIN_Y_OFFSET }}
              aria-hidden="true"
            >
              <MapPin
                className="w-6 h-6 text-[#005596] drop-shadow-[0_5px_6px_rgba(0,0,0,0.4)]"
                fill="#005596"
                stroke="white"
                strokeWidth={2}
              />
            </div>
          )}

          {/* Panneau « 3D » flottant, relié au pin par une queue (clampé à la fenêtre) */}
          <div
            ref={popupRef}
            className="fixed z-[60] bg-gradient-to-b from-white to-slate-50 rounded-2xl border border-slate-200 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.45),0_10px_24px_-12px_rgba(0,0,0,0.3),0_2px_6px_rgba(0,0,0,0.12)] animate-in zoom-in-95 fade-in duration-200"
            style={{ left: panelLeft, top: panelTop, width: panelW }}
          >
            {/* Queue pointant vers le pin */}
            {tailPos && (
              <div
                className={`absolute w-4 h-4 rotate-45 ${tailPos.cls}`}
                style={{ left: tailPos.left, top: tailPos.top }}
                aria-hidden="true"
              />
            )}

            {/* En-tête dégradé (bandeau R&I) */}
            <div className="relative z-10 flex items-center gap-2 bg-gradient-to-r from-[#005596] to-[#B8167C] rounded-t-2xl px-4 py-2.5">
              <Users className="w-4 h-4 shrink-0 text-white" />
              <h3 className="flex-1 font-extrabold text-sm text-white truncate">
                {selected.country} <span className="font-semibold text-white/70 text-xs">({selected.iso2})</span>
              </h3>
              <button
                onClick={closePopup}
                className="shrink-0 p-1 rounded-md text-white/80 hover:bg-white/15 hover:text-white transition-colors"
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corps */}
            <div className="px-4 py-3 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#1C2529]">{selected.count}</span>
                <span className="text-[10px] font-bold text-[#55636B] uppercase tracking-wider">
                  chercheurs
                </span>
                <span className="ml-auto text-[10px] font-bold text-[#005596]">
                  {selected.percentage} % du total
                </span>
              </div>

              <div className="space-y-2.5">
                {GENDERS.map(g => {
                  const value = selected.genders[g];
                  const total = Math.max(selected.count, 1);
                  return (
                    <div key={g} className="flex items-center gap-2.5">
                      <span className="w-24 shrink-0 text-[10px] font-semibold text-[#1C2529] truncate">{GENDER_LABELS[g]}</span>
                      <div className="flex-1 h-3.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.round((value / total) * 100)}%`, backgroundColor: GENDER_COLORS[g] }}
                        />
                      </div>
                      <span className="w-9 shrink-0 text-right text-[11px] font-bold text-[#55636B]">{value}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={openContacts}
                className="w-full flex items-center justify-center gap-1.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-[11px] px-3 py-2 rounded-xl shadow transition-all active:scale-95"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Voir les contacts ({chercheurs(selected.count)})
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};