import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Contact, Tag, ResearchCareerStage, CAREER_STAGE_SHORT_LABELS, GENDER_LABELS } from '../types';
import {
  Users,
  Globe,
  Building2,
  GraduationCap,
  TrendingUp,
  Plus,
  Upload,
  ArrowRight,
  ExternalLink,
  Sliders,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  GripVertical,
  RotateCcw,
  Sparkles,
  Layers
} from 'lucide-react';
import { DashboardSkeleton } from './Skeletons';
import { Modal } from './Modal';
import { DistributionChart } from './DistributionChart';

interface DashboardViewProps {
  contacts: Contact[];
  tags: Tag[];
  onSelectContact: (contactId: string) => void;
  isLoading?: boolean;
}

export interface WidgetConfig {
  id: string;
  title: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'stats', title: 'Indicateurs clés (KPIs)', visible: true, order: 0 },
  { id: 'distributionChart', title: 'Distribution Pays & Genre', visible: true, order: 1 },
  { id: 'careerStage', title: 'Stades de carrière de recherche', visible: true, order: 2 },
  { id: 'topTags', title: 'Top Expertises & Tags', visible: true, order: 3 },
  { id: 'recentExchanges', title: 'Derniers Échanges R&I', visible: true, order: 4 },
];

const CAREER_STAGE_ORDER: ResearchCareerStage[] = [
  'R1_FIRST_STAGE',
  'R2_RECOGNIZED',
  'R3_ESTABLISHED',
  'R4_LEADING'
];

const CAREER_STAGE_COLORS: Record<ResearchCareerStage, string> = {
  R1_FIRST_STAGE: '#8A98A1',
  R2_RECOGNIZED: '#005596',
  R3_ESTABLISHED: '#B8167C',
  R4_LEADING: '#FFC20C'
};

const TAG_FALLBACK_COLORS = ['#005596', '#B8167C', '#FFC20C', '#35B8B2', '#8A98A1', '#1C2529', '#A67C00', '#D9E6F2'];

export const DashboardView: React.FC<DashboardViewProps> = ({
  contacts,
  tags,
  onSelectContact,
  isLoading = false
}) => {
  // Widget Layout State with persistence
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem('euraxess_dashboard_widgets');
      if (saved) {
        const parsed: WidgetConfig[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge with defaults: keep order/visibility, drop stale ids, restore missing defaults
          const savedMap = new Map(parsed.map((w, idx) => [w.id, { ...w, order: typeof w.order === 'number' ? w.order : idx }]));
          const merged = DEFAULT_WIDGETS.map(def => savedMap.get(def.id) || { ...def });
          const mergedIds = new Set(merged.map(w => w.id));
          savedMap.forEach((w, id) => {
            if (!mergedIds.has(id)) merged.push(w);
          });
          return merged.sort((a, b) => a.order - b.order);
        }
      }
    } catch (e) {
      // ignore
    }
    return DEFAULT_WIDGETS;
  });

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('euraxess_dashboard_widgets', JSON.stringify(widgets));
    } catch (e) {
      // ignore
    }
  }, [widgets]);

  // Drag and drop state
  const [draggedWidgetId, setDraggedWidgetId] = useState<string | null>(null);
  const [dragOverWidgetId, setDragOverWidgetId] = useState<string | null>(null);

  // Reorder Widget Up/Down
  const moveWidget = (id: string, direction: 'up' | 'down') => {
    const sorted = [...widgets].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(w => w.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    // Swap orders
    const tempOrder = sorted[index].order;
    sorted[index].order = sorted[targetIndex].order;
    sorted[targetIndex].order = tempOrder;

    setWidgets([...sorted]);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedWidgetId(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverWidgetId !== targetId) {
      setDragOverWidgetId(targetId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedWidgetId;
    if (!sourceId || sourceId === targetId) {
      setDraggedWidgetId(null);
      setDragOverWidgetId(null);
      return;
    }

    const currentList = [...widgets].sort((a, b) => a.order - b.order);
    const dragIdx = currentList.findIndex(w => w.id === sourceId);
    const dropIdx = currentList.findIndex(w => w.id === targetId);

    if (dragIdx !== -1 && dropIdx !== -1) {
      const [draggedItem] = currentList.splice(dragIdx, 1);
      currentList.splice(dropIdx, 0, draggedItem);

      // Re-assign order numbers sequentially
      const updated = currentList.map((item, idx) => ({
        ...item,
        order: idx
      }));

      setWidgets(updated);
    }

    setDraggedWidgetId(null);
    setDragOverWidgetId(null);
  };

  // Toggle Visibility
  const toggleVisibility = (id: string) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w));
  };

  // Reset Layout
  const handleResetLayout = () => {
    setWidgets(DEFAULT_WIDGETS);
  };

  // 1. KPIs
  const totalContacts = contacts.length;

  const countriesCovered = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.countryOfOrigin) set.add(c.countryOfOrigin.trim());
    });
    return set.size;
  }, [contacts]);

  const affiliationsCount = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.affiliation) set.add(c.affiliation.trim());
    });
    return set.size;
  }, [contacts]);

  const seniorResearchers = useMemo(() => {
    const count = contacts.filter(c =>
      c.researchCareerStage === 'R3_ESTABLISHED' || c.researchCareerStage === 'R4_LEADING'
    ).length;
    const percentage = contacts.length > 0 ? Math.round((count / contacts.length) * 100) : 0;
    return { count, percentage };
  }, [contacts]);

  // 2. Career stage distribution (R1-R4)
  const careerStageData = useMemo(() => {
    const counts: Record<ResearchCareerStage, number> = {
      R1_FIRST_STAGE: 0,
      R2_RECOGNIZED: 0,
      R3_ESTABLISHED: 0,
      R4_LEADING: 0
    };
    contacts.forEach(c => {
      if (counts[c.researchCareerStage] !== undefined) counts[c.researchCareerStage]++;
    });
    const total = contacts.length || 1;
    return CAREER_STAGE_ORDER.map(stage => ({
      stage,
      count: counts[stage],
      pct: Math.round((counts[stage] / total) * 100),
      color: CAREER_STAGE_COLORS[stage]
    }));
  }, [contacts]);

  // 3. Top tags (expertises & tags)
  const tagColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tags.forEach(t => { map[t.name.toLowerCase()] = t.color; });
    return map;
  }, [tags]);

  const topTagsData = useMemo(() => {
    const counts: Record<string, number> = {};
    contacts.forEach(c => {
      (c.tags || []).forEach(t => {
        const key = t.trim();
        if (key) counts[key] = (counts[key] || 0) + 1;
      });
    });
    const paletteIndex: Record<string, string> = {};
    return Object.entries(counts)
      .map(([name, count]) => {
        const lower = name.toLowerCase();
        if (paletteIndex[lower] === undefined) {
          paletteIndex[lower] = tagColorMap[lower] || TAG_FALLBACK_COLORS[Object.keys(paletteIndex).length % TAG_FALLBACK_COLORS.length];
        }
        return { name, count, color: paletteIndex[lower] };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [contacts, tagColorMap]);

  const maxTagCount = Math.max(...topTagsData.map(d => d.count), 1);

  // 4. Recent exchanges
  const recentExchanges = useMemo(() => {
    return contacts.flatMap(c =>
      c.exchangeNotes.map(n => ({
        ...n,
        contact: c
      }))
    ).slice(0, 6);
  }, [contacts]);

  // Get sorted visible widgets
  const orderedWidgets = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-8 space-y-8 animate-fade-in">

      {/* Action Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1C2529] tracking-tight flex items-center gap-3">
            Tableau de bord Innovation
          </h1>
          <p className="text-sm text-[#55636B] mt-1">
            Bienvenue, voici le récapitulatif dynamique de votre réseau R&I Europe-Afrique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="flex items-center gap-2 bg-[#E8F1F8] hover:bg-[#BCD7EE] text-[#005596] px-4 py-2.5 rounded-xl text-xs font-extrabold border border-[#C9D4DE]/50 shadow-xs transition-all active:scale-95"
          >
            <Sliders className="w-4 h-4" />
            Personnaliser la disposition
          </button>

          <Link
            to="/contacts/new"
            className="flex items-center gap-2 bg-[#005596] hover:bg-[#004275] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nouveau Contact
          </Link>

          <Link
            to="/import"
            className="flex items-center gap-2 bg-white border border-[#C9D4DE] text-[#005596] hover:bg-[#E8F1F8] px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Importer CSV
          </Link>
        </div>
      </div>

      {/* DYNAMIC REORDERABLE WIDGETS CONTAINER */}
      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
        {orderedWidgets.map(widget => {
          if (!widget.visible) return null;

          const isDraggingThis = draggedWidgetId === widget.id;
          const isDragOverThis = dragOverWidgetId === widget.id && !isDraggingThis;

          const dragProps = {
            draggable: true,
            onDragStart: (e: React.DragEvent) => handleDragStart(e, widget.id),
            onDragOver: (e: React.DragEvent) => handleDragOver(e, widget.id),
            onDragLeave: handleDragLeave,
            onDrop: (e: React.DragEvent) => handleDrop(e, widget.id),
          };

          const dragStyleClass = `transition-all duration-200 rounded-2xl ${
            isDraggingThis ? 'opacity-40 scale-[0.99] ring-2 ring-dashed ring-[#005596]' : ''
          } ${
            isDragOverThis ? 'ring-2 ring-[#005596] ring-offset-4' : ''
          }`;

          const widgetHeaderActions = (id: string) => (
            <div className="flex items-center gap-1">
              <button onClick={() => moveWidget(id, 'up')} className="p-1 hover:bg-slate-200 rounded" title="Monter"><MoveUp className="w-3.5 h-3.5 text-slate-500" /></button>
              <button onClick={() => moveWidget(id, 'down')} className="p-1 hover:bg-slate-200 rounded" title="Descendre"><MoveDown className="w-3.5 h-3.5 text-slate-500" /></button>
              <button onClick={() => toggleVisibility(id)} className="p-1 hover:bg-slate-200 rounded" title="Masquer"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>
          );

          if (widget.id === 'stats') {
            return (
              <div key="stats" {...dragProps} className={`space-y-3 ${dragStyleClass}`}>
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-2 hover:bg-white/60 rounded-lg transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <span>Métrique KPI Principales (Glisser-déposer pour déplacer)</span>
                  </div>
                  {widgetHeaderActions('stats')}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 flex flex-col justify-between h-40 hover:border-[#005596] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#005596]/10 rounded-xl text-[#005596]">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Actif
                      </span>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#1C2529]">{totalContacts}</h3>
                      <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mt-1">
                        TOTAL DES CONTACTS
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 flex flex-col justify-between h-40 hover:border-[#005596] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#BCD7EE]/40 rounded-xl text-[#004275]">
                        <Globe className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#1C2529]">{countriesCovered}</h3>
                      <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mt-1">
                        PAYS COUVERTS
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 flex flex-col justify-between h-40 hover:border-[#005596] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#FFC20C]/10 rounded-xl text-[#005596]">
                        <Building2 className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#1C2529]">{affiliationsCount}</h3>
                      <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mt-1">
                        AFFILIATIONS DISTINCTES
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 flex flex-col justify-between h-40 hover:border-[#005596] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#BCD7EE]/40 rounded-xl text-[#004275]">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <span className="text-[#004275] text-xs font-bold">{seniorResearchers.percentage}%</span>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#1C2529]">{seniorResearchers.count}</h3>
                      <p className="text-[11px] font-bold text-[#55636B] uppercase tracking-wider mt-1">
                        CHERCHEURS SENIORS (R3+)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (widget.id === 'distributionChart') {
            return (
              <div key="distributionChart" {...dragProps} className={`bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-bold text-[#1C2529]">Distribution par pays & genre</h3>
                  </div>
                  {widgetHeaderActions('distributionChart')}
                </div>
                <DistributionChart contacts={contacts} />
              </div>
            );
          }

          if (widget.id === 'careerStage') {
            return (
              <div key="careerStage" {...dragProps} className={`bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-bold text-[#1C2529]">Stades de carrière de recherche</h3>
                  </div>
                  {widgetHeaderActions('careerStage')}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-8">
                  <div className="relative w-48 h-48 shrink-0">
                    <div
                      className="w-48 h-48 rounded-full"
                      style={{
                        background: `conic-gradient(${careerStageData
                          .filter(d => d.count > 0)
                          .map((d, i, arr) => {
                            const start = arr.slice(0, i).reduce((s, x) => s + x.pct, 0);
                            return `${d.color} ${start}% ${start + d.pct}%`;
                          })
                          .join(', ') || '#E8F1F8 0% 100%'}`
                      }}
                    >
                      <div className="absolute inset-[34px] rounded-full bg-white flex flex-col items-center justify-center shadow-inner">
                        <span className="text-2xl font-black text-[#005596]">{contacts.length}</span>
                        <span className="text-[11px] font-semibold text-[#55636B]">Chercheurs</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 w-full space-y-2.5">
                    {careerStageData.map(d => (
                      <div key={d.stage} className="flex items-center gap-3">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="w-40 shrink-0 text-xs font-semibold text-[#1C2529]">
                          {CAREER_STAGE_SHORT_LABELS[d.stage]}
                        </span>
                        <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(d.pct, d.count > 0 ? 3 : 0)}%`, backgroundColor: d.color }} />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs font-bold text-[#55636B]">
                          {d.count} ({d.pct}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          if (widget.id === 'topTags') {
            return (
              <div key="topTags" {...dragProps} className={`bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-bold text-[#1C2529]">Top Expertises & Tags</h3>
                  </div>
                  {widgetHeaderActions('topTags')}
                </div>

                <div className="space-y-3">
                  {topTagsData.length === 0 && (
                    <p className="text-sm text-[#55636B] italic">Aucun tag attribué pour le moment.</p>
                  )}
                  {topTagsData.map(d => (
                    <div key={d.name} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 text-xs font-semibold text-[#55636B] truncate flex items-center gap-2" title={d.name}>
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        {d.name}
                      </span>
                      <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.max(Math.round((d.count / maxTagCount) * 100), d.count > 0 ? 3 : 0)}%`, backgroundColor: d.color }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-bold text-[#1C2529]">{d.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (widget.id === 'recentExchanges') {
            return (
              <div key="recentExchanges" {...dragProps} className={`bg-white p-4 sm:p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#C9D4DE]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                    <h3 className="text-base sm:text-lg font-bold text-[#1C2529]">Derniers Échanges R&I</h3>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
                    <Link
                      to="/contacts"
                      className="text-[#005596] font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Voir tout l'historique <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2 shrink-0">
                      <button onClick={() => moveWidget('recentExchanges', 'up')} className="p-1 hover:bg-slate-100 rounded cursor-pointer" title="Monter"><MoveUp className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => moveWidget('recentExchanges', 'down')} className="p-1 hover:bg-slate-100 rounded cursor-pointer" title="Descendre"><MoveDown className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => toggleVisibility('recentExchanges')} className="p-1 hover:bg-slate-100 rounded cursor-pointer" title="Masquer"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></button>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-[#C9D4DE]/30 text-[11px] font-bold text-[#55636B] uppercase tracking-wider">
                        <th className="py-3 px-2 min-w-[160px]">CONTACT</th>
                        <th className="py-3 px-2 min-w-[100px]">DATE</th>
                        <th className="py-3 px-2 min-w-[200px]">NOTE</th>
                        <th className="py-3 px-2 min-w-[130px]">PROJET</th>
                        <th className="py-3 px-2 text-right min-w-[80px]">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#C9D4DE]/10 text-xs">
                      {recentExchanges.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => onSelectContact(item.contact.id)}
                          className="hover:bg-[#E8F1F8]/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#BCD7EE] text-[#005596] font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                                {item.contact.avatarUrl ? (
                                  <img src={item.contact.avatarUrl} alt={item.contact.name || `${item.contact.firstName} ${item.contact.lastName}`} className="w-full h-full object-cover" />
                                ) : (
                                  item.contact.initials || `${item.contact.firstName[0] || ''}${item.contact.lastName[0] || ''}`.toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#1C2529] truncate">{item.contact.name || `${item.contact.firstName} ${item.contact.lastName}`}</p>
                                <p className="text-[11px] text-[#55636B] truncate">{item.contact.affiliation}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-[#1C2529] font-medium whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-3.5 px-2 text-[#55636B] max-w-xs truncate">
                            {item.content}
                          </td>
                          <td className="py-3.5 px-2">
                            {item.projectName ? (
                              <span className="inline-block bg-[#FFC20C]/10 text-[#005596] text-[11px] font-bold px-2.5 py-1 rounded-full truncate max-w-[140px]" title={item.projectName}>
                                {item.projectName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-2 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => onSelectContact(item.contact.id)}
                                className="p-1.5 text-slate-500 hover:text-[#005596] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Voir le contact"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }

          return null;
        })}
      </div>
      )}

      {/* DASHBOARD CUSTOMIZATION MODAL */}
      {isCustomizeModalOpen && (
        <Modal
          open={isCustomizeModalOpen}
          onClose={() => setIsCustomizeModalOpen(false)}
          maxWidth="max-w-lg"
          title={
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-[#005596]" />
              <h3 className="font-extrabold text-base text-[#1C2529]">
                Personnaliser le Tableau de Bord
              </h3>
            </div>
          }
        >
          <p className="text-xs text-slate-600 mb-4">
            Activez, masquez ou réorganisez l'ordre d'affichage des modules de votre tableau de bord.
          </p>

            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {orderedWidgets.map((w, index) => (
                <div
                  key={w.id}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, w.id)}
                  onDragOver={(e) => handleDragOver(e, w.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, w.id)}
                  className={`flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold cursor-grab active:cursor-grabbing transition-all ${
                    draggedWidgetId === w.id ? 'opacity-40 border-dashed border-[#005596]' : ''
                  } ${
                    dragOverWidgetId === w.id && draggedWidgetId !== w.id ? 'ring-2 ring-[#005596]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <span className="text-[#1C2529]">{w.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => moveWidget(w.id, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                      title="Monter"
                    >
                      <MoveUp className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => moveWidget(w.id, 'down')}
                      disabled={index === orderedWidgets.length - 1}
                      className="p-1 hover:bg-slate-200 rounded disabled:opacity-30"
                      title="Descendre"
                    >
                      <MoveDown className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      onClick={() => toggleVisibility(w.id)}
                      className={`p-1.5 rounded transition-colors ${
                        w.visible ? 'bg-[#005596] text-white' : 'bg-slate-200 text-slate-500'
                      }`}
                      title={w.visible ? 'Masquer' : 'Afficher'}
                    >
                      {w.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <button
                onClick={handleResetLayout}
                className="text-xs text-slate-500 hover:text-[#005596] font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser la disposition
              </button>

              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="px-5 py-2.5 bg-[#005596] hover:bg-[#004275] text-white font-bold text-xs rounded-xl shadow"
              >
                Terminer
              </button>
            </div>
        </Modal>
      )}

    </div>
  );
};
