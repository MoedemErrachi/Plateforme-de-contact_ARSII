import React, { useState, useEffect, useMemo } from 'react';
import { ViewPage, Contact } from '../types';
import { 
  Users, 
  Globe, 
  FlaskConical, 
  Zap, 
  TrendingUp, 
  Plus, 
  Upload, 
  Download, 
  ExternalLink,
  ChevronDown,
  ArrowRight,
  Sliders,
  Eye,
  EyeOff,
  MoveUp,
  MoveDown,
  GripVertical,
  RotateCcw,
  X,
  Sparkles,
  Layers
} from 'lucide-react';
import { DashboardSkeleton } from './Skeletons';

interface DashboardViewProps {
  contacts: Contact[];
  onNavigate: (page: ViewPage) => void;
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
  { id: 'countryChart', title: 'Distribution par pays (Barres)', visible: true, order: 1 },
  { id: 'actorChart', title: 'Type d\'Acteur (Répartition)', visible: true, order: 2 },
  { id: 'growthChart', title: 'Aperçu de la Croissance', visible: true, order: 3 },
  { id: 'recentExchanges', title: 'Derniers Échanges R&I', visible: true, order: 4 },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  contacts,
  onNavigate,
  onSelectContact,
  isLoading = false
}) => {
  const [chartFilter, setChartFilter] = useState("Siège vs Zone d'action");
  const [timeRange, setTimeRange] = useState<'6M' | '1Y'>('6M');

  // Widget Layout State with persistence
  const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
    try {
      const saved = localStorage.getItem('arsii_dashboard_widgets');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return DEFAULT_WIDGETS;
  });

  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('arsii_dashboard_widgets', JSON.stringify(widgets));
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

  // 1. Calculate Unique Partner Countries from headquarters and intervention zones
  const partnerCountriesCount = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach(c => {
      if (c.country) set.add(c.country);
      c.interventionZones?.forEach(z => set.add(z));
    });
    return set.size;
  }, [contacts]);

  // 2. Calculate Active R&I Projects from contacts
  const activeProjectsCount = useMemo(() => {
    const projectSet = new Set<string>();
    contacts.forEach(c => {
      c.projects?.forEach(p => {
        if (p.status === 'En cours') {
          projectSet.add(p.id || p.title);
        }
      });
    });
    return projectSet.size;
  }, [contacts]);

  // 3. Calculate Top Sector & Percentage from contacts projects & expertise
  const topSectorInfo = useMemo(() => {
    const sectorCounts: Record<string, number> = {};
    let totalOccurrences = 0;
    contacts.forEach(c => {
      c.projects?.forEach(p => {
        if (p.sector) {
          sectorCounts[p.sector] = (sectorCounts[p.sector] || 0) + 1;
          totalOccurrences++;
        }
      });
      c.expertise?.forEach(exp => {
        sectorCounts[exp] = (sectorCounts[exp] || 0) + 1;
        totalOccurrences++;
      });
    });
    let topName = 'Santé & Biotech';
    let topCount = 0;
    Object.entries(sectorCounts).forEach(([sec, cnt]) => {
      if (cnt > topCount) {
        topCount = cnt;
        topName = sec;
      }
    });
    const percentage = totalOccurrences > 0 ? Math.round((topCount / totalOccurrences) * 100) : 0;
    return { name: topName, percentage };
  }, [contacts]);

  // 4. Country Bar Chart Data (dynamically aggregated)
  const countryData = useMemo(() => {
    const hqMap: Record<string, number> = {};
    const zoneMap: Record<string, number> = {};

    contacts.forEach(c => {
      if (c.country) {
        hqMap[c.country] = (hqMap[c.country] || 0) + 1;
      }
      c.interventionZones?.forEach(z => {
        zoneMap[z] = (zoneMap[z] || 0) + 1;
      });
    });

    const allCountries = Array.from(new Set([...Object.keys(hqMap), ...Object.keys(zoneMap)]));
    allCountries.sort((a, b) => ((hqMap[b] || 0) + (zoneMap[b] || 0)) - ((hqMap[a] || 0) + (zoneMap[a] || 0)));

    const top5 = allCountries.length > 0 ? allCountries.slice(0, 5) : ['Tunisie', 'France', 'Sénégal', 'Maroc', 'Kenya'];
    const maxVal = Math.max(...top5.map(c => Math.max(hqMap[c] || 0, zoneMap[c] || 0)), 1);

    return top5.map(country => {
      const hq = hqMap[country] || 0;
      const zone = zoneMap[country] || 0;
      return {
        country,
        hqCount: hq,
        zoneCount: zone,
        hqPct: Math.round((hq / maxVal) * 100) || 10,
        zonePct: Math.round((zone / maxVal) * 100) || 10
      };
    });
  }, [contacts]);

  // 5. Actor Type Distribution (dynamically aggregated)
  const actorTypeData = useMemo(() => {
    const counts: Record<string, number> = {
      'Université': 0,
      'PME': 0,
      'ONG': 0,
      'Labo de recherche': 0,
      'Institutionnel': 0
    };
    let total = 0;

    contacts.forEach(c => {
      if (c.actorType && counts[c.actorType] !== undefined) {
        counts[c.actorType]++;
        total++;
      }
    });

    const colors: Record<string, string> = {
      'Université': '#35b8b2',
      'PME': '#256865',
      'ONG': '#006a63',
      'Labo de recherche': '#6d7a78',
      'Institutionnel': '#00baad'
    };

    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      color: colors[type] || '#35b8b2'
    }));
  }, [contacts]);

  // Recent Exchanges gathered from contacts
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#071f1f] tracking-tight flex items-center gap-3">
            Tableau de bord Innovation
          </h1>
          <p className="text-sm text-[#3d4948] mt-1">
            Bienvenue, voici le récapitulatif dynamique de votre réseau R&I Europe-Afrique.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsCustomizeModalOpen(true)}
            className="flex items-center gap-2 bg-[#dff9f8] hover:bg-[#abece7] text-[#006a66] px-4 py-2.5 rounded-xl text-xs font-extrabold border border-[#bcc9c7]/50 shadow-xs transition-all active:scale-95"
          >
            <Sliders className="w-4 h-4" />
            Personnaliser la disposition
          </button>

          <button
            onClick={() => onNavigate('new-contact')}
            className="flex items-center gap-2 bg-[#35b8b2] hover:bg-[#2b958f] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Nouveau Contact
          </button>
          
          <button
            onClick={() => onNavigate('importation')}
            className="flex items-center gap-2 bg-white border border-[#bcc9c7] text-[#006a66] hover:bg-[#dff9f8] px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95"
          >
            <Upload className="w-4 h-4" />
            Importer CSV
          </button>
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
            isDraggingThis ? 'opacity-40 scale-[0.99] ring-2 ring-dashed ring-[#006a66]' : ''
          } ${
            isDragOverThis ? 'ring-2 ring-[#006a66] ring-offset-4' : ''
          }`;

          if (widget.id === 'stats') {
            return (
              <div key="stats" {...dragProps} className={`space-y-3 ${dragStyleClass}`}>
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-2 hover:bg-white/60 rounded-lg transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <span>Métrique KPI Principales (Glisser-déposer pour déplacer)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveWidget('stats', 'up')} className="p-1 hover:bg-slate-200 rounded" title="Monter"><MoveUp className="w-3.5 h-3.5 text-slate-500" /></button>
                    <button onClick={() => moveWidget('stats', 'down')} className="p-1 hover:bg-slate-200 rounded" title="Descendre"><MoveDown className="w-3.5 h-3.5 text-slate-500" /></button>
                    <button onClick={() => toggleVisibility('stats')} className="p-1 hover:bg-slate-200 rounded" title="Masquer"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Total Contacts */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 flex flex-col justify-between h-40 hover:border-[#35b8b2] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#35b8b2]/10 rounded-xl text-[#006a66]">
                        <Users className="w-6 h-6" />
                      </div>
                      <span className="bg-green-100 text-green-700 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5" /> Actif
                      </span>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#071f1f]">{contacts.length}</h3>
                      <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mt-1">
                        TOTAL DES CONTACTS
                      </p>
                    </div>
                  </div>

                  {/* African Partners */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 flex flex-col justify-between h-40 hover:border-[#35b8b2] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#abece7]/40 rounded-xl text-[#256865]">
                        <Globe className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#071f1f]">{partnerCountriesCount}</h3>
                      <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mt-1">
                        PAYS PARTENAIRES & ZONES
                      </p>
                    </div>
                  </div>

                  {/* Active Projects */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 flex flex-col justify-between h-40 hover:border-[#35b8b2] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#00baad]/10 rounded-xl text-[#006a66]">
                        <FlaskConical className="w-6 h-6" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-3xl font-extrabold text-[#071f1f]">{activeProjectsCount}</h3>
                      <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mt-1">
                        PROJETS R&I ACTIFS
                      </p>
                    </div>
                  </div>

                  {/* Top Sector */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 flex flex-col justify-between h-40 hover:border-[#35b8b2] transition-all">
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 bg-[#abece7]/40 rounded-xl text-[#256865]">
                        <Zap className="w-6 h-6" />
                      </div>
                      <span className="text-[#256865] text-xs font-bold">{topSectorInfo.percentage}%</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-extrabold text-[#071f1f] truncate">{topSectorInfo.name}</h3>
                      <p className="text-[11px] font-bold text-[#3d4948] uppercase tracking-wider mt-1">
                        SECTEUR PRINCIPAL
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          if (widget.id === 'countryChart') {
            return (
              <div key="countryChart" {...dragProps} className={`bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-bold text-[#071f1f]">Distribution par pays</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      value={chartFilter}
                      onChange={(e) => setChartFilter(e.target.value)}
                      className="bg-[#dff9f8] border-none text-[#006a66] font-semibold text-xs rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-[#006a66] cursor-pointer"
                    >
                      <option>Siège vs Zone d'action</option>
                      <option>Par nombre de projets</option>
                    </select>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      <button onClick={() => moveWidget('countryChart', 'up')} className="p-1 hover:bg-slate-100 rounded" title="Monter"><MoveUp className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => moveWidget('countryChart', 'down')} className="p-1 hover:bg-slate-100 rounded" title="Descendre"><MoveDown className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => toggleVisibility('countryChart')} className="p-1 hover:bg-slate-100 rounded" title="Masquer"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></button>
                    </div>
                  </div>
                </div>

                <div className="h-64 flex items-end justify-around gap-2 sm:gap-4 pb-4 border-b border-slate-100">
                  {countryData.map((item, idx) => (
                    <div key={idx} className="w-full flex flex-col items-center gap-2 group h-full justify-end">
                      <div className="w-full max-w-[48px] flex gap-1 items-end h-full">
                        <div 
                          className="w-1/2 bg-[#35b8b2] rounded-t-lg transition-all group-hover:bg-[#2b958f]" 
                          style={{ height: `${item.hqPct}%` }}
                          title={`Siège HQ (${item.country}): ${item.hqCount} contact(s)`}
                        />
                        <div 
                          className="w-1/2 bg-[#256865] rounded-t-lg transition-all group-hover:bg-[#1d524f]" 
                          style={{ height: `${item.zonePct}%` }}
                          title={`Zone d'action (${item.country}): ${item.zoneCount} intervention(s)`}
                        />
                      </div>
                      <span className="text-xs font-medium text-[#3d4948] truncate max-w-[70px]" title={item.country}>{item.country}</span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-center gap-6 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[#35b8b2] rounded-full" />
                    <span className="text-xs font-semibold text-[#3d4948]">Siège social (HQ)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-[#256865] rounded-full" />
                    <span className="text-xs font-semibold text-[#3d4948]">Zone d'intervention</span>
                  </div>
                </div>
              </div>
            );
          }

          if (widget.id === 'actorChart') {
            return (
              <div key="actorChart" {...dragProps} className={`bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-bold text-[#071f1f]">Type d'Acteur</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveWidget('actorChart', 'up')} className="p-1 hover:bg-slate-100 rounded" title="Monter"><MoveUp className="w-3.5 h-3.5 text-slate-500" /></button>
                    <button onClick={() => moveWidget('actorChart', 'down')} className="p-1 hover:bg-slate-100 rounded" title="Descendre"><MoveDown className="w-3.5 h-3.5 text-slate-500" /></button>
                    <button onClick={() => toggleVisibility('actorChart')} className="p-1 hover:bg-slate-100 rounded" title="Masquer"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></button>
                  </div>
                </div>

                <div className="flex items-center justify-center h-52 relative my-2">
                  <div className="w-44 h-44 rounded-full border-[18px] border-[#35b8b2] relative flex items-center justify-center shadow-inner">
                    <div className="absolute inset-[-18px] rounded-full border-[18px] border-[#256865] border-t-transparent border-r-transparent border-l-transparent transform rotate-45" />
                    <div className="absolute inset-[-18px] rounded-full border-[18px] border-[#006a63] border-t-transparent border-b-transparent border-l-transparent transform rotate-[-45deg]" />
                    <div className="text-center">
                      <span className="text-2xl font-black text-[#006a66]">{contacts.length}</span>
                      <p className="text-xs font-semibold text-[#3d4948]">Acteurs Réels</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 text-center">
                  {actorTypeData.map((act, i) => (
                    <div key={i} className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex flex-col items-center justify-center">
                      <span className="text-[11px] font-bold" style={{ color: act.color }}>{act.type}</span>
                      <span className="text-xs font-extrabold text-[#071f1f]">{act.count} ({act.pct}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (widget.id === 'growthChart') {
            return (
              <div key="growthChart" {...dragProps} className={`bg-white p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <h3 className="text-lg font-bold text-[#071f1f]">Aperçu de la croissance du réseau</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setTimeRange('6M')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                          timeRange === '6M' ? 'bg-[#dff9f8] text-[#006a66]' : 'bg-white border border-[#bcc9c7] text-[#3d4948]'
                        }`}
                      >
                        6 Mois
                      </button>
                      <button
                        onClick={() => setTimeRange('1Y')}
                        className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                          timeRange === '1Y' ? 'bg-[#dff9f8] text-[#006a66]' : 'bg-white border border-[#bcc9c7] text-[#3d4948]'
                        }`}
                      >
                        1 An
                      </button>
                    </div>

                    <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                      <button onClick={() => moveWidget('growthChart', 'up')} className="p-1 hover:bg-slate-100 rounded" title="Monter"><MoveUp className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => moveWidget('growthChart', 'down')} className="p-1 hover:bg-slate-100 rounded" title="Descendre"><MoveDown className="w-3.5 h-3.5 text-slate-500" /></button>
                      <button onClick={() => toggleVisibility('growthChart')} className="p-1 hover:bg-slate-100 rounded" title="Masquer"><EyeOff className="w-3.5 h-3.5 text-slate-500" /></button>
                    </div>
                  </div>
                </div>

                <div className="h-44 relative bg-gradient-to-b from-[#35b8b2]/10 to-transparent border-b border-l border-[#bcc9c7]/40 flex items-end">
                  <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                    <path 
                      d="M 0,80 Q 15,70 30,55 T 60,35 T 80,30 T 100,10" 
                      fill="none" 
                      stroke="#006a66" 
                      strokeWidth="3" 
                      vectorEffect="non-scaling-stroke"
                    />
                    <circle cx="0" cy="80" r="2" fill="#006a66" />
                    <circle cx="30" cy="55" r="2" fill="#006a66" />
                    <circle cx="60" cy="35" r="2" fill="#006a66" />
                    <circle cx="80" cy="30" r="2" fill="#006a66" />
                    <circle cx="100" cy="10" r="2" fill="#006a66" />
                  </svg>
                  <div className="w-full flex justify-between px-4 pt-4 z-10">
                    <span className="text-xs text-[#3d4948] font-medium">Jan</span>
                    <span className="text-xs text-[#3d4948] font-medium">Fév</span>
                    <span className="text-xs text-[#3d4948] font-medium">Mar</span>
                    <span className="text-xs text-[#3d4948] font-medium">Avr</span>
                    <span className="text-xs text-[#3d4948] font-medium">Mai</span>
                    <span className="text-xs text-[#3d4948] font-medium">Jun</span>
                  </div>
                </div>
              </div>
            );
          }

          if (widget.id === 'recentExchanges') {
            return (
              <div key="recentExchanges" {...dragProps} className={`bg-white p-4 sm:p-6 rounded-2xl shadow-[0_6px_18px_rgba(0,0,0,0.06)] border border-[#bcc9c7]/30 space-y-4 ${dragStyleClass}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2 cursor-grab active:cursor-grabbing py-1 px-1 rounded-lg hover:bg-slate-50 transition-colors">
                    <GripVertical className="w-4 h-4 text-slate-400 shrink-0" />
                    <h3 className="text-base sm:text-lg font-bold text-[#071f1f]">Derniers Échanges R&I</h3>
                  </div>
                  
                  <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3">
                    <button 
                      onClick={() => onNavigate('contacts')}
                      className="text-[#006a66] font-bold text-xs hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Voir tout l'historique <ArrowRight className="w-3.5 h-3.5" />
                    </button>

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
                      <tr className="border-b border-[#bcc9c7]/30 text-[11px] font-bold text-[#3d4948] uppercase tracking-wider">
                        <th className="py-3 px-2 min-w-[160px]">CONTACT</th>
                        <th className="py-3 px-2 min-w-[100px]">DATE</th>
                        <th className="py-3 px-2 min-w-[200px]">NOTE</th>
                        <th className="py-3 px-2 min-w-[130px]">PROJET</th>
                        <th className="py-3 px-2 text-right min-w-[80px]">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#bcc9c7]/10 text-xs">
                      {recentExchanges.map((item) => (
                        <tr 
                          key={item.id}
                          onClick={() => onSelectContact(item.contact.id)}
                          className="hover:bg-[#dff9f8]/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[#abece7] text-[#2b6c6a] font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                                {item.contact.avatarUrl ? (
                                  <img src={item.contact.avatarUrl} alt={item.contact.name} className="w-full h-full object-cover" />
                                ) : (
                                  item.contact.initials
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-[#071f1f] truncate">{item.contact.name}</p>
                                <p className="text-[11px] text-[#3d4948] truncate">{item.contact.organization}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-2 text-[#071f1f] font-medium whitespace-nowrap">
                            {item.date}
                          </td>
                          <td className="py-3.5 px-2 text-[#3d4948] max-w-xs truncate">
                            {item.content}
                          </td>
                          <td className="py-3.5 px-2">
                            {item.projectName ? (
                              <span className="inline-block bg-[#00baad]/10 text-[#006a63] text-[11px] font-bold px-2.5 py-1 rounded-full truncate max-w-[140px]" title={item.projectName}>
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
                                className="p-1.5 text-slate-500 hover:text-[#006a66] hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-6 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-[#006a66]" />
                <h3 className="font-extrabold text-base text-[#071f1f]">
                  Personnaliser le Tableau de Bord
                </h3>
              </div>
              <button 
                onClick={() => setIsCustomizeModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
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
                    draggedWidgetId === w.id ? 'opacity-40 border-dashed border-[#006a66]' : ''
                  } ${
                    dragOverWidgetId === w.id && draggedWidgetId !== w.id ? 'ring-2 ring-[#006a66]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="w-4 h-4 text-slate-400" />
                    <span className="text-[#071f1f]">{w.title}</span>
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
                        w.visible ? 'bg-[#006a66] text-white' : 'bg-slate-200 text-slate-500'
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
                className="text-xs text-slate-500 hover:text-[#006a66] font-bold flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser la disposition
              </button>

              <button
                onClick={() => setIsCustomizeModalOpen(false)}
                className="px-5 py-2.5 bg-[#006a66] hover:bg-[#256865] text-white font-bold text-xs rounded-xl shadow"
              >
                Terminer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
